#!/usr/bin/env node

/**
 * Monorepo One-Click Setup Script
 *
 * Usage: npm run setup
 *
 * This script:
 * 1. Authenticates with Cloudflare via wrangler login
 * 2. Creates D1 databases and KV namespaces
 * 3. Parses resource IDs from wrangler output
 * 4. Auto-updates wrangler.json in both apps
 * 5. Runs DB migrations
 * 6. Uploads secrets from .dev.vars and deploys apps to Cloudflare Pages
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// Use npx.cmd on Windows to avoid PowerShell script execution policy issues
const isWin = process.platform === 'win32';
const NPX = isWin ? 'npx.cmd' : 'npx';

// ─── Helpers ─────────────────────────────────────────────────────────────

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function generateRandomId(length = 6) {
    return Math.random().toString(36).substring(2, 2 + length);
}

function getRepresentativeUrl(rawOut, defaultProjectName) {
    if (!rawOut) return `https://${defaultProjectName}.pages.dev`;
    const match = rawOut.match(/https:\/\/[a-zA-Z0-9.-]+\.pages\.dev/);
    if (!match) return `https://${defaultProjectName}.pages.dev`;
    try {
        const parsed = new URL(match[0].trim());
        const parts = parsed.hostname.split('.');
        if (parts.length === 4) {
            const cleanDomain = `${parts[1]}.${parts[2]}.${parts[3]}`;
            return `${parsed.protocol}//${cleanDomain}`;
        }
        return match[0].trim();
    } catch (e) {
        return match[0].trim();
    }
}

function checkWranglerLogin() {
    console.log('  🔍 Checking Cloudflare credentials... / [KO] 클라우드플레어 로그인 상태 확인 중...');
    if (process.env.CLOUDFLARE_API_TOKEN) {
        return true;
    }
    const result = runCapture(`${NPX} wrangler whoami`, { silent: true });
    if (result.includes('You are not logged in') || result.includes('Authentication Error') || result.toLowerCase().includes('error')) {
        return false;
    }
    return result.includes('@') || result.includes('Account') || result.includes('Logged in');
}

function loadBackupResources() {
    const backupPath = resolve(ROOT, 'wrangler.backup.json');
    if (existsSync(backupPath)) {
        try {
            console.log(`  💾 Found backup file: ${backupPath}`);
            const data = JSON.parse(readFileSync(backupPath, 'utf-8'));
            if (data.d1 && data.kv) {
                return data;
            }
        } catch (e) {
            console.warn('  ⚠ Failed to parse wrangler.backup.json. Falling back to wrangler.json analysis.', e.message);
        }
    }

    console.log('  🔍 Attempting to extract bindings from existing wrangler.json files...');
    const blogWranglerPath = resolve(ROOT, 'apps/blog/wrangler.json');
    const adminWranglerPath = resolve(ROOT, 'apps/admin/wrangler.json');
    
    const resources = { d1: {}, kv: {} };
    let blogConfig = null;
    let adminConfig = null;
    
    if (existsSync(blogWranglerPath)) {
        try {
            blogConfig = JSON.parse(readFileSync(blogWranglerPath, 'utf-8'));
        } catch (e) {}
    }
    if (existsSync(adminWranglerPath)) {
        try {
            adminConfig = JSON.parse(readFileSync(adminWranglerPath, 'utf-8'));
        } catch (e) {}
    }
    
    const config = blogConfig || adminConfig;
    if (config) {
        if (config.d1_databases && config.d1_databases.length > 0) {
            config.d1_databases.forEach(d => {
                resources.d1[d.binding] = { name: d.database_name, id: d.database_id };
            });
        }
        if (config.kv_namespaces && config.kv_namespaces.length > 0) {
            config.kv_namespaces.forEach(k => {
                resources.kv[k.binding] = k.id;
            });
        }
        
        if (Object.keys(resources.d1).length > 0 && Object.keys(resources.kv).length > 0) {
            console.log('  ✅ Extracted binding resources successfully from existing wrangler.json config.');
            return resources;
        }
    }
    
    return null;
}

function saveBackupResources(resources, blogProject, adminProject) {
    const backupPath = resolve(ROOT, 'wrangler.backup.json');
    try {
        const backupData = {
            d1: resources.d1,
            kv: resources.kv,
            blogProjectName: blogProject || 'cf-blog',
            adminProjectName: adminProject || 'cf-admin'
        };
        writeFileSync(backupPath, JSON.stringify(backupData, null, 4) + '\n');
        console.log(`  💾 Automatically backed up environment bindings and deploy names to: ${backupPath}`);
    } catch (e) {
        console.error('  ⚠ Failed to save wrangler.backup.json:', e.message);
    }
}

function run(cmd, opts = {}) {
    console.log(`\n  ▶ ${cmd}\n`);
    try {
        const result = execSync(cmd, {
            cwd: opts.cwd || ROOT,
            encoding: 'utf-8',
            stdio: opts.silent ? 'pipe' : 'inherit',
            ...opts,
        });
        return result || '';
    } catch (e) {
        if (opts.ignoreError) {
            console.error(`  ⚠ Warning: Command failed but ignoring error: ${cmd}`);
            return e.stdout || e.stderr || '';
        }
        throw e;
    }
}

function runCapture(cmd, opts = {}) {
    console.log(`  ▶ ${cmd}`);
    try {
        const result = execSync(cmd, {
            cwd: opts.cwd || ROOT,
            encoding: 'utf-8',
            stdio: 'pipe',
            ...opts,
        });
        return result;
    } catch (e) {
        return e.stdout || e.stderr || '';
    }
}

function runInteractive(cmd) {
    console.log(`\n  ▶ ${cmd}\n`);
    const [command, ...args] = cmd.split(' ');
    spawnSync(command, args, {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true
    });
}

function parseD1Id(output) {
    const match = output.match(/database_id\s*=\s*"?([a-f0-9-]+)"?/i)
        || output.match(/id:\s*([a-f0-9-]+)/i)
        || output.match(/"id"\s*:\s*"([a-f0-9-]+)"/)
        || output.match(/"database_id"\s*:\s*"([a-f0-9-]+)"/);
    return match?.[1] || null;
}

function parseKVId(output) {
    const match = output.match(/id:\s*"?([a-f0-9]+)"?/i)
        || output.match(/"id"\s*:\s*"([a-f0-9]+)"/);
    return match?.[1] || null;
}

function updateWranglerJson(appPath, updates) {
    const configPath = resolve(ROOT, appPath, 'wrangler.json');
    let config = {};

    if (!existsSync(configPath)) {
        console.log(`  ℹ ${configPath} not found. Creating a new default configuration.`);
        config = {
            name: `cf-${appPath.split('/').pop()}`,
            compatibility_date: new Date().toISOString().split('T')[0],
            compatibility_flags: ["nodejs_compat"],
            pages_build_output_dir: ".svelte-kit/cloudflare",
            d1_databases: [],
            kv_namespaces: []
        };
    } else {
        config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }

    // Update D1 databases
    if (updates.d1) {
        if (!config.d1_databases) config.d1_databases = [];
        for (const [binding, { name, id }] of Object.entries(updates.d1)) {
            const existing = config.d1_databases.find(d => d.binding === binding);
            if (existing) {
                existing.database_id = id;
                existing.database_name = name;
            } else {
                config.d1_databases.push({ binding, database_name: name, database_id: id });
            }
        }
    }

    // Update KV namespaces
    if (updates.kv) {
        if (!config.kv_namespaces) config.kv_namespaces = [];
        for (const [binding, id] of Object.entries(updates.kv)) {
            const existing = config.kv_namespaces.find(k => k.binding === binding);
            if (existing) {
                existing.id = id;
            } else {
                config.kv_namespaces.push({ binding, id });
            }
        }
    }

    writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n');
    console.log(`  ✅ Updated ${configPath}`);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
    const isRestore = process.argv.includes('--restore');
    const isSelectArg = process.argv.includes('--select');
    let selectedLang = 'ko';
    let isSelectMode = isSelectArg;

    // ─── Step 0: .dev.vars 필수 환경변수 사전 검증 ───
    console.log('─── Step 0: Validating local environment variables (환경변수 사전 검사) ───');
    const adminVarsPath = resolve(ROOT, 'apps/admin/.dev.vars');
    const blogVarsPath = resolve(ROOT, 'apps/blog/.dev.vars');
    
    let validationFailed = false;
    let errorMsg = '';

    if (!existsSync(adminVarsPath)) {
        validationFailed = true;
        errorMsg += `\n❌ apps/admin/.dev.vars 파일이 존재하지 않습니다.
   (apps/admin/.dev.vars.example 파일을 복사하여 생성하고 ADMIN_PASSWORD를 설정해주세요.)
   [EN] apps/admin/.dev.vars file does not exist.
   (Please copy apps/admin/.dev.vars.example to create it and configure ADMIN_PASSWORD.)`;
    } else {
        const content = readFileSync(adminVarsPath, 'utf-8');
        if (!content.includes('ADMIN_PASSWORD=') || content.match(/ADMIN_PASSWORD=\s*$/m) || content.includes('ADMIN_PASSWORD=""') || content.includes('ADMIN_PASSWORD=\'\'')) {
            validationFailed = true;
            errorMsg += `\n❌ apps/admin/.dev.vars 파일 내에 ADMIN_PASSWORD 값이 설정되어 있지 않습니다.
   [EN] ADMIN_PASSWORD is not set in apps/admin/.dev.vars.`;
        }
    }

    if (!existsSync(blogVarsPath)) {
        validationFailed = true;
        errorMsg += `\n❌ apps/blog/.dev.vars 파일이 존재하지 않습니다.
   (apps/blog/.dev.vars.example 파일을 복사하여 생성하고 BETTER_AUTH_SECRET 등을 설정해주세요.)
   [EN] apps/blog/.dev.vars file does not exist.
   (Please copy apps/blog/.dev.vars.example to create it and configure BETTER_AUTH_SECRET.)`;
    } else {
        const content = readFileSync(blogVarsPath, 'utf-8');
        if (!content.includes('BETTER_AUTH_SECRET=') || content.match(/BETTER_AUTH_SECRET=\s*$/m) || content.includes('BETTER_AUTH_SECRET=""') || content.includes('BETTER_AUTH_SECRET=\'\'')) {
            validationFailed = true;
            errorMsg += `\n❌ apps/blog/.dev.vars 파일 내에 BETTER_AUTH_SECRET 값이 설정되어 있지 않습니다.
   [EN] BETTER_AUTH_SECRET is not set in apps/blog/.dev.vars.`;
        }
    }

    if (validationFailed) {
        console.error('\n╔══════════════════════════════════════════════════════╗');
        console.error('║  🚨 환경설정 오류 (Setup Halted)                     ║');
        console.error('╚══════════════════════════════════════════════════════╝');
        console.error(errorMsg);
        console.error('\n  [KO] 필수 비밀 변수를 기입한 후 다시 setup을 구동해주시기 바랍니다.\n  [EN] Please fill in the required secret variables and run the setup script again.\n');
        process.exit(1);
    }
    console.log('  ✅ [EN] Environment variables validated successfully.');
    console.log('  ✅ [KO] 환경변수 검사를 성공적으로 통과했습니다.\n');

    if (!isRestore) {
        // 1. 기본 블로그 언어 선택
        console.log('  [EN] Select default blog language:');
        console.log('  [KO] 기본 블로그 언어를 선택하세요:');
        console.log('  1) Korean / 한국어 (ko) [Default]');
        console.log('  2) English / 영어 (en)');
        console.log('  3) Japanese / 日本語 (ja)');
        console.log('  [EN] Choose option (1/2/3) [Default: 1]');
        console.log('  [KO] 옵션을 선택하세요 (1/2/3) [기본값: 1]');
        const langOption = await ask('  > ');
        if (langOption.trim() === '2') selectedLang = 'en';
        if (langOption.trim() === '3') selectedLang = 'ja';

        if (!isSelectArg) {
            // 2. 나머지 과정 셋업 모드 선택
            console.log('\n  [EN] Choose setup mode for the remaining steps:');
            console.log('  [KO] 나머지 설정의 진행 방식을 선택하세요:');
            console.log('  1) Full Auto Setup & Deploy / 풀 자동 설정 및 배포 [Default]');
            console.log('  2) Custom Interactive Setup / 사용자 지정 직접 선택 설정');
            console.log('  [EN] Choose option (1/2) [Default: 1]');
            console.log('  [KO] 옵션을 선택하세요 (1/2) [기본값: 1]');
            const modeOption = await ask('  > ');
            isSelectMode = (modeOption.trim() === '2');
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  [EN] SvelteKit Blog Monorepo ${isRestore ? 'Restore' : 'Setup'}                ║`);
    console.log(`║  [KO] SvelteKit 블로그 모노레포 자동 ${isRestore ? '복구' : '설정'}            ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // ── Step 1: Configure Deployment Names (배포 프로젝트명 설정 - 전진 배치) ──
    console.log('─── Step 1/7: Configure Deployment Names (배포 프로젝트명 설정) ───');
    
    // Attempt to parse existing deploy project names from package.json or backup
    let defaultBlogProject = 'svelteblog';
    let defaultAdminProject = 'svelteadmin';
    
    // First try from backup file
    const backupPath = resolve(ROOT, 'wrangler.backup.json');
    if (existsSync(backupPath)) {
        try {
            const data = JSON.parse(readFileSync(backupPath, 'utf-8'));
            if (data.blogProjectName) defaultBlogProject = data.blogProjectName;
            if (data.adminProjectName) defaultAdminProject = data.adminProjectName;
        } catch (e) {}
    }

    let blogProjectName = defaultBlogProject;
    let adminProjectName = defaultAdminProject;

    if (isRestore) {
        console.log('  💾 [EN] Restore Mode: Automatically locks deploy names to prevent errors.');
        console.log('  💾 [KO] 복구 모드: 휴먼 에러 방지를 위해 프로젝트명을 자동 고정합니다.');
        console.log(`     - Blog Project: ${blogProjectName}`);
        console.log(`     - Admin Project: ${adminProjectName}`);
    } else if (isSelectMode) {
        console.log(`  [EN] Enter Blog project name [Default: ${defaultBlogProject}]`);
        console.log('  [KO] 블로그 배포명을 입력하세요');
        const blogProjectNameInput = await ask('  > ');

        console.log(`  [EN] Enter Admin project name [Default: ${defaultAdminProject}]`);
        console.log('  [KO] 어드민 배포명을 입력하세요');
        const adminProjectNameInput = await ask('  > ');

        blogProjectName = blogProjectNameInput.trim() || defaultBlogProject;
        adminProjectName = adminProjectNameInput.trim() || defaultAdminProject;
    } else {
        console.log(`  🚀 [EN] Using default Blog Project Name: ${blogProjectName}`);
        console.log(`  🚀 [KO] 기본 블로그 프로젝트명 사용: ${blogProjectName}`);
        console.log(`  🚀 [EN] Using default Admin Project Name: ${adminProjectName}`);
        console.log(`  🚀 [KO] 기본 어드민 프로젝트명 사용: ${adminProjectName}`);
    }

    // Update package.json deploy scripts
    const pkgPath = resolve(ROOT, 'package.json');
    if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts) {
            pkg.scripts['deploy:blog'] = `node scripts/sync-secrets.js apps/blog ${blogProjectName} && npm run build:blog && cd apps/blog && npx wrangler pages deploy .svelte-kit/cloudflare --project-name ${blogProjectName}`;
            pkg.scripts['deploy:admin'] = `node scripts/sync-secrets.js apps/admin ${adminProjectName} && npm run build:admin && cd apps/admin && npx wrangler pages deploy .svelte-kit/cloudflare --project-name ${adminProjectName}`;
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
            console.log('  [EN] Updated package.json deploy scripts (including secret sync).');
            console.log('  [KO] package.json 배포 스크립트를 업데이트했습니다 (비밀 환경변수 동기화 포함).');
        }
    }

    // ── Step 2: Wrangler Login ──
    console.log('\n─── Step 2/7: Cloudflare Authentication (클라우드플레어 인증) ───');
    const isLoggedIn = checkWranglerLogin();
    if (isLoggedIn) {
        console.log('  ✅ [EN] Valid Cloudflare session detected. Skipping login.');
        console.log('  ✅ [KO] 유효한 클라우드플레어 세션이 감지되었습니다. 로그인을 생략합니다.');
    } else {
        let loginChoice = 'y';
        if (isSelectMode) {
            console.log('  [EN] Run wrangler login?');
            console.log('  [KO] Wrangler 로그인을 진행할까요?');
            console.log('  [EN] (Y/n) [Default: Y]');
            console.log('  [KO] (Y/n) [기본값: Y]');
            loginChoice = await ask('  > ');
        }
        if (loginChoice.toLowerCase() !== 'n') {
            // Using minimal scopes to protect account security (Only D1, KV, Pages, and Account Info)
            runInteractive(`${NPX} wrangler login --scopes account:read user:read workers:write pages:write d1:write workers_kv:write`);
        } else {
            console.log('  [EN] Skipping login.');
            console.log('  [KO] 로그인을 건너뜁니다.');
        }
    }

    let resources = { d1: {}, kv: {}, r2: {} };

    if (isRestore) {
        console.log('\n─── Step 3/7: Restoring Cloudflare Resources from Backup (백업에서 리소스 복원) ───');
        const loaded = loadBackupResources();
        if (!loaded || !loaded.d1?.BLOG_DB || !loaded.d1?.USER_DB || !loaded.kv?.IMAGES_KV) {
            console.error('\n❌ [EN] Restore failed: No valid backup or existing wrangler.json resources found.');
            console.error('   [KO] 복구 실패: 유효한 백업 파일(wrangler.backup.json)이나 기존 wrangler.json 리소스 설정을 찾을 수 없습니다.');
            console.error('   Please run "npm run setup" first to create resources. / 먼저 "npm run setup"을 통해 초기 설정을 진행해주세요.\n');
            process.exit(1);
        }
        resources = loaded;
        console.log('  ✅ [EN] Restored resources successfully!');
        console.log('  ✅ [KO] 백업 리소스를 정상적으로 불러왔습니다.');
        console.log(`     - BLOG_DB: ${resources.d1.BLOG_DB.name} (${resources.d1.BLOG_DB.id})`);
        console.log(`     - USER_DB: ${resources.d1.USER_DB.name} (${resources.d1.USER_DB.id})`);
        console.log(`     - IMAGES_KV: ${resources.kv.IMAGES_KV}`);
    } else {
        // ── Step 3: Resource Creation ──
        console.log('\n─── Step 3/7: Creating Cloudflare Resources (리소스 생성 및 연결) ───');
        let freshInit = false;
        const randomSuffix = generateRandomId(6);
        const defaultBlogDbName = `blog-db-${randomSuffix}`;
        const defaultUserDbName = `user-db-${randomSuffix}`;
        const defaultImagesKvName = `blog-images-kv-${randomSuffix}`;

        let blogDbName = defaultBlogDbName;
        let userDbName = defaultUserDbName;
        let imagesKvName = defaultImagesKvName;

        if (isSelectMode) {
            console.log('  [EN] Select Initialization Mode:');
            console.log('    1: Fresh Install (DELETE existing Cloudflare D1/KV databases and start clean)');
            console.log('    2: Keep Existing Data (Use existing Cloudflare databases to preserve your posts/data)');
            console.log('  [KO] 초기화 모드 선택:');
            console.log('    1: 완전 초기화 (기존 클라우드플레어의 D1/KV 데이터베이스를 모두 삭제하고 새로 생성합니다. 데이터 유실 주의!)');
            console.log('    2: 기존 데이터 유지 (기존에 구축된 클라우드플레어 리소스를 그대로 유지하고 연동합니다.)\n');
            console.log('  [EN] Choose an option (1/2) [Default: 2]');
            console.log('  [KO] 옵션을 선택하세요 (1/2) [기본값: 2]');
            const initChoice = await ask('  > ');
            freshInit = initChoice.trim() === '1';

            console.log('\n  [EN] Configure Resource Names');
            console.log('  [KO] 리소스 이름 설정');

            console.log(`  [EN] Enter Blog DB name [Default: ${defaultBlogDbName}]`);
            console.log('  [KO] 블로그 DB 이름을 입력하세요');
            const blogDbNameInput = await ask('  > ');

            console.log(`  [EN] Enter User DB name [Default: ${defaultUserDbName}]`);
            console.log('  [KO] 유저 DB 이름을 입력하세요');
            const userDbNameInput = await ask('  > ');

            console.log(`  [EN] Enter Images KV name [Default: ${defaultImagesKvName}]`);
            console.log('  [KO] 이미지 KV 이름을 입력하세요');
            const imagesKvNameInput = await ask('  > ');

            blogDbName = blogDbNameInput.trim() || defaultBlogDbName;
            userDbName = userDbNameInput.trim() || defaultUserDbName;
            imagesKvName = imagesKvNameInput.trim() || defaultImagesKvName;
        } else {
            console.log('  📦 [EN] Using default resource names & keeping existing data...');
            console.log('  📦 [KO] 기본 리소스명을 사용하며 기존 데이터를 유지합니다...');
        }

        // Fetch existing lists if keeping data
        let existingD1 = [];
        let existingKV = [];
        if (!freshInit) {
            try {
                const d1ListOut = runCapture(`${NPX} wrangler d1 list --json`, { silent: true });
                existingD1 = JSON.parse(d1ListOut);

                const kvListOut = runCapture(`${NPX} wrangler kv namespace list`, { silent: true });
                existingKV = JSON.parse(kvListOut);
            } catch (e) {
                console.log('  ⚠ Could not fetch existing resources automatically. Falling back to creation.');
            }
        }

        // D1: blog-db
        console.log(`\n  📦 Setting up D1: ${blogDbName}...`);
        let blogDb = existingD1.find(d => d.name === blogDbName);
        if (!freshInit && blogDb) {
            resources.d1.BLOG_DB = { name: blogDbName, id: blogDb.uuid };
            console.log(`  ✅ Found existing ${blogDbName}: ${blogDb.uuid}`);
        } else {
            if (freshInit) runCapture(`${NPX} wrangler d1 delete ${blogDbName} --skip-confirmation`, { ignoreError: true });
            const blogDbOut = runCapture(`${NPX} wrangler d1 create ${blogDbName}`, { ignoreError: true });
            const blogDbId = parseD1Id(blogDbOut);
            if (blogDbId) {
                resources.d1.BLOG_DB = { name: blogDbName, id: blogDbId };
                console.log(`  ✅ ${blogDbName} created: ${blogDbId}`);
            }
        }

        // D1: user-db
        console.log(`\n  📦 Setting up D1: ${userDbName}...`);
        let userDb = existingD1.find(d => d.name === userDbName);
        if (!freshInit && userDb) {
            resources.d1.USER_DB = { name: userDbName, id: userDb.uuid };
            console.log(`  ✅ Found existing ${userDbName}: ${userDb.uuid}`);
        } else {
            if (freshInit) runCapture(`${NPX} wrangler d1 delete ${userDbName} --skip-confirmation`, { ignoreError: true });
            const userDbOut = runCapture(`${NPX} wrangler d1 create ${userDbName}`, { ignoreError: true });
            const userDbId = parseD1Id(userDbOut);
            if (userDbId) {
                resources.d1.USER_DB = { name: userDbName, id: userDbId };
                console.log(`  ✅ ${userDbName} created: ${userDbId}`);
            }
        }

        // KV: IMAGES_KV (We ignore BLOG_CACHE per user request)
        console.log(`\n  📦 Setting up KV: ${imagesKvName}...`);
        let blogImagesKv = existingKV.find(k => k.title === imagesKvName);
        if (!freshInit && blogImagesKv) {
            resources.kv.IMAGES_KV = blogImagesKv.id;
            console.log(`  ✅ Found existing ${imagesKvName}: ${blogImagesKv.id}`);
        } else {
            const imagesKvOut = runCapture(`${NPX} wrangler kv namespace create ${imagesKvName}`, { ignoreError: true });
            const imagesKvId = parseKVId(imagesKvOut);
            if (imagesKvId) {
                resources.kv.IMAGES_KV = imagesKvId;
                console.log(`  ✅ ${imagesKvName} created: ${imagesKvId}`);
            }
        }
    }

    // ── Update wrangler.json files ──
    updateWranglerJson('apps/blog', resources);
    updateWranglerJson('apps/admin', resources);

    // ── Step 4: Pre-create Cloudflare Pages Projects (프로젝트 사전 생성 - 1타 배포 핵심) ──
    console.log('\n─── Step 4/7: Pre-creating Pages Projects (배포 프로젝트 사전 생성) ───');
    const createProject = (projName) => {
        console.log(`  🏗️ Registering/Verifying project '${projName}' on Cloudflare...`);
        const result = runCapture(`${NPX} wrangler pages project create ${projName} --production-branch main`, { silent: true });
        if (result.includes('already exists') || result.toLowerCase().includes('conflict') || result.toLowerCase().includes('error')) {
            console.log(`  ℹ️ [${projName}] [EN] Project already exists on Cloudflare. Syncing env variables and preparing redeploy.`);
            console.log(`  ℹ️ [${projName}] [KO] 프로젝트가 이미 Cloudflare에 존재합니다. 해당 프로젝트의 환경변수를 업데이트하고 덮어쓰기 재배포를 진행합니다.`);
        } else {
            console.log(`  ✅ [${projName}] [EN] Project successfully created on Cloudflare.`);
            console.log(`  ✅ [${projName}] [KO] 프로젝트가 Cloudflare 상에 성공적으로 신규 생성되었습니다.`);
        }
    };
    createProject(blogProjectName);
    createProject(adminProjectName);

    // ── Step 5: Sync Environment Secrets (비밀 환경변수 선제 주입) ──
    console.log('\n─── Step 5/7: Syncing Environment Secrets (비밀 환경변수 선제 동기화) ───');

    // Cloudflare CDN Cache Purge 설정 문의 프롬프트
    let setupCdn = 'n';
    if (isSelectMode) {
        console.log('  [EN] Configure Cloudflare CDN cache purge credentials?');
        console.log('  [KO] CDN 캐시 퍼지 설정을 등록하시겠습니까?');
        console.log('  [EN] (y/N) [Default: N]');
        console.log('  [KO] (y/N) [기본값: N]');
        setupCdn = await ask('  > ');
    }
    if (setupCdn.toLowerCase() === 'y') {
        console.log('\n  [EN] You can find your Zone ID in the Cloudflare Dashboard Overview sidebar (bottom right).');
        console.log('       Create a Cache Purge API Token at: https://dash.cloudflare.com/profile/api-tokens');
        console.log('  [KO] Cloudflare 대시보드 Overview 화면 우측 하단에서 Zone ID를 확인할 수 있습니다.');
        console.log('       캐시 퍼지 API 토큰 생성 주소: https://dash.cloudflare.com/profile/api-tokens');
        
        console.log('  [EN] Enter Cloudflare Zone ID');
        console.log('  [KO] Zone ID를 입력하세요');
        const zoneId = await ask('  > ');

        console.log('  [EN] Enter Cloudflare API Token (with Cache Purge permission)');
        console.log('  [KO] API 토큰을 입력하세요');
        const apiToken = await ask('  > ');
        
        if (zoneId && apiToken) {
            const appendEnvSecret = (varsPath) => {
                if (existsSync(varsPath)) {
                    let content = readFileSync(varsPath, 'utf-8');
                    if (content.includes('CLOUDFLARE_ZONE_ID=')) {
                        content = content.replace(/CLOUDFLARE_ZONE_ID=.*/g, `CLOUDFLARE_ZONE_ID=${zoneId}`);
                    } else {
                        content = content.trimEnd() + `\nCLOUDFLARE_ZONE_ID=${zoneId}\n`;
                    }
                    if (content.includes('CLOUDFLARE_API_TOKEN=')) {
                        content = content.replace(/CLOUDFLARE_API_TOKEN=.*/g, `CLOUDFLARE_API_TOKEN=${apiToken}`);
                    } else {
                        content = content.trimEnd() + `\nCLOUDFLARE_API_TOKEN=${apiToken}\n`;
                    }
                    writeFileSync(varsPath, content, 'utf-8');
                    console.log(`  ✅ Updated CDN secrets in ${varsPath}`);
                }
            };
            appendEnvSecret(blogVarsPath);
            appendEnvSecret(adminVarsPath);
        } else {
            console.log('  ⚠ Verification skipped due to empty credentials.');
        }
    }

    // Upload secrets first while projects are already pre-created on Cloudflare
    const setupEnv = { ...process.env, IS_SETUP: 'true' };
    run(`node scripts/sync-secrets.js apps/blog ${blogProjectName} --skip-db`, { cwd: ROOT, ignoreError: true, env: setupEnv });
    run(`node scripts/sync-secrets.js apps/admin ${adminProjectName} --skip-db`, { cwd: ROOT, ignoreError: true, env: setupEnv });

    // ── Step 6: DB Migrations ──
    console.log('\n─── Step 6/7: Running DB Migrations (데이터베이스 마이그레이션 진행) ───');

    const migrationsDir = resolve(ROOT, 'packages/shared/migrations');

    // Windows: convert backslashes to forward slashes to avoid escaping issues in shell
    const blogDbSql = resolve(migrationsDir, 'schema-blog-db.sql').replace(/\\/g, '/');
    const userDbSql = resolve(migrationsDir, 'schema-user-db.sql').replace(/\\/g, '/');

    if (isRestore) {
        console.log('  [EN] Restore Mode: Safely syncing DB Schema. Seed data execution will be skipped.');
        console.log('  [KO] 복구 모드: 데이터베이스 스키마(뼈대)를 안전하게 동기화합니다. 기존 데이터 보존을 위해 초기 시드(Seed) 실행은 생략합니다.');

        if (resources.d1.BLOG_DB) {
            const blogDbName = resources.d1.BLOG_DB.name;
            console.log(`  Syncing ${blogDbName} Schema...`);
            run(`${NPX} wrangler d1 execute ${blogDbName} --remote --yes --file "${blogDbSql}"`, { ignoreError: false });
        }
        if (resources.d1.USER_DB) {
            const userDbName = resources.d1.USER_DB.name;
            console.log(`  Syncing ${userDbName} Schema...`);
            run(`${NPX} wrangler d1 execute ${userDbName} --remote --yes --file "${userDbSql}"`, { ignoreError: false });
        }
    } else {
        const blogSeedSql = resolve(migrationsDir, `seed-${selectedLang}.sql`).replace(/\\/g, '/');

        if (resources.d1.BLOG_DB) {
            const blogDbName = resources.d1.BLOG_DB.name;
            console.log(`  Running ${blogDbName} migration (Schema)...`);
            run(`${NPX} wrangler d1 execute ${blogDbName} --remote --yes --file "${blogDbSql}"`, { ignoreError: false });

            console.log(`  Seeding ${blogDbName} with ${selectedLang.toUpperCase()} default...`);
            run(`${NPX} wrangler d1 execute ${blogDbName} --remote --yes --file "${blogSeedSql}"`, { ignoreError: false });
        }

        if (resources.d1.USER_DB) {
            const userDbName = resources.d1.USER_DB.name;
            console.log(`  Running ${userDbName} migration...`);
            run(`${NPX} wrangler d1 execute ${userDbName} --remote --yes --file "${userDbSql}"`, { ignoreError: false });
        }
    }

    // ── Step 6.5: Synchronize Deploy Config into D1 Database (마이그레이션 완료 후 설정 동기화) ──
    console.log('\n─── Step 6.5: Syncing Deploy Configuration to D1 Database (데이터베이스 설정 동기화) ───');
    const syncEnv = { ...process.env, IS_SETUP: 'true' };
    run(`node scripts/sync-secrets.js apps/blog ${blogProjectName}`, { cwd: ROOT, ignoreError: false, env: syncEnv });
    run(`node scripts/sync-secrets.js apps/admin ${adminProjectName}`, { cwd: ROOT, ignoreError: false, env: syncEnv });

    // ── Step 7: Build & Deploy to Cloudflare Pages (통합 빌드 및 배포 완료) ──
    console.log('\n─── Step 7/7: Deploy to Cloudflare Pages (클라우드플레어 배포) ───');
    let deployChoice = 'y';
    let blogDeployUrl = `https://${blogProjectName}.pages.dev`;
    let adminDeployUrl = `https://${adminProjectName}.pages.dev`;
    if (isSelectMode) {
        console.log('  [EN] Deploy directly?');
        console.log('  [KO] 지금 바로 배포하시겠습니까?');
        console.log('  [EN] (Y/n) [Default: Y]');
        console.log('  [KO] (Y/n) [기본값: Y]');
        deployChoice = await ask('  > ');
    }
    if (deployChoice.toLowerCase() !== 'n') {
        console.log('\n  🏗️ [EN] Building apps...');
        console.log('  🏗️ [KO] 앱 빌드 중...');
        run(`npm run build:all`, { cwd: ROOT, ignoreError: false });

        console.log(`\n  🚀 [EN] Deploying blog to ${blogProjectName}...`);
        console.log(`  🚀 [KO] 블로그 배포 중...`);
        const blogDeployOut = runCapture(`${NPX} wrangler pages deploy .svelte-kit/cloudflare --project-name ${blogProjectName}`, { cwd: resolve(ROOT, 'apps/blog') });
        console.log(blogDeployOut);
        blogDeployUrl = getRepresentativeUrl(blogDeployOut, blogProjectName);

        console.log(`  🚀 [EN] Deploying admin to ${adminProjectName}...`);
        console.log(`  🚀 [KO] 어드민 배포 중...`);
        const adminDeployOut = runCapture(`${NPX} wrangler pages deploy .svelte-kit/cloudflare --project-name ${adminProjectName}`, { cwd: resolve(ROOT, 'apps/admin') });
        console.log(adminDeployOut);
        adminDeployUrl = getRepresentativeUrl(adminDeployOut, adminProjectName);
    } else {
        console.log('  [EN] Skipping deployment. / [KO] 배포를 건너뜁니다.');
    }

    // Auto-save backup file after successful wrangler.json updates and migrations
    saveBackupResources(resources, blogProjectName, adminProjectName);

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  [EN] ✅ ${isRestore ? 'Restore' : 'Setup'} & Deploy Complete!                  ║`);
    console.log(`║  [KO] ✅ ${isRestore ? '복구' : '설정'} 및 배포가 성공적으로 완료되었습니다!   ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  [ℹ] Your bindings and secrets have                  ║');
    console.log('║      been fully automated in a single execution!    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (deployChoice.toLowerCase() !== 'n') {
        console.log('  🌐 [EN] Service Access URLs:');
        console.log('  🌐 [KO] 서비스 접속 주소:');
        console.log(`     - Blog / 블로그 : ${blogDeployUrl}`);
        console.log(`     - Admin / 어드민 : ${adminDeployUrl}\n`);
    }
}

main().catch((e) => {
    console.error('\n❌ Setup failed:', e.message);
    process.exit(1);
});
