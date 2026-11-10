<!--
 Copyright (C) 2026 SvelteKit Blog Engine

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
    import { page, navigating } from "$app/stores";
    import { t, adminLang } from "$lib/i18n.svelte";
    import { FULL_VERSION } from "@blog/shared";
    import { Sun, Moon } from "lucide-svelte";
    import { onMount } from "svelte";
    import "../app.css";
    
    let { data, children } = $props();

    const isLoginPage = $derived(
        $page.url.pathname.startsWith("/login") || 
        $page.url.pathname.startsWith("/dashboard/login")
    );
    const isDashboardOnly = $derived(data?.isDashboardOnly || false);

    let mobileTheme = $state<'dark' | 'light'>('dark');

    onMount(() => {
        const saved = localStorage.getItem('dash_mobile_theme') as 'dark' | 'light' | null;
        if (saved === 'light' || saved === 'dark') {
            mobileTheme = saved;
        } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            mobileTheme = 'light';
        }
    });

    function toggleTheme() {
        mobileTheme = mobileTheme === 'dark' ? 'light' : 'dark';
        if (typeof window !== 'undefined') {
            localStorage.setItem('dash_mobile_theme', mobileTheme);
        }
    }
</script>

<div class="admin-layout" class:mobile-viewer={isDashboardOnly} data-theme={isDashboardOnly ? mobileTheme : undefined}>
    {#if $navigating}
        <div class="global-loader">
            <div class="spinner"></div>
            <p>{t('admin.common.loading', { default: '로딩 중...' })}</p>
        </div>
    {/if}

    <!-- 모바일 대시보드 뷰어 전용 상단 헤더 -->
    {#if isDashboardOnly && !isLoginPage}
        <header class="mobile-dash-header">
            <div class="mobile-dash-brand">
                <span class="mobile-dash-title">{t('admin.dashboard.mobile_header_title')}</span>
                <select bind:value={adminLang.value} class="admin-lang-select mobile-lang">
                    <option value="ko">KO</option>
                    <option value="en">EN</option>
                    <option value="ja">JA</option>
                </select>
            </div>
            <div class="mobile-dash-actions">
                <button
                    type="button"
                    class="mobile-theme-toggle"
                    onclick={toggleTheme}
                    title={mobileTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                    aria-label="Toggle theme"
                >
                    {#if mobileTheme === 'dark'}
                        <Sun size={17} class="text-amber-400" />
                    {:else}
                        <Moon size={17} class="text-indigo-600" />
                    {/if}
                </button>
                <form method="POST" action="/dashboard/login?/logout">
                    <button type="submit" class="mobile-logout-btn">
                        {t('admin.dashboard.logout')}
                    </button>
                </form>
            </div>
        </header>
    {/if}

    <!-- PC 최고 관리자 사이드바 (모바일 뷰어이거나 로그인 페이지일 때는 숨김) -->
    {#if !isLoginPage && !isDashboardOnly}
        <nav class="sidebar">
            <div class="logo">
                Admin
                <select bind:value={adminLang.value} class="admin-lang-select">
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                </select>
            </div>
            <ul>
                <li>
                    <a href="/dashboard" class:active={$page.url.pathname === "/dashboard"}
                        >{t('admin.left.menu.dashboard')}</a
                    >
                </li>
                <li>
                    <a
                        href="/interactions"
                        class:active={$page.url.pathname.startsWith("/interactions")}
                        >{t('admin.left.menu.interactions')}</a
                    >
                </li>
                <li>
                    <a
                        href="/users"
                        class:active={$page.url.pathname.startsWith("/users")}
                        >{t('admin.left.menu.users')}</a
                    >
                </li>
                <li>
                    <a
                        href="/posts"
                        class:active={$page.url.pathname.startsWith("/posts")}
                        >{t('admin.left.menu.posts')}</a
                    >
                </li>
                <li>
                    <a
                        href="/design-editor"
                        class:active={$page.url.pathname.startsWith("/design-editor")}
                        >{t('admin.left.menu.theme_editor')}</a
                    >
                </li>
                <li>
                    <a
                        href="/media"
                        class:active={$page.url.pathname.startsWith("/media")}
                        >{t('admin.left.menu.media')}</a
                    >
                </li>
                <li>
                    <a
                        href="/backup"
                        class:active={$page.url.pathname.startsWith("/backup")}
                        >{t('admin.left.menu.backup')}</a
                    >
                </li>
                <li>
                    <a
                        href="/settings"
                        class:active={$page.url.pathname === "/settings"}
                        >{t('admin.left.menu.settings')}</a
                    >
                </li>
                <li>
                    <a
                        href="/settings/languages"
                        class:active={$page.url.pathname.startsWith("/settings/languages")}
                        >{t('admin.left.menu.languages')}</a
                    >
                </li>
            </ul>
            <div class="sidebar-footer" style="padding: 0.75rem 1rem; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #1e293b; margin-top: auto; font-family: monospace;">
                <span>{FULL_VERSION}</span>
            </div>
            <div class="user">
                <!-- User info here -->
            </div>
        </nav>
    {/if}

    <main class="content">
        {@render children()}
    </main>
</div>

<style>
    .global-loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: #111827;
        font-weight: 500;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid #111827;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .admin-layout {
        display: flex;
        min-height: 100vh;
        background-color: #f9fafb;
    }
    .sidebar {
        width: 250px;
        background: white;
        border-right: 1px solid #e5e7eb;
        padding: 1.5rem;
    }
    .logo {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 2rem;
        color: #111827;
    }
    ul {
        list-style: none;
        padding: 0;
    }
    li {
        margin-bottom: 0.5rem;
    }
    a {
        display: block;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        color: #4b5563;
        text-decoration: none;
        transition: all 0.2s;
    }
    a:hover {
        background: #f3f4f6;
        color: #111827;
    }
    a.active {
        background: #111827;
        color: white;
    }
    .content {
        flex: 1;
        padding: 2rem;
        overflow-y: auto;
    }

    .admin-layout.mobile-viewer {
        flex-direction: column;
        min-height: 100vh;
        transition: background-color 0.2s ease, color 0.2s ease;
    }

    .admin-layout.mobile-viewer[data-theme="dark"] {
        --dash-bg: #0b1120;
        --dash-header-bg: rgba(19, 29, 49, 0.92);
        --dash-header-border: #26354f;
        --dash-card-bg: #172339;
        --dash-card-border: #26354f;
        --dash-text-main: #f8fafc;
        --dash-text-sub: #94a3b8;
        --dash-text-muted: #64748b;
        --dash-control-bg: #0f172a;
        --dash-control-border: #334155;
        --dash-card-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        background-color: var(--dash-bg);
        color: var(--dash-text-main);
    }

    .admin-layout.mobile-viewer[data-theme="light"] {
        --dash-bg: #f8fafc;
        --dash-header-bg: rgba(255, 255, 255, 0.92);
        --dash-header-border: #e2e8f0;
        --dash-card-bg: #ffffff;
        --dash-card-border: #e2e8f0;
        --dash-text-main: #0f172a;
        --dash-text-sub: #64748b;
        --dash-text-muted: #94a3b8;
        --dash-control-bg: #f1f5f9;
        --dash-control-border: #cbd5e1;
        --dash-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.03);
        background-color: var(--dash-bg);
        color: var(--dash-text-main);
    }

    .mobile-dash-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 1rem;
        background: var(--dash-header-bg);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--dash-header-border);
        position: sticky;
        top: 0;
        z-index: 50;
    }

    .mobile-dash-brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .mobile-dash-title {
        font-weight: 700;
        font-size: 1.05rem;
        color: var(--dash-text-main);
        letter-spacing: -0.02em;
    }

    .mobile-lang {
        padding: 0.2rem 0.45rem;
        font-size: 0.72rem;
        background: var(--dash-control-bg);
        border: 1px solid var(--dash-control-border);
        border-radius: 0.375rem;
        color: var(--dash-text-sub);
    }

    .mobile-dash-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .mobile-theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: var(--dash-control-bg);
        border: 1px solid var(--dash-control-border);
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mobile-theme-toggle:hover {
        opacity: 0.85;
    }

    .mobile-logout-btn {
        padding: 0.3rem 0.65rem;
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-radius: 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .mobile-viewer .content {
        padding: 0.65rem 0.35rem;
        max-width: 100%;
        box-sizing: border-box;
    }
</style>
