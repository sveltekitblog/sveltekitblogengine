import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, copyFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const appPath = process.argv[2];
const projectName = process.argv[3];
const skipDb = process.argv.includes('--skip-db');

if (!appPath || !projectName) {
    console.error('Usage: node scripts/sync-secrets.js <appPath> <projectName> [--skip-db]');
    process.exit(1);
}

// ── 클라우드플레어 로그인 상태 검증 및 안전한 로그인 연동 ──
const isWin = process.platform === 'win32';
const NPX = isWin ? 'npx.cmd' : 'npx';

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function checkWranglerLogin() {
    if (process.env.CLOUDFLARE_API_TOKEN) {
        return true;
    }
    try {
        const result = execSync(`${NPX} wrangler whoami`, { encoding: 'utf-8', stdio: 'pipe' });
        if (result.includes('You are not logged in') || result.includes('Authentication Error') || result.toLowerCase().includes('error')) {
            return false;
        }
        return result.includes('@') || result.includes('Account') || result.includes('Logged in');
    } catch (e) {
        return false;
    }
}

const isLoggedIn = checkWranglerLogin();
if (!isLoggedIn) {
    console.log('\n🔐 [EN] No valid Cloudflare session detected. Running secure login with minimal scopes...');
    console.log('   [KO] 유효한 클라우드플레어 로그인 세션이 없습니다. 최소 권한으로 로그인을 실행합니다...');
    spawnSync(NPX, ['wrangler', 'login', '--scopes', 'account:read', 'user:read', 'workers:write', 'pages:write', 'd1:write', 'workers_kv:write'], {
        stdio: 'inherit',
        shell: true
    });
}

// ── wrangler.backup.json DB Synchronizer ──
const pkgPath = resolve(ROOT, 'package.json');
let blogProjectName = 'cf-blog';
let adminProjectName = 'cf-admin';

if (existsSync(pkgPath)) {
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.['deploy:blog']) {
            const match = pkg.scripts['deploy:blog'].match(/--project-name\s+([^\s&]+)/);
            if (match?.[1]) blogProjectName = match[1];
        }
        if (pkg.scripts?.['deploy:admin']) {
            const match = pkg.scripts['deploy:admin'].match(/--project-name\s+([^\s&]+)/);
            if (match?.[1]) adminProjectName = match[1];
        }
    } catch (e) {
        console.warn('⚠ Failed to parse package.json for project names:', e.message);
    }
}

const blogWranglerPath = resolve(ROOT, 'apps/blog/wrangler.json');
let d1Config = null;
let kvConfig = null;

if (existsSync(blogWranglerPath)) {
    try {
        const blogWrangler = JSON.parse(readFileSync(blogWranglerPath, 'utf-8'));
        if (blogWrangler.d1_databases) {
            d1Config = {};
            blogWrangler.d1_databases.forEach(db => {
                d1Config[db.binding] = { name: db.database_name, id: db.database_id };
            });
        }
        if (blogWrangler.kv_namespaces) {
            kvConfig = {};
            blogWrangler.kv_namespaces.forEach(kv => {
                kvConfig[kv.binding] = kv.id;
            });
        }
    } catch (e) {
        console.warn('⚠ Failed to parse apps/blog/wrangler.json:', e.message);
    }
}

if (!d1Config || !kvConfig) {
    const adminWranglerPath = resolve(ROOT, 'apps/admin/wrangler.json');
    if (existsSync(adminWranglerPath)) {
        try {
            const adminWrangler = JSON.parse(readFileSync(adminWranglerPath, 'utf-8'));
            if (!d1Config && adminWrangler.d1_databases) {
                d1Config = {};
                adminWrangler.d1_databases.forEach(db => {
                    d1Config[db.binding] = { name: db.database_name, id: db.database_id };
                });
            }
            if (!kvConfig && adminWrangler.kv_namespaces) {
                kvConfig = {};
                adminWrangler.kv_namespaces.forEach(kv => {
                    kvConfig[kv.binding] = kv.id;
                });
            }
        } catch (e) {
            console.warn('⚠ Failed to parse apps/admin/wrangler.json:', e.message);
        }
    }
}

