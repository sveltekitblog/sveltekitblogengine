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
    import { onMount, untrack } from "svelte";
    import PostCard from "$lib/components/PostCard.svelte";
    import { page as pageStore } from "$app/stores";
    import { t } from "$lib/i18n";

    let {
        data,
        posts = [],
        baseUrl = "",
        page = 1,
        hasNextPage = false,
        fallbackMessage = "아직 작성된 글이 없습니다.",
    } = $props();

    // Default fallback for PostContent config
    const defaultPcConfig = {
        columns: 3,
        layout: "vertical",
        imageRatio: 40,
        badgeBg: "#e2e8f0",
        badgeColor: "#475569",
        cardBg: "#ffffff",
        cardTextColor: "#1e293b",
        cardFontSize: "1rem",
        itemsPerPage: 9,
        hoverEffect: "default",
        paginationStyle: "default",
    };

    function getLocalizedUrl(path: string) {
        const lang = $pageStore.params.lang;
        if (lang) {
            return path.startsWith('/') ? `/${lang}${path === '/' ? '' : path}` : `/${lang}/${path}`;
        }
        return path;
    }

    function parseWidgetConfig(rawConfig: any): any {
        if (!rawConfig) return {};
        if (typeof rawConfig === "string" && rawConfig.trim() !== "") {
            try {
                return JSON.parse(rawConfig);
            } catch {
                return {};
            }
        }
        return rawConfig;
    }

    function extractDeviceConfig(
        parsed: any,
        device: "desktop" | "mobile",
    ): any {
        if (parsed.desktop || parsed.mobile) {
            return {
                ...defaultPcConfig,
                ...(parsed[device] || parsed.desktop || {}),
            };
        }
        return { ...defaultPcConfig, ...parsed };
    }

    // Find PostContent widget
    let dWidget = $derived(
        (
            (data as any).desktopWidgets ||
            (data as any).layoutWidgets ||
            []
        ).find(
            (w: any) => w.type === "PostContent" || w.type === "post_content",
        ),
    );
    let mWidget = $derived(
        ((data as any).mobileWidgets || []).find(
            (w: any) => w.type === "PostContent" || w.type === "post_content",
        ),
    );

    let dParsed = $derived(parseWidgetConfig(dWidget?.config));
    let mParsed = $derived(parseWidgetConfig(mWidget?.config));

    let desktopPcConfig = $derived(extractDeviceConfig(dParsed, "desktop"));
    let mobilePcConfig = $derived(
        extractDeviceConfig(mParsed || dParsed, "mobile"),
    );

    let desktopGridCols = $derived(
        desktopPcConfig.columns || (data as any).activeLayout?.columnCount || 3,
    );
    let mobileGridCols = $derived(mobilePcConfig.columns || 1);

    // For pagination
    let pcConfig = $derived(isMobile ? mobilePcConfig : desktopPcConfig);
    let isMobile = $state(untrack(() => data?.isMobile ?? false));
    let clientHasNextPage = $derived(hasNextPage || posts.length > pcConfig.itemsPerPage);

    onMount(() => {
        const media = window.matchMedia("(max-width: 768px)");
        isMobile = media.matches;
        const listener = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    });
</script>

