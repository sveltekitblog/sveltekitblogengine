#!/usr/bin/env node

/**
 * Copyright (C) 2026 kimteamjang
 *
 * Smart Multi-Account Config Synchronizer
 * Automatically scans wrangler.backup*.json files and syncs with .deploy-accounts.json
 *
 * Usage:
 *   node scripts/sync-accounts.js
 *   npm run deploy:sync
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const configPath = resolve(ROOT, '.deploy-accounts.json');

export function syncAccounts(silent = false) {
    let existingAccounts = {};
    if (existsSync(configPath)) {
        try {
            existingAccounts = JSON.parse(readFileSync(configPath, 'utf8'));
        } catch (e) {
            if (!silent) console.warn('⚠ [.deploy-accounts.json] 기존 파일 파싱 실패:', e.message);
        }
    }

    const updatedAccounts = { ...existingAccounts };
    let newlyAddedCount = 0;

    // ── 1. 기본 main 계정 추출 (wrangler.json + package.json) ──
    const blogWranglerPath = resolve(ROOT, 'apps/blog/wrangler.json');
    const adminWranglerPath = resolve(ROOT, 'apps/admin/wrangler.json');
    const pkgPath = resolve(ROOT, 'package.json');

    let defaultBlogProject = 'sveltekitblogblog';
    let defaultAdminProject = 'sveltekitblogadmin';
    let defaultBlogDb = { name: 'svelteblog-db', id: '' };
    let defaultUserDb = { name: 'svelteuser-db', id: '' };
    let defaultKv = '';

    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts?.['deploy:blog']) {
                const m = pkg.scripts['deploy:blog'].match(/--project-name\s+([^\s&]+)/);
                if (m?.[1]) defaultBlogProject = m[1];
            }
            if (pkg.scripts?.['deploy:admin']) {
                const m = pkg.scripts['deploy:admin'].match(/--project-name\s+([^\s&]+)/);
                if (m?.[1]) defaultAdminProject = m[1];
            }
        } catch (e) {}
    }

    const readWrangler = (p) => {
        if (existsSync(p)) {
            try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return null; }
        }
        return null;
    };

    const blogW = readWrangler(blogWranglerPath);
    const adminW = readWrangler(adminWranglerPath);
    const primaryW = blogW || adminW;

    if (primaryW) {
        if (primaryW.d1_databases) {
            primaryW.d1_databases.forEach(db => {
                if (db.binding === 'BLOG_DB') defaultBlogDb = { name: db.database_name, id: db.database_id };
                if (db.binding === 'USER_DB') defaultUserDb = { name: db.database_name, id: db.database_id };
            });
        }
        if (primaryW.kv_namespaces) {
            primaryW.kv_namespaces.forEach(kv => {
                if (kv.binding === 'IMAGES_KV') defaultKv = kv.id;
            });
        }
    }

    // main 계정 구성
    const mainExisting = updatedAccounts.main || {};
    updatedAccounts.main = {
        name: mainExisting.name || 'Main Blog Account',
        token: mainExisting.token || 'YOUR_CLOUDFLARE_API_TOKEN_HERE',
        accountId: mainExisting.accountId || 'YOUR_CLOUDFLARE_ACCOUNT_ID_HERE',
        blogProject: mainExisting.blogProject || defaultBlogProject,
        adminProject: mainExisting.adminProject || defaultAdminProject,
        d1: {
            BLOG_DB: {
                name: mainExisting.d1?.BLOG_DB?.name || defaultBlogDb.name,
                id: mainExisting.d1?.BLOG_DB?.id || defaultBlogDb.id
            },
            USER_DB: {
                name: mainExisting.d1?.USER_DB?.name || defaultUserDb.name,
                id: mainExisting.d1?.USER_DB?.id || defaultUserDb.id
            }
        },
        kv: {
            IMAGES_KV: mainExisting.kv?.IMAGES_KV || defaultKv
        }
    };

    // ── 2. 루트의 모든 wrangler.backup*.json 파일 스캔 및 추가 ──
    const files = readdirSync(ROOT);
    const backupFiles = files.filter(f => f.startsWith('wrangler.backup') && f.endsWith('.json'));

    for (const bFile of backupFiles) {
        const bPath = resolve(ROOT, bFile);
        try {
            const bData = JSON.parse(readFileSync(bPath, 'utf8'));
            if (!bData.d1 && !bData.blogProjectName) continue;

            const bBlogProject = bData.blogProjectName || defaultBlogProject;
            const bAdminProject = bData.adminProjectName || defaultAdminProject;
            const bBlogDb = bData.d1?.BLOG_DB || defaultBlogDb;
            const bUserDb = bData.d1?.USER_DB || defaultUserDb;
            const bKv = typeof bData.kv === 'string' ? bData.kv : (bData.kv?.IMAGES_KV || defaultKv);

            // 메인 계정과 완전히 동일한 데이터인 경우 main으로 간주
            const isIdenticalToMain =
                bBlogDb.id === defaultBlogDb.id &&
                bUserDb.id === defaultUserDb.id &&
                bBlogProject === defaultBlogProject;

            if (isIdenticalToMain && bFile === 'wrangler.backup.json') {
                continue;
            }

            // 계정 식별 키 생성 (예: wrangler.backup.kimteam.json -> kimteam, 또는 blogProjectName 기반)
            let accountKey = '';
            const matchSuffix = bFile.match(/wrangler\.backup[.-](.+)\.json$/);
            if (matchSuffix?.[1]) {
                accountKey = matchSuffix[1].toLowerCase();
            } else if (bBlogProject && bBlogProject !== defaultBlogProject) {
                accountKey = bBlogProject.replace(/(blog|web|site|-blog|-web)$/i, '') || bBlogProject;
            } else {
                accountKey = `account_${Math.random().toString(36).substring(2, 6)}`;
            }

            const existing = updatedAccounts[accountKey] || {};
            const isNew = !updatedAccounts[accountKey];

            updatedAccounts[accountKey] = {
                name: existing.name || `${accountKey} Account`,
                token: existing.token || 'YOUR_CLOUDFLARE_API_TOKEN_HERE',
                accountId: existing.accountId || 'YOUR_CLOUDFLARE_ACCOUNT_ID_HERE',
                blogProject: existing.blogProject || bBlogProject,
                adminProject: existing.adminProject || bAdminProject,
                d1: {
                    BLOG_DB: {
                        name: existing.d1?.BLOG_DB?.name || bBlogDb.name || '',
                        id: existing.d1?.BLOG_DB?.id || bBlogDb.id || ''
                    },
                    USER_DB: {
                        name: existing.d1?.USER_DB?.name || bUserDb.name || '',
                        id: existing.d1?.USER_DB?.id || bUserDb.id || ''
                    }
                },
                kv: {
                    IMAGES_KV: existing.kv?.IMAGES_KV || bKv || ''
                }
            };

            if (isNew) {
                newlyAddedCount++;
                if (!silent) {
                    console.log(`✨ 새 계정 [${accountKey}]이(가) 백업 파일('${bFile}')에서 감지되어 .deploy-accounts.json에 자동 등록되었습니다!`);
                }
            }
        } catch (e) {
            if (!silent) console.warn(`⚠ [${bFile}] 백업 파일 파싱 실패:`, e.message);
        }
    }

    // 파일 저장
    writeFileSync(configPath, JSON.stringify(updatedAccounts, null, 2), 'utf8');

    if (!silent) {
        console.log('\n======================================================');
        console.log('✅ [.deploy-accounts.json] 계정 설정 동기화 완료!');
        console.log('======================================================');
        console.log('📋 [현재 등록된 계정 목록]');
        Object.keys(updatedAccounts).forEach(k => {
            const acc = updatedAccounts[k];
            const hasToken = acc.token && !acc.token.includes('YOUR_') && !acc.token.includes('여기에_');
            const hasAccId = acc.accountId && !acc.accountId.includes('YOUR_') && !acc.accountId.includes('여기에_');
            const status = (hasToken && hasAccId) ? '🟢 준비 완료' : '🟡 token/accountId 입력 필요';
            console.log(`  - ${k} (${acc.name}): ${status}`);
        });
        console.log('');
    }

    return updatedAccounts;
}

// 직접 실행된 경우
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    syncAccounts(false);
}