if (d1Config && kvConfig && !skipDb) {
    const deployConfig = {
        d1: d1Config,
        kv: kvConfig,
        blogProjectName,
        adminProjectName
    };

    const blogDbName = d1Config.BLOG_DB?.name;
    if (blogDbName) {
        // ─── i18n Dictionary Interactive Sync ───
        if (appPath.includes('admin')) {
            try {
                const isSetup = process.env.IS_SETUP === 'true';
                let syncChoice = 'n';
                if (isSetup) {
                    syncChoice = 'y';
                } else {
                    console.log('\n======================================================');
                    console.log('[EN] Force sync remote D1 ui_dictionary with local index.ts? (Web changes will be lost)');
                    console.log('[KO] D1 DB의 ui_dictionary를 로컬 index.ts 기준으로 강제 덮어쓰시겠습니까? (웹 수정본 유실 주의)');
                    console.log('  [EN] Select option (y/N) [Default: N]');
                    console.log('  [KO] 옵션을 선택하세요 (y/N) [기본값: N]');
                    syncChoice = await ask('  > ');
                }
                
                if (syncChoice.toLowerCase() === 'y') {
                    console.log('🔄 Parsing local i18n/index.ts dictionary data...');
                    const i18nFilePath = resolve(ROOT, 'packages/shared/src/i18n/index.ts');
                    if (existsSync(i18nFilePath)) {
                        const i18nContent = readFileSync(i18nFilePath, 'utf-8');
                        const match = i18nContent.match(/export\s+const\s+fallbackDictionary[^=]*=\s*(\{[\s\S]+?\});/m);
                        if (match) {
                            const rawObj = new Function(`return ${match[1]}`)();
                            const jsonStr = JSON.stringify(rawObj);
                            
                            const chunkSize = 20000;
                            const chunks = [];
                            for (let i = 0; i < jsonStr.length; i += chunkSize) {
                                chunks.push(jsonStr.substring(i, i + chunkSize));
                            }
                            
                            let sqlCmd = '';
                            const firstChunkEscaped = chunks[0].replace(/'/g, "''");
                            sqlCmd += `INSERT OR REPLACE INTO blog_settings (key, value, updated_at) VALUES ('ui_dictionary', '${firstChunkEscaped}', datetime('now', '+9 hours'));\n`;
                            
                            for (let i = 1; i < chunks.length; i++) {
                                const chunkEscaped = chunks[i].replace(/'/g, "''");
                                sqlCmd += `UPDATE blog_settings SET value = value || '${chunkEscaped}' WHERE key = 'ui_dictionary';\n`;
                            }
                            
                            const tempI18nSql = resolve(ROOT, 'temp-deploy-i18n.sql');
                            writeFileSync(tempI18nSql, sqlCmd, 'utf-8');
                            
                            console.log(`🚀 Forcing i18n sync into D1 database '${blogDbName}'...`);
                            execSync(`${NPX} wrangler d1 execute ${blogDbName} --remote --yes --file "${tempI18nSql.replace(/\\/g, '/')}"`, {
                                cwd: ROOT,
                                stdio: 'inherit'
                            });
                            console.log('✅ i18n Dictionary sync completed successfully.');
                            if (existsSync(tempI18nSql)) unlinkSync(tempI18nSql);
                        } else {
                            console.warn('⚠ Could not find fallbackDictionary block in index.ts.');
                        }
                    } else {
                        console.warn(`⚠ index.ts not found at: ${i18nFilePath}`);
                    }
                } else {
                    console.log('⏭️ Skipping i18n dictionary force-sync (keeping existing DB dictionary).');
                }
            } catch (e) {
                console.warn('⚠ Failed to sync i18n dictionary to D1:', e.message);
            }
        }

        const tempSqlFile = resolve(ROOT, 'temp-deploy-config.sql');
        try {
            const configJsonStr = JSON.stringify(deployConfig).replace(/'/g, "''"); // SQL escape single quotes
            const sqlCmd = `INSERT OR REPLACE INTO blog_settings (key, value, updated_at) VALUES ('deploy_config', '${configJsonStr}', datetime('now', '+9 hours'));`;
            writeFileSync(tempSqlFile, sqlCmd, 'utf-8');
            
            const isWin = process.platform === 'win32';
            const NPX = isWin ? 'npx.cmd' : 'npx';
            
            console.log(`\n📦 Synchronizing deploy configuration into D1 database '${blogDbName}'...`);
            execSync(`${NPX} wrangler d1 execute ${blogDbName} --remote --yes --file "${tempSqlFile.replace(/\\/g, '/')}"`, {
                cwd: ROOT,
                stdio: 'inherit'
            });
            console.log('✅ Synchronized deploy configuration to D1 successfully.');
        } catch (e) {
            console.warn('⚠ Failed to sync deploy configuration to D1 database:', e.message);
        } finally {
            if (existsSync(tempSqlFile)) {
                try { unlinkSync(tempSqlFile); } catch (e) {}
            }
        }
    } else {
        console.warn('⚠ BLOG_DB name not resolved. Cannot sync deploy configuration to D1.');
    }
} else {
    console.warn('⚠ Could not retrieve bindings from wrangler.json. Deploy config sync skipped.');
}

const devVarsPath = resolve(ROOT, appPath, '.dev.vars');
if (!existsSync(devVarsPath)) {
    console.log(`\n⚠️  [EN] [Warning] No .dev.vars file found for Pages project '${projectName}' at '${appPath}'`);
    console.log(`        Please copy '${appPath}/.dev.vars.example' to '${appPath}/.dev.vars' and fill in the required keys.`);
    console.log(`        - Required for Blog (apps/blog): BETTER_AUTH_SECRET`);
    console.log(`        - Required for Admin (apps/admin): ADMIN_PASSWORD`);
    console.log(`        (Note: For the very first deployment, secrets will be synced once you create .dev.vars and redeploy.)`);
    console.log(`\n   [KO] [경고] '${appPath}' 경로에서 Pages 프로젝트 '${projectName}'를 위한 .dev.vars 파일을 찾을 수 없습니다.`);
    console.log(`        '${appPath}/.dev.vars.example' 파일을 복사하여 '${appPath}/.dev.vars' 파일을 생성하고 필수 값을 기입해주세요.`);
    console.log(`        - 블로그 필수 키 (apps/blog): BETTER_AUTH_SECRET`);
    console.log(`        - 어드민 필수 키 (apps/admin): ADMIN_PASSWORD`);
    console.log(`        (참고: 최초 인프라 생성 및 배포 시에는 Pages 프로젝트가 먼저 생성된 이후에 .dev.vars를 만들고 다시 배포해야 비밀값이 동기화됩니다.)\n`);
    process.exit(0);
}

// 🔒 Admin IP auto-detection: detect public IP and write ALLOWED_IP to .dev.vars
if (appPath.includes('admin')) {
    let devVarsContent = existsSync(devVarsPath) ? readFileSync(devVarsPath, 'utf-8') : '';
    
    // 기존 ALLOWED_IP 설정값 파싱
    const existingIpMatch = devVarsContent.match(/^ALLOWED_IP\s*=\s*(.+)$/m);
    const existingIP = existingIpMatch ? existingIpMatch[1].trim() : null;

    console.log('\n🔒 Checking IP address for admin access control...');
    let publicIP = null;
    try {
        const traceRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const traceText = await traceRes.text();
        const ipMatch = traceText.match(/ip=(.+)/);
        if (ipMatch) {
            publicIP = ipMatch[1].trim();
        }
    } catch (e) {
        console.log('  ⚠ Could not detect public IP. Skipping IP checks.');
    }

    if (publicIP) {
        let finalIP = existingIP;

        if (!existingIP) {
            // 기존 IP가 없는 경우 현재 감지된 IP 자동 등록
            console.log(`  ✅ No allowed IP registered. Automatically setting to current IP: ${publicIP}`);
            finalIP = publicIP;
        } else {
            const allowedIPs = existingIP.split(/[\s,]+/).map(ip => ip.trim()).filter(Boolean);
            
            if (!allowedIPs.includes(publicIP)) {
                // 기존 목록에 현재 배포 기기 IP가 없는 경우
                console.log('\n╔══════════════════════════════════════════════════════╗');
                console.log('║  ⚠️  [IP Mismatch Warning / IP 불일치 감지]           ║');
                console.log('╚══════════════════════════════════════════════════════╝');
                console.log('  [KO] 현재 배포 기기의 IP가 허용 목록에 등록되어 있지 않습니다.');
                console.log(`       - 기존 허용 IP 목록: ${existingIP}`);
                console.log(`       - 현재 배포 기기 IP: ${publicIP}`);
                console.log('  ──────────────────────────────────────────────────────');
                console.log('  [EN] The current machine IP is not in the ALLOWED_IP list.');
                console.log(`       - Registered IPs: ${existingIP}`);
                console.log(`       - Current IP    : ${publicIP}\n`);

                console.log('  1) Keep existing allowed IPs / 기존 목록 유지 (현재 기기 미등록) [Default]');
                console.log(`  2) Add current machine IP to list / 현재 기기 IP를 목록에 추가 (복수 허용)`);
                console.log(`  3) Replace with current machine IP / 현재 기기 IP로만 갱신 (기존 목록 제거)\n`);
                console.log('  [EN] Select option (1/2/3) [Default: 1]');
                console.log('  [KO] 옵션을 선택하세요 (1/2/3) [기본값: 1]');
                const choice = await ask('  > ');
                if (choice === '2') {
                    allowedIPs.push(publicIP);
                    finalIP = allowedIPs.join(', ');
                    console.log(`  ✅ Current IP added. New allowed list: ${finalIP}`);
                } else if (choice === '3') {
                    finalIP = publicIP;
                    console.log(`  ✅ List replaced with current machine IP: ${publicIP}`);
                } else {
                    finalIP = existingIP;
                    console.log(`  ✅ Keeping existing allowed list: ${existingIP}`);
                }
            } else {
                console.log(`  ✅ Current machine IP is already included in the allowed list: ${existingIP}`);
            }
        }

        if (finalIP) {
            if (devVarsContent.includes('ALLOWED_IP=')) {
                devVarsContent = devVarsContent.replace(/ALLOWED_IP=.*/g, `ALLOWED_IP=${finalIP}`);
            } else {
                devVarsContent = devVarsContent.trimEnd() + `\nALLOWED_IP=${finalIP}\n`;
            }
            writeFileSync(devVarsPath, devVarsContent);
        }
    }
}

console.log(`\n🔐 Syncing secrets from ${appPath}/.dev.vars to Pages project ${projectName}...`);

const content = readFileSync(devVarsPath, 'utf-8');
const secrets = {};
content.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip empty lines or lines starting with # or //
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            if (key && val) {
                // Remove quotes if present
                let cleanVal = val;
                if ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
                    cleanVal = cleanVal.substring(1, cleanVal.length - 1);
                }
                secrets[key] = cleanVal;
            }
        }
    }
});

