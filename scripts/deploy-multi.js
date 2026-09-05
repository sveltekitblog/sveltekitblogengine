#!/usr/bin/env node

/**
 * Copyright (C) 2026 SvelteKit Blog Engine
 *
 * Multi-Account Cloudflare Pages Deployment Runner
 * (Atomic Config Swap, Global Isolation & Complete Cache Clean Mode)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { syncAccounts } from './sync-accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// 🔄 실행 시 백업 파일 기반 계정 정보 스마트 자동 동기화 1회 실행
const accounts = syncAccounts(true);

const args = process.argv.slice(2);
const target = args[0];

// 간결한 옵션(admin, blog) 및 기존 플래그(--admin-only, --blog-only 등) 전수 지원
const isBlogOnly = args.some(arg => ['--blog-only', 'blog-only', 'blog'].includes(arg));
const isAdminOnly = args.some(arg => ['--admin-only', 'admin-only', 'admin'].includes(arg));

if (!target) {
    console.log('\n📖 [사용법]');
    console.log('  npm run deploy:multi -- <계정키> [admin | blog]');
    console.log('  npm run deploy:multi -- <계정키> [--admin-only | --blog-only]');
    console.log('  npm run deploy:multi -- --all');
    console.log('\n📋 [등록된 계정 목록]');
    Object.keys(accounts).forEach(k => {
        const acc = accounts[k];
        const hasToken = acc.token && !acc.token.includes('여기에_');
        const hasAccId = acc.accountId && !acc.accountId.includes('여기에_');
        const status = (hasToken && hasAccId) ? '🟢 준비 완료' : '🟡 token/accountId 입력 필요';
        console.log(`  - ${k} (${acc.name || '이름 없음'}): ${status}`);
    });
    console.log('');
    process.exit(0);
}

function parseResource(entry) {
    if (!entry) return { name: '', id: '' };
    if (typeof entry === 'string') return { name: entry, id: '' };
    return { name: entry.name || '', id: entry.id || '' };
}

function parseKvId(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    return entry.id || '';
}

function cleanAllWranglerCaches(appDir) {
    const cacheDirs = [
        resolve(ROOT, `apps/${appDir}/.wrangler`),
        resolve(ROOT, `apps/${appDir}/node_modules/.cache/wrangler`),
        resolve(ROOT, 'node_modules/.cache/wrangler')
    ];
    for (const dir of cacheDirs) {
        if (existsSync(dir)) {
            try {
                rmSync(dir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
}

function deployApp(appDir, projectName, acc, label) {
    console.log(`\n------------------------------------------------------`);
    console.log(`📦 [${label}] 배포 시작 (Project: ${projectName})`);
    console.log(`------------------------------------------------------`);

    const blogDb = parseResource(acc.d1?.BLOG_DB || acc.d1Database || acc.d1);
    const userDb = parseResource(acc.d1?.USER_DB);
    const kvId = parseKvId(acc.kv?.IMAGES_KV || acc.kv);

    // 1. 해당 계정의 완전한 deploy_config 조립 (어드민 백업 및 DB 동기화용)
    const accountDeployConfig = {
        d1: {
            BLOG_DB: {
                name: blogDb.name,
                id: blogDb.id || ''
            },
            USER_DB: {
                name: userDb.name,
                id: userDb.id || ''
            }
        },
        kv: {
            IMAGES_KV: kvId
        },
        blogProjectName: acc.blogProject || projectName,
        adminProjectName: acc.adminProject || projectName
    };

    const wranglerPath = resolve(ROOT, `apps/${appDir}/wrangler.json`);
    let originalWranglerContent = null;

    // 2. 기존 순정 wrangler.json 메모리에 백업 및 대상 계정 정보로 임시 갱신
    if (existsSync(wranglerPath)) {
        originalWranglerContent = readFileSync(wranglerPath, 'utf8');
        try {
            const wranglerJson = JSON.parse(originalWranglerContent);

            if (wranglerJson.d1_databases) {
                wranglerJson.d1_databases.forEach(db => {
                    if (db.binding === 'BLOG_DB' && blogDb.name) {
                        db.database_name = blogDb.name;
                        if (blogDb.id) db.database_id = blogDb.id;
                    }
                    if (db.binding === 'USER_DB' && userDb.name) {
                        db.database_name = userDb.name;
                        if (userDb.id) db.database_id = userDb.id;
                    }
                });
            }

            if (wranglerJson.kv_namespaces && kvId) {
                wranglerJson.kv_namespaces.forEach(kv => {
                    if (kv.binding === 'IMAGES_KV') {
                        kv.id = kvId;
                    }
                });
            }

            writeFileSync(wranglerPath, JSON.stringify(wranglerJson, null, 4), 'utf8');
        } catch (e) {
            console.warn('⚠ wrangler.json 임시 설정 업데이트 실패:', e.message);
        }
    }

    // 3. Wrangler 전역 캐시 오염을 막기 위한 격리된 임시 APPDATA 폴더 생성
    const isolatedTempDir = resolve(ROOT, '.wrangler-multi-temp');
    if (!existsSync(isolatedTempDir)) {
        mkdirSync(isolatedTempDir, { recursive: true });
    }

    const env = {
        ...process.env,
        APPDATA: isolatedTempDir,
        LOCALAPPDATA: isolatedTempDir,
        CLOUDFLARE_API_TOKEN: acc.token,
        CLOUDFLARE_ACCOUNT_ID: acc.accountId,
        TARGET_BLOG_DB: blogDb.name,
        TARGET_USER_DB: userDb.name,
        TARGET_IMAGES_KV: kvId,
        DEPLOY_CONFIG_JSON: JSON.stringify(accountDeployConfig)
    };

    try {
        const cmd = `node scripts/sync-secrets.js apps/${appDir} ${projectName} && npm run build:${appDir} && cd apps/${appDir} && npx wrangler pages deploy .svelte-kit/cloudflare --project-name ${projectName}`;
        
        execSync(cmd, {
            cwd: ROOT,
            stdio: 'inherit',
            env
        });
    } finally {
        // 4. 배포 완료 후 원래의 순정 wrangler.json으로 무조건 100% 원상 복구!
        if (originalWranglerContent && existsSync(wranglerPath)) {
            try {
                writeFileSync(wranglerPath, originalWranglerContent, 'utf8');
            } catch (e) {}
        }
        // 5. 격리 임시 폴더 삭제
        if (existsSync(isolatedTempDir)) {
            try {
                rmSync(isolatedTempDir, { recursive: true, force: true });
            } catch (e) {}
        }
        // 6. 로컬 .wrangler 및 node_modules/.cache/wrangler 캐시 완전 영구 삭제 (단일 배포 오염 원천 차단)
        cleanAllWranglerCaches(appDir);
    }
}

function deployAccount(key, acc) {
    console.log(`\n======================================================`);
    console.log(`🚀 [${acc.name || key}] 계정 배포 시작`);
    console.log(`======================================================`);

    const isPlaceholder = (val) => !val || val.includes('YOUR_') || val.includes('여기에_');
    if (isPlaceholder(acc.token) || isPlaceholder(acc.accountId)) {
        console.error(`❌ [${key}] 계정에 token 또는 accountId가 아직 입력되지 않았습니다.`);
        console.error(`👉 .deploy-accounts.json 파일에서 [${key}] 계정의 token과 accountId를 입력해 주세요.\n`);
        return;
    }



    if (!isAdminOnly && acc.blogProject) {
        deployApp('blog', acc.blogProject, acc, '1. Blog App');
    }

    if (!isBlogOnly && acc.adminProject) {
        deployApp('admin', acc.adminProject, acc, '2. Admin App');
    }

    console.log(`\n✨ [${acc.name || key}] 계정 배포 완료! 🎉`);
}

async function main() {
    if (target === '--all') {
        const keys = Object.keys(accounts);
        console.log(`\n🌐 총 ${keys.length}개 계정 전체 올인원 배포를 시작합니다.`);
        for (const key of keys) {
            deployAccount(key, accounts[key]);
        }
        console.log(`\n🎉 모든 계정의 배포가 성공적으로 완료되었습니다!`);
    } else if (accounts[target]) {
        deployAccount(target, accounts[target]);
    } else {
        console.error(`\n❌ 등록되지 않은 계정입니다: "${target}"`);
        console.error(`👉 가능한 대상: ${Object.keys(accounts).join(', ')}, --all\n`);
        process.exit(1);
    }
}

main();
