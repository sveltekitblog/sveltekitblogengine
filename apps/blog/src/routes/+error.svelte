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
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { t } from "$lib/i18n";

    const status = $derived(page.status);
    const errorMessage = $derived(page.error?.message || "");
    const isTenantNotFound = $derived(errorMessage === 'TENANT_NOT_FOUND' || errorMessage.includes('TENANT_NOT_FOUND'));
    const tenantHomeUrl = $derived((page.data.tenantPrefix || "/") as string);

    const isMainPage = $derived(
        typeof window !== 'undefined' && 
        (window.location.pathname === '/' || window.location.pathname === '/en' || window.location.pathname === '/ja')
    );

    onMount(() => {
        // 시나리오 B: 서브 블로그 자체가 없는 경우 홈으로 리다이렉트하지 않고 404 안내 화면 유지
        if (isTenantNotFound) {
            return;
        }

        // 시나리오 A & C: 블로그 내부의 잘못된 404 링크는 해당 블로그의 홈(tenantHomeUrl)으로 자동 이동
        if (status === 404 || status === 403 || status === 401) {
            goto(tenantHomeUrl, { replaceState: true });
            return;
        }

        // 2. 서버 에러(500)인 경우 3초 후 해당 블로그 홈으로 이동
        if (status >= 500 && !isMainPage) {
            setTimeout(() => {
                goto(tenantHomeUrl, { replaceState: true });
            }, 3000);
        }
    });
</script>

{#if isTenantNotFound}
    <!-- 시나리오 B: 존재하지 않거나 삭제된 서브 블로그 전용 다국어 404 안내 -->
    <div class="tenant-not-found-container">
        <div class="error-badge">404</div>
        <h1>{$t("blog.error.tenant_not_found_title", { default: "존재하지 않거나 삭제된 블로그입니다." })}</h1>
        <p>{$t("blog.error.tenant_not_found_desc", { default: "요청하신 블로그 주소가 올바른지 다시 한번 확인해 주세요." })}</p>
        <a href="/" class="home-btn">{$t("blog.error.go_home", { default: "메인 페이지로 이동" })}</a>
    </div>
{:else if status >= 500}
    <!-- Legitimate system/server failure (500) -->
    <div class="server-error-container">
        <h1>{$t("blog.error.server_error_title", { default: "🚨 서비스 연결 안내" })}</h1>
        <p>{$t("blog.error.server_error_desc", { default: "일시적인 시스템 오류가 발생했습니다. 불편을 드려 죄송합니다." })}</p>
        <p class="redirect-hint">{$t("blog.error.redirect_hint", { default: "잠시 후 메인 화면으로 안전하게 연결됩니다..." })}</p>
    </div>
{:else}
    <!-- Abnormal access/404 -> absolutely silent zone, zero visible HTML markup before redirect -->
    <div class="silent-zone"></div>
{/if}

<style>
    .tenant-not-found-container,
    .server-error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        font-family: var(--base-font-family, "Inter"), sans-serif;
        color: var(--text-color, #1e293b);
        text-align: center;
        padding: 2rem;
    }
    .error-badge {
        font-size: 3rem;
        font-weight: 900;
        color: var(--primary-color, #3b82f6);
        line-height: 1;
        margin-bottom: 1rem;
        opacity: 0.85;
    }
    h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.75rem;
    }
    p {
        font-size: 0.95rem;
        color: var(--secondary-color, #64748b);
        margin: 0;
        max-width: 420px;
        line-height: 1.5;
    }
    .home-btn {
        margin-top: 2rem;
        display: inline-block;
        background: var(--primary-color, #3b82f6);
        color: #ffffff;
        padding: 0.65rem 1.5rem;
        border-radius: 8px;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 600;
        transition: opacity 0.2s;
    }
    .home-btn:hover {
        opacity: 0.9;
    }
    .redirect-hint {
        font-size: 0.875rem;
        color: var(--primary-color, #3b82f6);
        margin-top: 1.5rem;
        font-weight: 500;
    }
    .silent-zone {
        display: none;
    }
</style>
