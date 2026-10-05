/**
 * Copyright (C) 2026 SvelteKit Blog Engine
 *
 * Deploy the scheduled CFA synchronizer Worker.
 * Reads all configuration from .deploy-accounts.json (same pattern as deploy-multi.js).
 * No longer depends on apps/admin/.dev.vars or apps/blog/wrangler.json.
 *
 * Usage:
 *   npm run deploy:cfa-sync <account-key>   — deploy for a specific account
 *   npm run deploy:cfa-sync --all            — deploy for all accounts with cfa config
 */

import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { syncAccounts } from './sync-accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const MIGRATION_FILE = resolve(ROOT, 'packages/shared/migrations/schema-blog-db.sql');
const WORKER_DIR = resolve(ROOT, 'apps/cfa-sync');

// 🔄 실행 시 백업 파일 기반 계정 정보 자동 동기화
const accounts = syncAccounts(true);

const args = process.argv.slice(2);
const target = args[0];

if (!target) {
    console.log('\n📖 [사용법]');
    console.log('  npm run deploy:cfa-sync -- <계정키>');
    console.log('  npm run deploy:cfa-sync -- --all');
    console.log('\n📋 [계정 목록 및 CFA 설정 상태]');
    Object.entries(accounts).forEach(([key, acc]) => {
        const hasToken = acc.token && !acc.token.includes('여기에_');
        const hasCfa = acc.cfa?.cfApiToken && acc.cfa?.cfSiteTag;
        const status = !hasToken ? '🟡 token 미설정' : !hasCfa ? '🔴 cfa 섹션 없음' : '🟢 배포 준비 완료';
        console.log(`  - ${key} (${acc.name || '이름 없음'}): ${status}`);
    });
    console.log('\n💡 .deploy-accounts.json의 각 계정에 "cfa" 섹션을 추가하세요.');
    console.log('   예: "cfa": { "cfApiToken": "...", "cfSiteTag": "...", "workerName": "my-cfa-sync" }');
    console.log('');
    process.exit(0);
}

export async function checkWorkerExists(accountId, workerName, token) {
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.status === 200;
    } catch {
        return false;
    }
}

export async function autoDetectSiteTag(accountId, token) {
    try {
        const today = new Date();
        const to = today.toISOString();
        const fromDate = new Date(today);
        fromDate.setUTCDate(today.getUTCDate() - 30);
        const from = fromDate.toISOString();
        const query = `query GetAllRum($accountTag: String!, $from: Time!, $to: Time!) {
          viewer {
            accounts(filter: {accountTag: $accountTag}) {
              traffic: rumPageloadEventsAdaptiveGroups(filter: {datetime_geq: $from, datetime_leq: $to}, limit: 5) {
                dimensions { siteTag }
              }
            }
          }
        }`;
        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query, variables: { accountTag: accountId, from, to } })
        });
        if (!res.ok) return null;
        const data = await res.json();
        const items = data.data?.viewer?.accounts?.[0]?.traffic || [];
        return items[0]?.dimensions?.siteTag || null;
    } catch {
        return null;
    }
}

