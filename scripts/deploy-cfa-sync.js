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

import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { syncAccounts } from './sync-accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

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

function deployAccount(key, acc) {
    console.log(`\n======================================================`);
    console.log(`🚀 [${acc.name || key}] CFA Sync Worker 배포 시작`);
    console.log(`======================================================`);

    // ── 계정 기본 정보 검증 ──────────────────────────────────────────────
    const isPlaceholder = (val) => !val || val.includes('YOUR_') || val.includes('여기에_');
    if (isPlaceholder(acc.token) || isPlaceholder(acc.accountId)) {
        console.error(`❌ [${key}] token 또는 accountId가 설정되지 않았습니다.`);
        return;
    }

    // ── CFA 섹션 검증 ────────────────────────────────────────────────────
    const cfa = acc.cfa;
    if (!cfa?.cfApiToken || !cfa?.cfSiteTag) {
        console.error(`❌ [${key}] .deploy-accounts.json에 "cfa" 섹션이 없거나 cfApiToken / cfSiteTag가 누락되었습니다.`);
        console.error(`   아래 형식으로 추가하세요:`);
        console.error(`   "cfa": { "cfApiToken": "YOUR_CF_API_TOKEN", "cfSiteTag": "YOUR_SITE_TAG", "workerName": "${key}-cfa-sync" }`);
        return;
    }

    // ── BLOG_DB 정보 추출 ────────────────────────────────────────────────
    const blogDb = acc.d1?.BLOG_DB;
    if (!blogDb?.name || !blogDb?.id) {
        console.error(`❌ [${key}] d1.BLOG_DB의 name 또는 id가 설정되지 않았습니다.`);
        return;
    }

    const workerName = cfa.workerName || `${key}-cfa-sync`;
    const generatedConfig = resolve(WORKER_DIR, 'wrangler.generated.json');

    const wranglerConfig = {
        name: workerName,
        main: 'src/index.ts',
        compatibility_date: '2026-09-03',
        triggers: { crons: ['10 * * * *'] },
        d1_databases: [{ binding: 'BLOG_DB', database_name: blogDb.name, database_id: blogDb.id }]
    };

    // 계정 격리용 env (deploy-multi.js와 동일 패턴)
    const env = {
        ...process.env,
        CLOUDFLARE_API_TOKEN: acc.token,
        CLOUDFLARE_ACCOUNT_ID: acc.accountId
    };

    writeFileSync(generatedConfig, JSON.stringify(wranglerConfig, null, 2));

    try {
        // 1. D1 스키마 마이그레이션 (IF NOT EXISTS — 멱등 실행)
        console.log(`\n📦 [${key}] D1 스키마 마이그레이션 중... (${blogDb.name})`);
        execFileSync(npx, [
            'wrangler', 'd1', 'execute', blogDb.name,
            '--remote', '--yes',
            '--file', MIGRATION_FILE
        ], { cwd: ROOT, stdio: 'inherit', env });

        // 2. Worker Secrets 주입
        console.log(`\n🔐 [${key}] Worker Secrets 주입 중...`);
        execFileSync(npx, ['wrangler', 'secret', 'bulk', '--config', generatedConfig], {
            cwd: WORKER_DIR,
            input: JSON.stringify({
                CF_ACCOUNT_ID: acc.accountId,
                CF_API_TOKEN: cfa.cfApiToken,
                CF_WEB_ANALYTICS_SITE_TAG: cfa.cfSiteTag
            }),
            stdio: ['pipe', 'inherit', 'inherit'],
            env
        });

        // 3. Worker 배포
        console.log(`\n🌎 [${key}] Worker 배포 중... (${workerName})`);
        execFileSync(npx, ['wrangler', 'deploy', '--config', generatedConfig], {
            cwd: WORKER_DIR,
            stdio: 'inherit',
            env
        });

        console.log(`\n✨ [${acc.name || key}] CFA Sync Worker 배포 완료! 🎉`);
        console.log(`   Worker 이름: ${workerName}`);
        console.log(`   실행 주기: 매시간 10분 (cron: 10 * * * *)`);

    } finally {
        if (existsSync(generatedConfig)) rmSync(generatedConfig);
    }
}

async function main() {
    if (target === '--all') {
        const cfaAccounts = Object.entries(accounts).filter(([, acc]) => acc.cfa?.cfApiToken && acc.cfa?.cfSiteTag);
        if (cfaAccounts.length === 0) {
            console.error('\n❌ cfa 섹션이 설정된 계정이 없습니다.');
            console.error('   .deploy-accounts.json 각 계정에 "cfa" 섹션을 추가해주세요.');
            process.exit(1);
        }
        console.log(`\n🌐 총 ${cfaAccounts.length}개 계정 CFA Sync Worker 배포를 시작합니다.`);
        for (const [key, acc] of cfaAccounts) {
            deployAccount(key, acc);
        }
        console.log(`\n🎉 모든 계정의 CFA Sync Worker 배포가 완료되었습니다!`);
    } else if (accounts[target]) {
        deployAccount(target, accounts[target]);
    } else {
        console.error(`\n❌ 등록되지 않은 계정입니다: "${target}"`);
        console.error(`👉 가능한 대상: ${Object.keys(accounts).join(', ')}, --all\n`);
        process.exit(1);
    }
}

main();
