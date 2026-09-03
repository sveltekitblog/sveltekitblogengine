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
    import { t } from "$lib/i18n";

    const status = $derived(page.status);
</script>

<svelte:head>
    <title>{status === 404 ? "404 Not Found" : "Error"} - {$t("blog.error.server_error_title", { default: "Error" })}</title>
</svelte:head>

<div class="error-wrapper">
    <div class="error-card">
        {#if status >= 500}
            <!-- 500 Server Error -->
            <div class="error-icon">🚨</div>
            <h1 class="error-title">{$t("blog.error.server_error_title", { default: "서비스 연결 안내" })}</h1>
            <p class="error-desc">{$t("blog.error.server_error_desc", { default: "일시적인 시스템 오류가 발생했습니다. 불편을 드려 죄송합니다." })}</p>
        {:else}
            <!-- 404 / 403 / 401 Not Found -->
            <div class="error-code">404</div>
            <h1 class="error-title">{$t("blog.error.not_found_title", { default: "페이지를 찾을 수 없습니다" })}</h1>
            <p class="error-desc">{$t("blog.error.not_found_desc", { default: "요청하신 페이지가 삭제되었거나 주소가 변경되었습니다." })}</p>
        {/if}

        <div class="error-action">
            <a href="/" class="home-button">
                {$t("blog.error.go_home", { default: "홈으로 돌아가기" })}
            </a>
        </div>
    </div>
</div>

<style>
    .error-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 65vh;
        padding: 2rem;
        font-family: var(--base-font-family, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }

    .error-card {
        background-color: var(--surface-color, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 16px;
        padding: 3rem 2.5rem;
        max-width: 480px;
        width: 100%;
        text-align: center;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
    }

    .error-code {
        font-size: 4rem;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.05em;
        color: var(--primary-color, #3b82f6);
        margin-bottom: 1rem;
    }

    .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .error-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-color, #1e293b);
        margin: 0 0 0.75rem 0;
        line-height: 1.3;
    }

    .error-desc {
        font-size: 0.95rem;
        color: var(--secondary-color, #64748b);
        margin: 0 0 2rem 0;
        line-height: 1.6;
    }

    .error-action {
        display: flex;
        justify-content: center;
    }

    .home-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.75rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: #ffffff;
        background-color: var(--primary-color, #3b82f6);
        border-radius: 8px;
        text-decoration: none;
        transition: background-color 0.2s ease, transform 0.15s ease;
    }

    .home-button:hover {
        opacity: 0.92;
        transform: translateY(-1px);
    }

    .home-button:active {
        transform: translateY(0);
    }
</style>