export async function syncInitialDataToD1(acc, blogDb, siteTag, cfaToken, env, accountId) {
    const effectiveAccId = accountId || acc.cfa?.accountId || acc.accountId;
    console.log(`\n📊 [${acc.name || 'CFA'}] 초회 7일치 CFA 데이터 D1 동기화 시작...`);
    try {
        const today = new Date();
        const dates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setUTCDate(today.getUTCDate() - (7 - i - 1));
            return d.toISOString().slice(0, 10);
        });
        const from = `${dates[0]}T00:00:00Z`;
        const to = `${dates[dates.length - 1]}T23:59:59Z`;

        const query = `query GetDailyRum($accountTag: String!, $siteTag: String!, $from: Time!, $to: Time!) {
          viewer {
            accounts(filter: {accountTag: $accountTag}) {
              traffic: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 100) {
                count sum { visits } avg { sampleInterval } dimensions { date }
              }
              pages: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date requestPath }
              }
              referrers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date refererHost }
              }
              countries: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date countryName }
              }
              devices: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date deviceType }
              }
              browsers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date userAgentBrowser }
              }
              os: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 1000) {
                count sum { visits } avg { sampleInterval } dimensions { date userAgentOS }
              }
            }
          }
        }`;

        const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfaToken}` },
            body: JSON.stringify({ query, variables: { accountTag: effectiveAccId, siteTag, from, to } })
        });

        if (!res.ok) {
            console.warn(`⚠ CFA GraphQL 요청 실패 (${res.status}):`, await res.text());
            return false;
        }

        const payload = await res.json();
        const data = payload.data?.viewer?.accounts?.[0];
        if (!data) {
            console.warn('⚠ CFA GraphQL 응답에 계정 데이터가 없습니다.');
            return false;
        }

        const byDate = new Map();
        for (const date of dates) {
            byDate.set(date, {
                date,
                pageViews: 0,
                visitors: 0,
                details: { pages: [], referrers: [], countries: [], devices: [], browsers: [], os: [] },
                sampleInterval: 1,
                isExact: 1
            });
        }

        for (const row of data.traffic || []) {
            const dateStr = String(row.dimensions?.date || '').slice(0, 10);
            const snapshot = byDate.get(dateStr);
            if (!snapshot) continue;
            snapshot.pageViews = Number(row.count) || 0;
            snapshot.visitors = Number(row.sum?.visits) || 0;
            const interval = Number(row.avg?.sampleInterval) || 1;
            snapshot.sampleInterval = Math.max(snapshot.sampleInterval, interval);
            if (interval !== 1) snapshot.isExact = 0;
        }

        const dimensionMap = {
            pages: 'requestPath', referrers: 'refererHost', countries: 'countryName',
            devices: 'deviceType', browsers: 'userAgentBrowser', os: 'userAgentOS'
        };

        for (const [dimKey, field] of Object.entries(dimensionMap)) {
            for (const row of data[dimKey] || []) {
                const dateStr = String(row.dimensions?.date || '').slice(0, 10);
                const snapshot = byDate.get(dateStr);
                if (!snapshot) continue;
                const rawName = String(row.dimensions?.[field] ?? '').trim();
                const fallback = dimKey === 'referrers' ? 'Direct / None' : 'Unknown';
                const interval = Number(row.avg?.sampleInterval) || 1;
                snapshot.details[dimKey].push({
                    name: rawName || fallback,
                    views: Number(row.count) || 0,
                    visitors: Number(row.sum?.visits) || 0,
                    sampleInterval: interval
                });
                snapshot.sampleInterval = Math.max(snapshot.sampleInterval, interval);
                if (interval !== 1) snapshot.isExact = 0;
            }
        }

        const now = new Date().toISOString();
        const crypto = await import('crypto');
        const sqlStatements = [];

        for (const snapshot of byDate.values()) {
            const detailsJson = JSON.stringify(snapshot.details);
            const dataHash = crypto.createHash('sha256').update(JSON.stringify({
                pageViews: snapshot.pageViews,
                visitors: snapshot.visitors,
                details: snapshot.details,
                sampleInterval: snapshot.sampleInterval,
                isExact: snapshot.isExact === 1
            })).digest('hex');

            const safeDetails = detailsJson.replace(/'/g, "''");
            sqlStatements.push(`INSERT INTO cf_daily_snapshots (date, page_views, visitors, details_json, data_hash, sample_interval, is_exact, fetched_at) VALUES ('${snapshot.date}', ${snapshot.pageViews}, ${snapshot.visitors}, '${safeDetails}', '${dataHash}', ${snapshot.sampleInterval}, ${snapshot.isExact}, '${now}') ON CONFLICT(date) DO UPDATE SET page_views = excluded.page_views, visitors = excluded.visitors, details_json = excluded.details_json, data_hash = excluded.data_hash, sample_interval = excluded.sample_interval, is_exact = excluded.is_exact, fetched_at = excluded.fetched_at;`);
            sqlStatements.push(`INSERT INTO visitor_stats (date, unique_visitors, page_views) VALUES ('${snapshot.date}', ${snapshot.visitors}, ${snapshot.pageViews}) ON CONFLICT(date) DO UPDATE SET unique_visitors = excluded.unique_visitors, page_views = excluded.page_views;`);
        }

        sqlStatements.push(`INSERT INTO cf_sync_state (id, initialized_at, last_synced_at, last_error) VALUES (1, '${now}', '${now}', NULL) ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_error = NULL;`);

        const tempSqlPath = resolve(ROOT, `.cfa-init-${Date.now()}.sql`);
        writeFileSync(tempSqlPath, sqlStatements.join('\n'), 'utf8');

        try {
            execSync(`npx wrangler d1 execute ${blogDb.name} --remote --yes --file=${tempSqlPath}`, {
                cwd: ROOT,
                stdio: 'pipe',
                env
            });
            console.log(`✨ [${acc.name || 'CFA'}] 초회 7일치 CFA 데이터 D1 적재 성공! (${byDate.size}일치 적재 완료)`);
            return true;
        } finally {
            if (existsSync(tempSqlPath)) rmSync(tempSqlPath, { force: true });
        }
    } catch (e) {
        console.warn(`⚠ 초회 CFA 데이터 동기화 중 오류 (무시하고 계속):`, e.message);
        return false;
    }
}

export async function deployCfaSyncAccount(key, acc, options = {}) {
    console.log(`\n======================================================`);
    console.log(`🚀 [${acc.name || key}] CFA Sync Worker 배포 시작`);
    console.log(`======================================================`);

    // ── 계정 기본 정보 검증 ──────────────────────────────────────────────
    const isPlaceholder = (val) => !val || val.includes('YOUR_') || val.includes('여기에_');
    let cfa = acc.cfa || {};
    const effectiveAccountId = (!isPlaceholder(cfa.accountId)) ? cfa.accountId : acc.accountId;
    const effectiveToken = (!isPlaceholder(cfa.cfApiToken)) ? cfa.cfApiToken : acc.token;

    if (isPlaceholder(effectiveToken) || isPlaceholder(effectiveAccountId)) {
        console.error(`❌ [${key}] token/cfApiToken 또는 accountId/cfa.accountId가 설정되지 않았습니다.`);
        return;
    }

    const workerName = acc.cfa?.workerName || `${key}-cfa-sync`;
    const isForce = Boolean(options.force || args.includes('--force'));
    let needWorkerDeploy = true;

    // ── 1. 중복 생성 방지: 워커 사전 존재 확인 ─────────────────────────
    if (!isForce) {
        const exists = await checkWorkerExists(effectiveAccountId, workerName, effectiveToken);
        if (exists) {
            console.log(`⏩ [${key}] CFA Sync Worker ("${workerName}")가 이미 등록되어 정상 작동 중입니다.`);
            console.log(`   워커 배포는 건너뜁니다. (강제 재배포 필요 시: --force)`);
            needWorkerDeploy = false;
        }
    }

    // ── CFA 섹션 검증 및 자동 감지 ──────────────────────────────────────
    const cfaToken = effectiveToken;
    let siteTag = cfa.cfSiteTag;

    if (!siteTag) {
        console.log(`🔍 [${key}] cfSiteTag가 없어 Cloudflare에서 활성 사이트 태그 자동 탐색 중...`);
        siteTag = await autoDetectSiteTag(effectiveAccountId, cfaToken);
        if (siteTag) {
            console.log(`✅ [${key}] 활성 siteTag 자동 감지 성공: ${siteTag}`);
        } else {
            console.error(`❌ [${key}] siteTag 자동 감지 실패. .deploy-accounts.json의 cfa.cfSiteTag를 확인하세요.`);
            return;
        }
    }

    // ── BLOG_DB 정보 추출 ────────────────────────────────────────────────
    const blogDb = acc.d1?.BLOG_DB;
    if (!blogDb?.name || !blogDb?.id) {
        console.error(`❌ [${key}] d1.BLOG_DB의 name 또는 id가 설정되지 않았습니다.`);
        return;
    }

    const generatedConfig = resolve(WORKER_DIR, 'wrangler.generated.json');
    const secretsFile = resolve(WORKER_DIR, 'secrets.generated.json');

    const wranglerConfig = {
        name: workerName,
        account_id: effectiveAccountId,
        main: 'src/index.ts',
        compatibility_date: '2026-09-03',
        workers_dev: false,
        triggers: { crons: ['0 */1 * * *'] },
        d1_databases: [{ binding: 'BLOG_DB', database_name: blogDb.name, database_id: blogDb.id }]
    };

    // 웹 로그인 계정(main)인지, API 토큰 서브 계정인지 판별
    const isWebLogin = isPlaceholder(acc.token);

    // 계정 격리용 env (API 토큰 계정일 때만 환경변수 격리 적용)
    const isolatedTempDir = resolve(ROOT, '.wrangler-multi-temp');
    if (!isWebLogin && !existsSync(isolatedTempDir)) mkdirSync(isolatedTempDir, { recursive: true });

    const env = isWebLogin
        ? {
            ...process.env,
            CI: 'true',
            CLOUDFLARE_ACCOUNT_ID: effectiveAccountId
        }
        : {
            ...process.env,
            CI: 'true',
            APPDATA: isolatedTempDir,
            LOCALAPPDATA: isolatedTempDir,
            CLOUDFLARE_API_TOKEN: acc.token,
            CLOUDFLARE_ACCOUNT_ID: acc.accountId
        };

    try {
        if (needWorkerDeploy) {
            writeFileSync(generatedConfig, JSON.stringify(wranglerConfig, null, 2));

            // 1. D1 스키마 마이그레이션 (옵션에 따라 중복 건너뛰기)
            if (!options.skipMigration) {
                console.log(`\n📦 [${key}] D1 스키마 마이그레이션 중... (${blogDb.name})`);
                execSync(
                    `npx wrangler d1 execute ${blogDb.name} --remote --yes --file=${MIGRATION_FILE}`,
                    { cwd: ROOT, stdio: 'inherit', env }
                );
            }

            // 2. Worker 배포 (코드 및 크론 트리거 등록)
            console.log(`\n🌎 [${key}] Worker 배포 중... (${workerName})`);
            execSync(
                `npx wrangler deploy --config ${generatedConfig}`,
                { cwd: WORKER_DIR, stdio: 'inherit', env }
            );

            // 3. Worker Secrets 주입 (임시 파일 경유 — Windows pipe 호환성)
            console.log(`\n🔐 [${key}] Worker Secrets 주입 중...`);
            writeFileSync(secretsFile, JSON.stringify({
                CF_ACCOUNT_ID: effectiveAccountId,
                CF_API_TOKEN: cfaToken,
                CF_WEB_ANALYTICS_SITE_TAG: siteTag
            }));
            execSync(
                `npx wrangler secret bulk --config ${generatedConfig} --file ${secretsFile}`,
                { cwd: WORKER_DIR, stdio: 'inherit', env }
            );

            console.log(`\n✨ [${acc.name || key}] CFA Sync Worker 배포 완료! 🎉`);
            console.log(`   Worker 이름: ${workerName}`);
            console.log(`   실행 주기: 매시간 정각 (cron: 0 */1 * * *)`);
            console.log(`   외부 도메인: 비활성화 (workers_dev: false, 외부 차단)`);
        }

        // 4. [핵심] 초회 7일치 CFA 데이터 D1 직접 적재
        await syncInitialDataToD1(acc, blogDb, siteTag, cfaToken, env, effectiveAccountId);

    } finally {
        if (existsSync(generatedConfig)) rmSync(generatedConfig);
        if (existsSync(secretsFile)) {
            try { rmSync(secretsFile); } catch (e) {}
        }
        if (existsSync(isolatedTempDir)) {
            try { rmSync(isolatedTempDir, { recursive: true, force: true }); } catch (e) {}
        }
    }
}

async function main() {
    if (target === '--all') {
        const cfaAccounts = Object.entries(accounts).filter(([, acc]) => acc.cfa?.cfApiToken || acc.token);
        if (cfaAccounts.length === 0) {
            console.error('\n❌ 배포 가능한 계정이 없습니다.');
            process.exit(1);
        }
        console.log(`\n🌐 총 ${cfaAccounts.length}개 계정 CFA Sync Worker 배포를 시작합니다.`);
        for (const [key, acc] of cfaAccounts) {
            await deployCfaSyncAccount(key, acc);
        }
        console.log(`\n🎉 모든 계정의 CFA Sync Worker 처리가 완료되었습니다!`);
    } else if (accounts[target]) {
        await deployCfaSyncAccount(target, accounts[target]);
    } else {
        console.error(`\n❌ 등록되지 않은 계정입니다: "${target}"`);
        console.error(`👉 가능한 대상: ${Object.keys(accounts).join(', ')}, --all\n`);
        process.exit(1);
    }
}

main();