{#if posts.length > 0}
    <!-- Unified single loop posts list -->
    <div
        class="posts-list"
        style="
        --pc-d-badge-bg: {desktopPcConfig.badgeBg || '#e2e8f0'};
        --pc-d-badge-color: {desktopPcConfig.badgeColor || '#475569'};
        --pc-d-card-bg: {desktopPcConfig.cardBg || '#ffffff'};
        --pc-d-card-text: {desktopPcConfig.cardTextColor || '#1e293b'};
        --pc-d-card-font-size: {desktopPcConfig.cardFontSize || '1rem'};
        --pc-m-badge-bg: {mobilePcConfig.badgeBg || desktopPcConfig.badgeBg || '#e2e8f0'};
        --pc-m-badge-color: {mobilePcConfig.badgeColor || desktopPcConfig.badgeColor || '#475569'};
        --pc-m-card-bg: {mobilePcConfig.cardBg || desktopPcConfig.cardBg || '#ffffff'};
        --pc-m-card-text: {mobilePcConfig.cardTextColor || desktopPcConfig.cardTextColor || '#1e293b'};
        --pc-m-card-font-size: {mobilePcConfig.cardFontSize || desktopPcConfig.cardFontSize || '1rem'};
        --grid-cols-desktop: {desktopGridCols};
        --grid-cols-mobile: {mobileGridCols};
    "
    >
        <div class="grid">
            {#each posts.slice(0, pcConfig.itemsPerPage) as post, i}
                <PostCard
                    {post}
                    {desktopPcConfig}
                    {mobilePcConfig}
                    pcConfig={desktopPcConfig}
                    index={i}
                />
            {/each}
        </div>
    </div>

    {#if pcConfig.itemsPerPage > 0 && typeof page === "number"}
        <div
            class="post-pagination style-{pcConfig.paginationStyle ||
                'default'}"
        >
            {#if page > 1}
                <a
                    href="{getLocalizedUrl(baseUrl)}{baseUrl.includes('?') ? '&' : '?'}page={page - 1}"
                    class="page-link">&lt; {$t("blog.common.prev", { default: "Prev" })}</a
                >
            {/if}
            <span class="page-current">{$t("blog.common.page", { default: "Page {page}" }).replace("{page}", page.toString())}</span>
            {#if clientHasNextPage}
                <a
                    href="{getLocalizedUrl(baseUrl)}{baseUrl.includes('?') ? '&' : '?'}page={page + 1}"
                    class="page-link">{$t("blog.common.next", { default: "Next" })} &gt;</a
                >
            {/if}
        </div>
    {/if}
{:else}
    <div class="no-posts">
        <h2>{fallbackMessage}</h2>
    </div>
{/if}

<style>
    .posts-list {
        --pc-badge-bg: var(--pc-d-badge-bg);
        --pc-badge-color: var(--pc-d-badge-color);
        --pc-card-bg: var(--pc-d-card-bg);
        --pc-card-text: var(--pc-d-card-text);
        --pc-card-font-size: var(--pc-d-card-font-size);
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(var(--grid-cols-desktop, 3), 1fr);
        gap: 2rem;
    }

    @media (max-width: 768px) {
        .posts-list {
            --pc-badge-bg: var(--pc-m-badge-bg);
            --pc-badge-color: var(--pc-m-badge-color);
            --pc-card-bg: var(--pc-m-card-bg);
            --pc-card-text: var(--pc-m-card-text);
            --pc-card-font-size: var(--pc-m-card-font-size);
        }

        .grid {
            grid-template-columns: repeat(var(--grid-cols-mobile, 1), 1fr) !important;
            gap: 1.2rem !important;
        }
    }

    /* Pagination Styles */
    .post-pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        margin-top: 3rem;
        padding-top: 1.5rem;
        border-top: 1px solid #eee;
    }

    .post-pagination .page-link {
        padding: 0.5rem 1rem;
        text-decoration: none;
        color: var(--primary-color, #3b82f6);
        font-weight: 500;
        transition: all 0.2s;
    }

    .post-pagination.style-default .page-link {
        background: #f1f5f9;
        border-radius: 9999px;
    }

    .post-pagination.style-default .page-link:hover {
        background: #e2e8f0;
    }

    .post-pagination.style-bordered .page-link {
        border: 1px solid #cbd5e1;
        border-radius: 4px;
    }

    .post-pagination.style-bordered .page-link:hover {
        background: #f8fafc;
        border-color: #94a3b8;
    }

    .post-pagination.style-minimal .page-link {
        padding: 0.2rem 0.5rem;
        border-bottom: 2px solid transparent;
    }

    .post-pagination.style-minimal .page-link:hover {
        border-bottom-color: var(--primary-color, #3b82f6);
    }

    .page-current {
        font-weight: bold;
        color: #64748b;
    }

    .no-posts {
        grid-column: 1 / -1;
        text-align: center;
        padding: 4rem 1.5rem;
        color: #666;
        font-style: italic;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
    }
    h2 {
        color: #333;
        margin-bottom: 1rem;
        font-size: 1.5rem;
    }
</style>
