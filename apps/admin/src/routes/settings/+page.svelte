<!--
 Copyright (C) 2026 kimteamjang

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<script lang="ts">
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import { Settings, Save, Globe, LayoutDashboard, Code, UserCog, Shield, Download, Upload, AlertTriangle, RefreshCcw } from "lucide-svelte";
    import { t } from "$lib/i18n.svelte";
    import { SOCIAL_PROVIDER_META, PRIMARY_PROVIDERS, EXTRA_PROVIDERS } from "@blog/shared";

    let { data, form }: { data: PageData, form: ActionData } = $props();

    import { untrack } from "svelte";
    let isSubmitting = $state(false);

    // --- Multilingual Setup ---
    let languages = untrack(() => data.languages || []);
    let activeLang = $state(untrack(() => languages.length > 0 ? (languages.find((l: any) => l.is_default)?.code || languages[0].code) : 'ko'));

    function safeParse(jsonStr: string) {
        try {
            const parsed = JSON.parse(jsonStr || '{}');
            if (typeof parsed !== 'object' || parsed === null) {
                return { ko: String(parsed || '') };
            }
            return parsed;
        } catch {
            // Un-migrated raw string fallback
            return { ko: jsonStr || '' }; 
        }
    }

    let siteTitleTranslations: Record<string, string> = $state(untrack(() => safeParse(data.settings.site_title)));
    let descriptionTranslations: Record<string, string> = $state(untrack(() => safeParse(data.settings.description)));
    let authorNameTranslations: Record<string, string> = $state(untrack(() => safeParse(data.settings.authorName)));

    // Ensure all active languages have a key
    for (const l of languages) {
        if (siteTitleTranslations[l.code] === undefined) siteTitleTranslations[l.code] = '';
        if (descriptionTranslations[l.code] === undefined) descriptionTranslations[l.code] = '';
        if (authorNameTranslations[l.code] === undefined) authorNameTranslations[l.code] = '';
    }

    let siteTitleJson = $derived(JSON.stringify(siteTitleTranslations));
    let descriptionJson = $derived(JSON.stringify(descriptionTranslations));
    let authorNameJson = $derived(JSON.stringify(authorNameTranslations));

    // --- Admin Account Management ---
    let adminUser = $state(untrack(() => data.adminUser));
    let adminDisplayName = $state(untrack(() => adminUser?.name || ''));
    let adminEmail = $state(untrack(() => adminUser?.email || ''));
    let adminPassword = $state('');
    let adminPasswordConfirm = $state('');
    let isCreatingAdmin = $state(false);
    let adminActionResult = $state<{ success?: boolean; error?: string } | null>(null);

    // --- Auth Provider Management ---
    let authProviders: string[] = $state(
        (() => { try { return JSON.parse(data.settings.auth_providers || '[]'); } catch { return []; } })()
    );
    let showExtraProviders = $state(false);
    let authProvidersJson = $derived(JSON.stringify(authProviders));

    // 세계 시간대 데이터 로드 및 네이티브 Datalist 바인딩 상태
    let selectedTimezone = $state(untrack(() => data.settings.timezone || 'Asia/Seoul'));
    const allTimezones = Intl.supportedValuesOf('timeZone');

    function toggleProvider(code: string) {
        if (authProviders.includes(code)) {
            authProviders = authProviders.filter(p => p !== code);
        } else {
            authProviders = [...authProviders, code];
        }
    }

    async function handleAdminAccount() {
        // Fallback name if none entered
        const defaultName = authorNameTranslations[activeLang] || authorNameTranslations['ko'] || Object.values(authorNameTranslations).find(v => v) || 'Admin';
        const finalName = adminDisplayName.trim() || defaultName;

        adminActionResult = null;

        // 관리자 계정이 없는 상태 (신규 가입 유효성 체크)
        if (!adminUser) {
            if (!adminEmail.trim() || !adminPassword || !adminPasswordConfirm) {
                adminActionResult = { error: t('blog.auth.error_input_required', { default: '이메일과 비밀번호를 입력해주세요.' }) };
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
                adminActionResult = { error: t('admin.settings.error_invalid_email', { default: '유효하지 않은 이메일 형식입니다.' }) };
                return;
            }
            if (adminPassword.length < 8) {
                adminActionResult = { error: t('admin.settings.error_password_length', { default: '비밀번호는 최소 8자 이상이어야 합니다.' }) };
                return;
            }
            if (adminPassword !== adminPasswordConfirm) {
                adminActionResult = { error: t('admin.settings.error_password_mismatch', { default: '비밀번호가 서로 일치하지 않습니다.' }) };
                return;
            }
        } else {
            // 기존 관리자 수정 상태 (선택적 패스워드 변경 체크)
            if (adminEmail.trim() !== adminUser.email) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
                    adminActionResult = { error: t('admin.settings.error_invalid_email', { default: '유효하지 않은 이메일 형식입니다.' }) };
                    return;
                }
            }
            if (adminPassword) {
                if (adminPassword.length < 8) {
                    adminActionResult = { error: t('admin.settings.error_password_length', { default: '비밀번호는 최소 8자 이상이어야 합니다.' }) };
                    return;
                }
                if (adminPassword !== adminPasswordConfirm) {
                    adminActionResult = { error: t('admin.settings.error_password_mismatch', { default: '비밀번호가 서로 일치하지 않습니다.' }) };
                    return;
                }
            }
        }

        isCreatingAdmin = true;
        try {
            const res = await fetch('/api/admin-account', {
                method: adminUser ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalName,
                    email: adminEmail.trim(),
                    password: adminPassword || undefined
                })
            });
            const result = await res.json();
            if (result.success) {
                adminActionResult = { success: true };
                adminUser = result.adminUser;
                adminDisplayName = result.adminUser.name;
                adminEmail = result.adminUser.email;
                adminPassword = '';
                adminPasswordConfirm = '';
            } else {
                adminActionResult = { error: t(result.error) || result.error || t('admin.settings.error_occurred', { default: '오류 발생' }) };
            }
        } catch (e: any) {
            adminActionResult = { error: e.message };
        } finally {
            isCreatingAdmin = false;
        }
    }

    // --- Backup & Restore ---
    let isBackupInProgress = $state(false);
    let isRestoreInProgress = $state(false);
    let restoreFileInput: HTMLInputElement;

    // [TODO_I18N] 다국어 표식 추가하여 캐시 단위 및 UI 제어 변수 선언
    function parseTtl(secondsStr: string) {
        const sec = Number(secondsStr) || 2592000;
        if (sec % 2592000 === 0) return { val: sec / 2592000, unit: 'months' };
        if (sec % 86400 === 0) return { val: sec / 86400, unit: 'days' };
        if (sec % 3600 === 0) return { val: sec / 3600, unit: 'hours' };
        return { val: Math.round(sec / 60), unit: 'minutes' };
    }

    let ttlParsed = parseTtl(untrack(() => data.settings.cdn_cache_ttl));
    let cdnCacheTtlVal = $state(ttlParsed.val);
    let cdnCacheTtlUnit = $state(ttlParsed.unit); // 'hours' | 'days' | 'months'

    let cdnCacheTtlJson = $derived(
        (() => {
            const val = Number(cdnCacheTtlVal) || 1;
            if (cdnCacheTtlUnit === 'months') return String(val * 2592000);
            if (cdnCacheTtlUnit === 'days') return String(val * 86400);
            if (cdnCacheTtlUnit === 'hours') return String(val * 3600);
            return String(val * 60); // minutes
        })()
    );

    let isPurging = $state(false);
    async function handleManualPurge() {
        if (!confirm(t('admin.settings.confirm_purge_all', { default: '전체 Edge 서버의 캐시를 강제로 비우시겠습니까? 서버에 일시적으로 부하가 늘어날 수 있습니다.' }))) return;
        isPurging = true;
        try {
            const res = await fetch('/api/purge-cache', { method: 'POST' });
            if (res.status === 401) {
                alert(t('admin.settings.error_unauthorized', { default: '권한이 없습니다. 로그인이 필요합니다.' }));
                return;
            }
            const result = await res.json();
            if (result.success) {
                alert(t('admin.settings.purge_success', { default: 'CDN 캐시 삭제 요청이 전송되었습니다. 반영까지 최대 30초가 소요될 수 있습니다.' }));
            } else {
                alert(t('admin.settings.purge_failed', { default: '캐시 삭제 실패' }) + ': ' + (result.error || 'Unknown'));
            }
        } catch (e: any) {
            alert(t('admin.settings.purge_failed', { default: '캐시 삭제 실패' }) + ': ' + e.message);
        } finally {
            isPurging = false;
        }
    }

    async function downloadFullBackup() {
        if (!confirm(t('admin.backup.full_backup_confirm') || '시스템 전체 백업을 진행하시겠습니까? 민감한 설정 정보가 모두 포함됩니다.')) return;
        isBackupInProgress = true;
        try {
            const res = await fetch('/api/backup?section=full');
            if (!res.ok) throw new Error('Backup failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
        } catch (e: any) {
            alert('Backup failed: ' + e.message);
        } finally {
            isBackupInProgress = false;
        }
    }

    async function handleFullRestore(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        if (!confirm(t('admin.backup.full_restore_confirm') || '시스템을 전체 복원하시겠습니까? 현재의 모든 데이터와 설정이 백업 파일의 내용으로 완전히 교체됩니다.')) return;

        isRestoreInProgress = true;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, backupType: 'full' })
            });
            const result = await res.json();
            
            if (result.success) {
                alert(t('admin.backup.restore_success') || '복원이 완료되었습니다. 페이지를 새로고침합니다.');
                window.location.reload();
            } else {
                alert((t('admin.backup.restore_failed') || '복원 실패') + ': ' + (result.error || 'Unknown error'));
            }
        } catch (e: any) {
            alert((t('admin.backup.restore_failed') || '복원 실패') + ': ' + e.message);
        } finally {
            isRestoreInProgress = false;
            if (restoreFileInput) restoreFileInput.value = '';
        }
    }
