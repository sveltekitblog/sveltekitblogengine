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
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { t } from "$lib/i18n.svelte";

    const status = $derived($page.status);

    const isMainPage = $derived(
        typeof window !== 'undefined' && 
        (window.location.pathname === '/' || window.location.pathname === '/en' || window.location.pathname === '/ja')
    );

    onMount(() => {
        // 1. Abnormal access (404, 403, 401) -> redirect instantly without showing any messages or markup
        if (status === 404 || status === 403 || status === 401) {
            goto('/', { replaceState: true });
            return;
        }

        // 2. Normal error (500) -> redirect after 3 seconds so the user can see what happened
        if (status >= 500 && !isMainPage) {
            setTimeout(() => {
                goto('/', { replaceState: true });
            }, 3000);
        }
    });
</script>

{#if status >= 500}
    <!-- Legitimate system/server failure (500) -->
    <div class="server-error-container">
        <h1>{t("admin.error.server_error_title", { default: "🚨 시스템 오류 발생" })}</h1>
        <p>{t("admin.error.server_error_desc", { default: "어드민 서버 연결에 오류가 발생했습니다. 잠시 후 시도해 주세요." })}</p>
        <p class="redirect-hint">{t("admin.error.redirect_hint", { default: "잠시 후 대시보드로 안전하게 연결됩니다..." })}</p>
    </div>
{:else}
    <!-- Abnormal access/404 -> absolutely silent zone, zero visible HTML markup -->
    <div class="silent-zone"></div>
{/if}

<style>
    .server-error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        font-family: Inter, sans-serif;
        color: #1e293b;
        text-align: center;
        padding: 2rem;
    }
    h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 0.75rem;
    }
    p {
        font-size: 1rem;
        color: #64748b;
        margin: 0;
    }
    .redirect-hint {
        font-size: 0.875rem;
        color: #10b981;
        margin-top: 1.5rem;
        font-weight: 500;
    }
    .silent-zone {
        display: none;
    }
</style>