// ALLOWED_IP가 DISABLE 또는 OFF로 정의되어 있으면 원격 Secret 전송 리스트에서 제외
if (secrets['ALLOWED_IP'] && (secrets['ALLOWED_IP'].toLowerCase() === 'disable' || secrets['ALLOWED_IP'].toLowerCase() === 'off')) {
    console.log('  🚫 ALLOWED_IP is set to DISABLE/OFF. Removing from sync secrets list.');
    delete secrets['ALLOWED_IP'];
}

if (Object.keys(secrets).length === 0) {
    console.log('ℹ No valid secrets found in .dev.vars');
    process.exit(0);
}

const tempJsonPath = resolve(ROOT, appPath, 'temp-secrets.json');
writeFileSync(tempJsonPath, JSON.stringify(secrets));

try {
    const isWin = process.platform === 'win32';
    const NPX = isWin ? 'npx.cmd' : 'npx';
    // Use --yes to skip confirmation if any
    execSync(`${NPX} wrangler pages secret bulk temp-secrets.json --project-name ${projectName}`, {
        cwd: resolve(ROOT, appPath),
        stdio: 'inherit'
    });
    console.log('✅ Secrets synced successfully.');
} catch (e) {
    console.log(`\n  ⚠ Warning: Could not sync secrets for ${projectName}. This is normal if the project hasn't been created yet or if you lack permissions.`);
} finally {
    if (existsSync(tempJsonPath)) {
        unlinkSync(tempJsonPath);
    }
}