</script>

<div class="settings-container">
    <header class="page-header">
        <h1><Settings size={28} /> {t('admin.settings.title')}</h1>
        <p class="subtitle">{t('admin.settings.subtitle')}</p>
    </header>

    {#if form?.success}
        <div class="alert success">{t('admin.settings.saved')}</div>
    {/if}
    {#if form?.error}
        <div class="alert error">{form.error}</div>
    {/if}

    <!-- Language Tabs -->
    {#if languages.length > 0}
    <div class="lang-tabs pb-4 border-b border-gray-200 mb-6">
        <span class="text-sm text-gray-500 font-semibold mr-4">{t('admin.posts.write.edit_lang')}</span>
        <div class="flex gap-2">
            {#each languages as lang}
                <button
                    type="button"
                    class="lang-tab-btn {activeLang === lang.code ? 'active' : ''}"
                    onclick={() => activeLang = lang.code}
                >
                    <span class="lang-badge border">{lang.code.toUpperCase()}</span>
                    {lang.name}
                </button>
            {/each}
        </div>
    </div>
    {/if}

    <form 
        method="POST" 
        action="?/save" 
        use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
                await update({ reset: false });
                isSubmitting = false;
            };
        }}
        class="settings-form"
    >
        <!-- HIDDEN JSON FIELDS -->
        <input type="hidden" name="site_title" value={siteTitleJson} />
        <input type="hidden" name="description" value={descriptionJson} />
        <input type="hidden" name="authorName" value={authorNameJson} />
        <input type="hidden" name="cdn_cache_ttl" value={cdnCacheTtlJson} />
        <input type="hidden" name="auth_providers" value={authProvidersJson} />

        <div class="settings-grid">
            <!-- SEO 및 기본 정보 -->
            <section class="settings-card">
                <div class="card-header">
                    <Globe size={20} />
                    <h2>{t('admin.settings.basic_info_title')}</h2>
                    {#if languages.length > 0}
                        <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                            {t('admin.settings.editing', { lang: languages.find((l: any) => l.code === activeLang)?.name || activeLang })}
                        </span>
                    {/if}
                </div>
                <div class="card-body bg-slate-50 border-b border-slate-200">
                    <div class="form-group">
                        <label for="site_title_input">{t('admin.settings.site_title')} ({activeLang.toUpperCase()})</label>
                        <input type="text" id="site_title_input" bind:value={siteTitleTranslations[activeLang]} placeholder={t('admin.settings.site_title_placeholder', { default: '예: My Awesome Blog' })} />
                        <p class="text-xs text-blue-500 mt-1 font-medium">
                            💡 {t("admin.settings.site_title_sync_hint", { default: "이 값은 디자인 에디터의 '로고 텍스트'와 동기화됩니다." })}
                        </p>
                    </div>
                    <div class="form-group">
                        <label for="description_input">{t('admin.settings.site_desc')} ({activeLang.toUpperCase()})</label>
                        <textarea id="description_input" bind:value={descriptionTranslations[activeLang]} rows="3" placeholder={t('admin.settings.site_desc_placeholder')}></textarea>
                    </div>
                    <div class="form-group">
                        <label for="authorName_input">{t('admin.settings.author_name')} ({activeLang.toUpperCase()})</label>
                        <input type="text" id="authorName_input" bind:value={authorNameTranslations[activeLang]} placeholder={t('admin.settings.author_name_placeholder', { default: '예: 관리자' })} />
                    </div>
                </div>
                <div class="card-body">
                    <div class="form-group border-l-4 border-slate-300 pl-4">
                        <label for="siteUrl">{t('admin.settings.site_url')}</label>
                        <input type="url" id="siteUrl" name="siteUrl" value={data.settings.siteUrl} placeholder={t('admin.settings.site_url_placeholder', { default: '예: https://myblog.com' })} />
                        <p style="font-size: 0.8rem; color: #64748b; margin-top: 0.4rem; line-height: 1.4;">
                            💡 {t('admin.settings.site_url_hint')}<br>
                        </p>
                    </div>

                    <!-- 사이트 시간대 검색 및 선택 폼 (Datalist 표준 자동완성) -->
                    <div class="form-group border-l-4 border-slate-300 pl-4 mt-6">
                        <label for="timezone">{t('admin.settings.timezone_title')}</label>
                        <input 
                            type="text" 
                            id="timezone" 
                            name="timezone" 
                            list="timezone-list" 
                            bind:value={selectedTimezone} 
                            placeholder={t('admin.settings.timezone_search_placeholder')}
                            class="w-full p-2 border border-slate-200 rounded-lg bg-white"
                        />
                        <datalist id="timezone-list">
                            {#each allTimezones as tz}
                                <option value={tz}>{tz}</option>
                            {/each}
                        </datalist>
                        <p style="font-size: 0.8rem; color: #64748b; margin-top: 0.4rem; line-height: 1.4;">
                            💡 {t('admin.settings.timezone_hint')}
                        </p>
                    </div>
                </div>
            </section>

            <!-- 대시보드 표시 설정 -->
            <!-- 관리자 계정 섹션 -->
            <section class="settings-card">
                <div class="card-header">
                    <UserCog size={20} />
                    <h2>{t('admin.settings.admin_account_title')}</h2>
                </div>
                <div class="card-body">
                    {#if adminUser}
                        <div class="admin-account-info">
                            <div class="admin-info-row">
                                <span class="admin-info-label">ID</span>
                                <code class="admin-info-value-code">{adminUser.id}</code>
                            </div>
                            <div class="admin-info-row" style="margin-bottom: 1rem;">
                                <span class="admin-info-label">{t('admin.settings.admin_account_name')}</span>
                                <input 
                                    type="text" 
                                    bind:value={adminDisplayName} 
                                    placeholder={authorNameTranslations[activeLang] || 'Admin'}
                                    class="admin-name-input"
                                />
                            </div>
                            <div class="admin-info-row" style="margin-bottom: 1rem;">
                                <span class="admin-info-label">{t('admin.settings.admin_account_email')}</span>
                                <input 
                                    type="email" 
                                    bind:value={adminEmail} 
                                    placeholder="example@email.com"
                                    class="admin-name-input"
                                />
                            </div>
                            <div class="admin-info-row" style="margin-bottom: 1rem;">
                                <span class="admin-info-label">{t('blog.auth.password_label')}</span>
                                <input 
                                    type="password" 
                                    bind:value={adminPassword} 
                                    placeholder={t('admin.login.password_placeholder')}
                                    class="admin-name-input"
                                />
                            </div>
                            <div class="admin-info-row">
                                <span class="admin-info-label">{t('admin.settings.admin_password_confirm')}</span>
                                <input 
                                    type="password" 
                                    bind:value={adminPasswordConfirm} 
                                    placeholder={t('admin.login.password_placeholder')}
                                    class="admin-name-input"
                                />
                            </div>
                        </div>
                        <p class="admin-hint">
                            {t('admin.settings.admin_password_help')}
                        </p>
                        <button
                            type="button"
                            class="btn-admin-update"
                            onclick={handleAdminAccount}
                            disabled={isCreatingAdmin || !adminDisplayName.trim()}
                        >
                            {isCreatingAdmin ? 'Updating...' : t('admin.settings.admin_account_update_btn')}
                        </button>
                    {:else}
                        <div class="admin-not-created-warning">
                            <p>{t('admin.settings.admin_account_not_created')}</p>
                        </div>
                        <div class="form-group mb-4">
                            <label for="new_admin_name" class="block text-sm font-bold text-slate-700 mb-2">{t('admin.settings.admin_account_name')}</label>
                            <input 
                                type="text" 
                                id="new_admin_name"
                                bind:value={adminDisplayName} 
                                placeholder={authorNameTranslations[activeLang] || 'Admin'}
                                class="admin-name-input w-full"
                            />
                        </div>
                        <div class="form-group mb-4">
                            <label for="new_admin_email" class="block text-sm font-bold text-slate-700 mb-2">{t('admin.settings.admin_account_email')}</label>
                            <input 
                                type="email" 
                                id="new_admin_email"
                                bind:value={adminEmail} 
                                placeholder="example@email.com"
                                class="admin-name-input w-full"
                            />
                        </div>
                        <div class="form-group mb-4">
                            <label for="new_admin_password" class="block text-sm font-bold text-slate-700 mb-2">{t('blog.auth.password_label')}</label>
                            <input 
                                type="password" 
                                id="new_admin_password"
                                bind:value={adminPassword} 
                                placeholder={t('admin.login.password_placeholder')}
                                class="admin-name-input w-full"
                            />
                        </div>
                        <div class="form-group mb-4">
                            <label for="new_admin_password_confirm" class="block text-sm font-bold text-slate-700 mb-2">{t('admin.settings.admin_password_confirm')}</label>
                            <input 
                                type="password" 
                                id="new_admin_password_confirm"
                                bind:value={adminPasswordConfirm} 
                                placeholder={t('admin.login.password_placeholder')}
                                class="admin-name-input w-full"
                            />
                        </div>
                        <button
                            type="button"
                            class="btn-admin-create"
                            onclick={handleAdminAccount}
                            disabled={isCreatingAdmin || !adminDisplayName.trim()}
                        >
                            {isCreatingAdmin ? 'Creating...' : t('admin.settings.admin_account_create_btn')}
                        </button>
                    {/if}

                    {#if adminActionResult?.success}
                        <p class="admin-result-success">✅ {t('admin.settings.admin_account_saved')}</p>
                    {/if}
                    {#if adminActionResult?.error}
                        <p class="admin-result-error">❌ {adminActionResult.error}</p>
                    {/if}
                </div>
            </section>

            <!-- 로그인 설정 -->
            <section class="settings-card">
                <div class="card-header">
                    <Shield size={20} />
                    <h2>{t('admin.settings.social_login_title', { default: '로그인 설정' })}</h2>
                </div>
                <div class="card-body">
                    <div class="warning-box mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm">
                        <p class="text-sm font-bold text-amber-900 mb-1 flex items-center gap-1">
                            {t('admin.settings.social_warning_title', { default: '⚠️ 중요 안내' })}
                        </p>
                        <p class="text-xs text-amber-800 leading-relaxed font-medium">
                            {@html t('admin.settings.social_warning_desc', { default: '소셜 로그인을 사용하려면 <strong>cf-blog</strong>의 Cloudflare Pages 환경변수(Secrets)에 해당 프로바이더의 <code>CLIENT_ID</code> 및 <code>CLIENT_SECRET</code>이 등록되어 있어야 합니다. 설정을 변경한 후에는 반드시 cf-blog를 <strong>재배포</strong>해야 적용됩니다.' })}
                        </p>
                    </div>

                    <div class="form-group flex items-center justify-between p-5 bg-blue-50 border-2 border-blue-200 rounded-xl mb-6 shadow-sm">
                        <div class="flex-1 pr-6">
                            <span class="font-bold text-blue-900 block text-lg mb-1 flex items-center gap-2">
                                {t('admin.settings.email_login_title', { default: '📧 이메일 회원가입 및 로그인 사용' })}
                            </span>
                            <span class="text-sm text-blue-800 block leading-relaxed font-medium">
                                {@html t('admin.settings.email_login_desc', { default: '이 설정을 켜면 <strong>이메일/비밀번호</strong>를 사용한 가입 및 로그인을 허용합니다.' })}
                            </span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" name="enable_email_login" value="true" class="sr-only peer" checked={data.settings.enable_email_login !== 'false'}>
                            <div class="w-14 h-7 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div class="form-group mb-6">
                        <label class="block text-sm font-bold text-slate-700 mb-3">{t('admin.settings.primary_providers', { default: '주요 프로바이더' })}</label>
                        <div class="provider-grid">
                            {#each PRIMARY_PROVIDERS as code}
                                {@const meta = SOCIAL_PROVIDER_META[code]}
                                <button
                                    type="button"
                                    class="provider-btn {authProviders.includes(code) ? 'active' : ''}"
                                    onclick={() => toggleProvider(code)}
                                    style="--prov-color: {meta.color}; --prov-text: {meta.textColor}; --prov-border: {meta.border};"
                                >
                                    <span class="provider-check">{authProviders.includes(code) ? '✓' : ''}</span>
                                    {meta.label}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="form-group mb-6">
                        <details class="extra-providers-details">
                            <summary class="text-sm font-bold text-slate-700 cursor-pointer hover:text-slate-900 transition-colors py-2 select-none flex items-center gap-1">
                                <span>{t('admin.settings.extra_providers', { default: '▶ 추가 프로바이더' })}</span>
                                <span class="text-xs font-normal text-slate-400">({t('admin.settings.extra_providers_count', { count: EXTRA_PROVIDERS.length, default: `${EXTRA_PROVIDERS.length}개` })})</span>
                            </summary>
                            <div class="provider-grid mt-3 pt-2 border-t border-slate-100">
                                {#each EXTRA_PROVIDERS as code}
                                    {@const meta = SOCIAL_PROVIDER_META[code]}
                                    <button
                                        type="button"
                                        class="provider-btn {authProviders.includes(code) ? 'active' : ''}"
                                        onclick={() => toggleProvider(code)}
                                        style="--prov-color: {meta.color}; --prov-text: {meta.textColor}; --prov-border: {meta.border};"
                                    >
                                        <span class="provider-check">{authProviders.includes(code) ? '✓' : ''}</span>
                                        {meta.label}
                                    </button>
                                {/each}
                            </div>
                        </details>
                    </div>



                    {#if authProviders.length > 0}
                        <div class="env-hint mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h4 class="text-xs font-bold text-slate-700 mb-2">{t('admin.settings.env_reference_title', { default: '필요한 환경변수 레퍼런스:' })}</h4>
                            <ul class="text-xs text-slate-500 space-y-1">
                                {#each authProviders as code}
                                    {@const meta = SOCIAL_PROVIDER_META[code]}
                                    <li><strong>{meta.label}</strong>: <code>{meta.envKeys[0]}</code>, <code>{meta.envKeys[1]}</code></li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </div>
            </section>

            <!-- CDN 캐시 설정 -->
            <section class="settings-card mb-6">
                <div class="card-header">
                    <RefreshCcw size={20} />
                    <h2>{t('admin.settings.cdn_cache_title', { default: 'CDN Edge 캐시 설정' })}</h2>
                </div>
                <div class="card-body bg-slate-50 border-b border-slate-200">
                    <div class="form-group flex items-center justify-between p-5 bg-blue-50 border-2 border-blue-200 rounded-xl mb-6 shadow-sm">
                        <div class="flex-1 pr-6">
                            <span class="font-bold text-blue-900 block text-lg mb-1 flex items-center gap-2">
                                ⚡ {t('admin.settings.enable_cdn_cache', { default: 'CDN Edge 캐싱 사용' })}
                            </span>
                            <span class="text-sm text-blue-800 block leading-relaxed font-medium">
                                {t('admin.settings.cdn_cache_desc', { default: '활성화하면 비로그인 방문자들에게 초고속 CDN 캐시 페이지를 서빙합니다. 디자인 수정 중에는 꺼두시는 것을 권장합니다.' })}
                            </span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" name="enable_cdn_cache" value="true" class="sr-only peer" checked={data.settings.enable_cdn_cache === 'true'}>
                            <div class="w-14 h-7 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div class="form-group mb-6">
                        <label class="block text-sm font-bold text-slate-700 mb-2">{t('admin.settings.cdn_cache_ttl_label', { default: 'Edge 캐시 유지 기간' })}</label>
                        <div class="flex gap-2">
                            <input 
                                type="number" 
                                bind:value={cdnCacheTtlVal} 
                                min="1" 
                                class="admin-name-input" 
                                style="max-width: 150px;" 
                            />
                            <select bind:value={cdnCacheTtlUnit} class="admin-name-input" style="max-width: 120px;">
                                <option value="minutes">{t('admin.settings.unit_minutes', { default: '분' })}</option>
                                <option value="hours">{t('admin.settings.unit_hours', { default: '시간' })}</option>
                                <option value="days">{t('admin.settings.unit_days', { default: '일' })}</option>
                                <option value="months">{t('admin.settings.unit_months', { default: '개월' })}</option>
                            </select>
                        </div>
                        <p class="text-xs text-slate-400 mt-2">
                            💡 {t('admin.settings.cdn_cache_ttl_hint', { default: '지정한 기간 동안 캐시가 보존되며, 글쓰기나 수정 시 자동으로 캐시가 갱신(Purge)됩니다.' })}
                        </p>
                    </div>

                    <div class="border-t border-slate-100 pt-5 mt-5 flex justify-between items-center">
                        <div class="pr-4">
                            <span class="text-sm font-bold text-slate-700 block">{t('admin.settings.manual_purge_title', { default: '수동 캐시 만료' })}</span>
                            <span class="text-xs text-slate-500">{t('admin.settings.manual_purge_desc', { default: '동기화 오류가 의심될 때 전체 Edge 노드의 캐시를 즉각 강제로 삭제합니다.' })}</span>
                        </div>
                        <button
                            type="button"
                            class="btn-admin-update"
                            style="max-width: 200px; background: #fee2e2; color: #b91c1c; border-color: #fecaca; flex-shrink: 0;"
                            onclick={handleManualPurge}
                            disabled={isPurging}
                        >
                            {isPurging ? 'Purging...' : t('admin.settings.manual_purge_btn', { default: '캐시 전체 삭제 (Purge)' })}
                        </button>
                    </div>
                </div>
            </section>

            <!-- 고급 영역 -->
            <section class="settings-card">
                <div class="card-header">
                    <Code size={20} />
                    <h2>{t('admin.settings.advanced_title')}</h2>
                </div>
                <div class="card-body">
                    <div class="form-group flex items-center justify-between p-5 bg-amber-50 border-2 border-amber-200 rounded-xl mb-6 shadow-sm">
                        <div class="flex-1 pr-6">
                            <span class="font-bold text-amber-900 block text-lg mb-1 flex items-center gap-2">
                                ⚠️ {t('admin.settings.enable_ip_logging')} {t('admin.settings.ip_logging_control_suffix', { default: '(통합 제어)' })}
                            </span>
                            <span class="text-sm text-amber-800 block leading-relaxed font-medium">
                                {@html t('admin.settings.ip_collect_active_desc', { default: '이 설정을 켜면 <strong>회원가입/로그인 시 보안을 위한 세션 접속 기록</strong>과 <strong>방명록/댓글 등 모든 상호작용의 IP 수집</strong>이 <u>동시에</u> 활성화됩니다.' })}
                            </span>
                            <span class="text-xs text-amber-700 block mt-2 opacity-90">
                                {@html t('admin.settings.ip_collect_inactive_desc', { default: '끄게 될 경우 블로그 전역에서 IP 수집이 완전히 차단되어 익명성이 보장되지만, 악성 사용자 필터링이나 접속 기기 관리가 불가능해집니다.' })}
                            </span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" name="enable_ip_logging" value="true" class="sr-only peer" checked={data.settings.enable_ip_logging === 'true'}>
                            <div class="w-14 h-7 bg-amber-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                    </div>

                    <div class="form-group">
                        <label for="head_code">{t('admin.settings.head_code')}</label>
                        <textarea id="head_code" name="head_code" rows="5" placeholder="<script>...</script>">{data.settings.head_code}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="robots_txt">{t('admin.settings.robots_txt')}</label>
                        <textarea id="robots_txt" name="robots_txt" rows="4" placeholder="User-agent: * ...">{data.settings.robots_txt}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="ads_txt">{t('admin.settings.ads_txt')}</label>
                        <textarea id="ads_txt" name="ads_txt" rows="4" placeholder="google.com, pub-...">{data.settings.ads_txt}</textarea>
                    </div>
                </div>
            </section>
            <!-- 전체 시스템 백업 영역 -->
            <section class="settings-card border-2 border-red-100 mt-10">
                <div class="card-header bg-red-50 border-red-100 text-red-900">
                    <Shield size={20} />
                    <h2>{t('admin.backup.full_title')}</h2>
                </div>
                <div class="card-body">
                    <div class="warning-box mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-5 shadow-sm">
                        <p class="text-sm font-bold text-red-900 mb-2 flex items-center gap-1">
                            <AlertTriangle size={18} /> {t('admin.backup.full_warning_title')}
                        </p>
                        <p class="text-xs text-red-800 leading-relaxed font-medium">
                            {t('admin.backup.full_warning_desc')}
                        </p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                            type="button" 
                            class="backup-action-btn download"
                            onclick={downloadFullBackup}
                            disabled={isBackupInProgress}
                        >
                            <div class="btn-icon-circle">
                                {#if isBackupInProgress}
                                    <RefreshCcw size={20} class="animate-spin" />
                                {:else}
                                    <Download size={20} />
                                {/if}
                            </div>
                            <div class="btn-text-content">
                                <span class="btn-title">{t('admin.backup.full_export')}</span>
                                <span class="btn-desc">{t('admin.backup.full_export_desc')}</span>
                            </div>
                        </button>

                        <button 
                            type="button" 
                            class="backup-action-btn upload"
                            onclick={() => restoreFileInput.click()}
                            disabled={isRestoreInProgress}
                        >
                            <div class="btn-icon-circle">
                                {#if isRestoreInProgress}
                                    <RefreshCcw size={20} class="animate-spin" />
                                {:else}
                                    <Upload size={20} />
                                {/if}
                            </div>
                            <div class="btn-text-content">
                                <span class="btn-title">{t('admin.backup.full_import')}</span>
                                <span class="btn-desc">{t('admin.backup.full_import_desc')}</span>
                            </div>
                            <input 
                                type="file" 
                                accept=".json" 
                                bind:this={restoreFileInput} 
                                onchange={handleFullRestore} 
                                style="display: none;" 
                            />
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <div class="form-actions mb-10 flex flex-col items-center gap-3">
            {#if form?.success}
                <div class="alert success text-sm w-full max-w-[400px] text-center" style="margin: 0 auto 0.5rem auto;">
                    {t('admin.settings.saved')}
                </div>
            {/if}
            {#if form?.error}
                <div class="alert error text-sm w-full max-w-[400px] text-center" style="margin: 0 auto 0.5rem auto;">
                    {form.error}
                </div>
            {/if}
            <button type="submit" class="btn-save w-full md:w-auto" disabled={isSubmitting}>
                <Save size={18} /> {isSubmitting ? t('admin.settings.saving') : t('admin.settings.save_btn')}
            </button>
        </div>
    </form>
</div>

<style>
    .settings-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 2rem;
    }
    .page-header {
        margin-bottom: 2rem;
    }
    .page-header h1 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.75rem;
        color: #111827;
        font-weight: 700;
    }
    .subtitle {
        color: #64748b;
        margin-top: 0.5rem;
        font-size: 1rem;
    }

    .alert {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 2rem;
        font-weight: 500;
    }
    .alert.success {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #bbf7d0;
    }
    .alert.error {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
    }

    .settings-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        margin-bottom: 2rem;
    }

    .settings-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
    }
    .card-header {
        background: #f8fafc;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #334155;
    }
    .card-header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
    }
    .card-body {
        padding: 1.5rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }
    .form-group:last-child {
        margin-bottom: 0;
    }
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: #475569;
    }
    .form-group input,
    .form-group textarea {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #1e293b;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
    }
    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }
    .form-group input:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        position: sticky;
        bottom: 2rem;
        z-index: 10;
    }
    .btn-save {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: #111827;
        color: white;
        padding: 0.75rem 2rem;
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 1rem;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .btn-save:hover:not(:disabled) {
        background: #374151;
    }
    .btn-save:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* Tabs */
    .lang-tabs { display: flex; align-items: center; }
    .flex { display: flex; }
    .gap-2 { gap: 0.5rem; }
    .lang-tab-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        color: #6b7280;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .lang-tab-btn:hover { background: #f3f4f6; color: #1f2937; }
    .lang-tab-btn.active {
        background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .lang-badge {
        font-size: 0.65rem; padding: 0.1rem 0.3rem; border-radius: 0.25rem; background: #e2e8f0; color: #475569;
    }
    /* 관리자 계정 섹션 */
    .admin-account-info {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1rem;
    }
    .admin-info-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.6rem;
    }
    .admin-info-row:last-child { margin-bottom: 0; }
    .admin-info-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        min-width: 70px;
    }
    .admin-name-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        color: #1e293b;
        background: white;
    }
    .admin-name-input:focus {
        border-color: #3b82f6;
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    .admin-info-value-code {
        font-family: monospace;
        font-size: 0.8rem;
        background: #e2e8f0;
        padding: 0.2rem 0.5rem;
        border-radius: 0.25rem;
        color: #475569;
        word-break: break-all;
    }
    .admin-info-value-bold {
        font-size: 0.875rem;
        font-weight: 600;
        color: #1e293b;
    }
    .admin-info-value {
        font-size: 0.875rem;
        color: #64748b;
    }
    .admin-hint {
        font-size: 0.85rem;
        color: #64748b;
        font-style: italic;
        margin-bottom: 1rem;
        line-height: 1.5;
    }
    .admin-not-created-warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
        color: #92400e;
        font-weight: 500;
        line-height: 1.5;
    }
    .btn-admin-create {
        width: 100%;
        padding: 0.75rem 1rem;
        background: #d97706;
        color: white;
        border: none;
        border-radius: 0.5rem;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .btn-admin-create:hover:not(:disabled) { background: #b45309; }
    .btn-admin-create:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-admin-update {
        width: 100%;
        padding: 0.6rem 1rem;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 0.5rem;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .btn-admin-update:hover:not(:disabled) { background: #dbeafe; }
    .btn-admin-update:disabled { opacity: 0.5; cursor: not-allowed; }
    .admin-result-success {
        margin-top: 0.75rem;
        font-size: 0.875rem;
        color: #16a34a;
        font-weight: 700;
    }
    .admin-result-error {
        margin-top: 0.75rem;
        font-size: 0.875rem;
        color: #dc2626;
        font-weight: 700;
    }
    
    /* Auth Provider Styles */
    .provider-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.75rem;
    }
    .provider-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #f8fafc;
        color: #475569;
        border: 1px solid #e2e8f0;
    }
    .provider-btn:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
    }
    .provider-btn.active {
        background: var(--prov-color);
        color: var(--prov-text);
        border-color: var(--prov-border) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 2px rgba(0, 0, 0, 0.1);
    }
    .provider-btn.active[style*="--prov-border: none"] {
        border-color: transparent !important;
    }
    .provider-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        font-size: 0.75rem;
    }
    .extra-providers-details summary::-webkit-details-marker {
        display: none;
    }

    /* Backup Action Buttons */
    .backup-action-btn {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 1.5rem;
        background: white;
        border: 2px solid #e2e8f0;
        border-radius: 1rem;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        width: 100%;
    }
    .backup-action-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    .backup-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .btn-icon-circle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        flex-shrink: 0;
    }
    .download .btn-icon-circle {
        background: #f0f9ff;
        color: #0369a1;
    }
    .upload .btn-icon-circle {
        background: #fdf2f8;
        color: #9d174d;
    }
    .backup-action-btn:hover.download { border-color: #bae6fd; }
    .backup-action-btn:hover.upload { border-color: #fbcfe8; }

    .btn-text-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .btn-title {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
    }
    .btn-desc {
        font-size: 0.8rem;
        color: #64748b;
        line-height: 1.4;
    }
    .animate-spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
