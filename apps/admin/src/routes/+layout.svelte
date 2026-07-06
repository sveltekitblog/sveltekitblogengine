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
    import { page, navigating } from "$app/stores";
    import { t, adminLang } from "$lib/i18n.svelte";
    import "../app.css";
    
    let { children } = $props();
</script>

<div class="admin-layout">
    {#if $navigating}
        <div class="global-loader">
            <div class="spinner"></div>
            <p>{t('admin.common.loading', { default: '로딩 중...' })}</p>
        </div>
    {/if}

    {#if !$page.url.pathname.startsWith("/login")}
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
                    <a href="/" class:active={$page.url.pathname === "/"}
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
</style>
