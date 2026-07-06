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
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import LayoutRenderer from "$lib/components/LayoutRenderer.svelte";
    import DynamicBgRenderer from "$lib/components/DynamicBgRenderer.svelte";
    import { t } from "$lib/i18n";
    import { normalizeBackground, getBgValue } from "$lib/utils/background";
    import { onMount, untrack } from "svelte";

    let { data, children }: { data: any; children: any } = $props();

    let isMobile = $state(untrack(() => data.isMobile ?? false));

    onMount(() => {
        const media = window.matchMedia("(max-width: 768px)");
        isMobile = media.matches;
        const listener = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    });

    const settings = $derived(data.settings || {});
    // Pure Svelte 5: Reactive proxy to current page data
    const seo = $derived(page.data.seo || {});
    const theme = $derived(settings.theme || {});
    const headerConfig = $derived(settings.header || {});
    const layoutConfig = $derived(
        data.activeLayout || {
            id: 0,
            name: "Default",
            columnCount: 1,
            columnWidths: "1fr",
        },
    );
    const layoutWidgets = $derived(data.layoutWidgets || []);
    const footerConfig = $derived(settings.footer || {});
    const globalCss = $derived(settings.global_css || "");
    const headCode = $derived(settings.head_code || "");
    const headerCss = $derived(settings.header_css || "");
    const footerCss = $derived(settings.footer_css || "");

    const normalizedBodyBg = $derived.by(() => {
        const rawBg = theme.bodyBackground || theme.background;
        const normalized = normalizeBackground(
            rawBg,
            theme.bodyBackgroundOpacity,
            theme.bodyBackgroundBlur,
        );
        if (isMobile) {
            if (normalized.mobile) {
                const isJs = normalized.mobile.type === "js";
                const actualJsCode = isJs && normalized.mobile.inheritJs
                    ? (normalized.jsCode || "")
                    : (normalized.mobile.jsCode || "");
                return {
                    ...normalized.mobile,
                    jsCode: actualJsCode,
                    allowMobile: isJs
                };
            } else {
                return {
                    ...normalized,
                    allowMobile: false
                };
            }
        }
        return { ...normalized, allowMobile: true };
    });

    const bodyBlur = $derived(normalizedBodyBg.blur);
    const bodyLayerBlur = $derived(normalizedBodyBg.layerBlur);
    const bodyOpacity = $derived(normalizedBodyBg.opacity);
    const bodyBg = $derived(getBgValue(normalizedBodyBg));
    const headerBg = $derived(getBgValue(headerConfig.headerBackground));
    const footerBg = $derived(getBgValue(footerConfig.footerBackground));

    const baseFontSize = $derived(theme.baseFontSize || "16px");
    const mobileBaseFontSize = $derived(theme.mobileBaseFontSize || baseFontSize);
    const fontFamily = $derived(theme.fontFamily || "Inter");
    const postFontSize = $derived(settings.post_font_size || baseFontSize);

    function getRadius(radius: any, fallback: string) {
        if (!radius) return fallback;
        const { topLeft, topRight, bottomLeft, bottomRight } = radius;
        const format = (v: any) => {
            if (v === undefined || v === null || v === "") return "0px";
            if (
                typeof v === "number" ||
                (!isNaN(Number(v)) && String(v).trim() !== "")
            )
                return `${v}px`;
            return v;
        };
        return `${format(topLeft)} ${format(topRight)} ${format(bottomRight)} ${format(bottomLeft)}`;
    }

    const headerRadius = $derived(
        getRadius(headerConfig.borderRadius, "0 0 12px 12px"),
    );
    const footerRadius = $derived(
        getRadius(footerConfig.borderRadius, "12px 12px 0 0"),
    );
    const headerShadow = $derived(
        headerConfig.boxShadow || "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    );
    const footerShadow = $derived(footerConfig.boxShadow || "none");
    const dbDefaultLang = $derived(data.dbDefaultLang || "ko");
    const lang = $derived(data.lang || dbDefaultLang);

    function getTrans(val: any) {
        if (!val) return "";
        if (typeof val === "string" && val.startsWith("{")) {
            try {
                const parsed = JSON.parse(val);
                return (
                    parsed[lang] ||
                    parsed[dbDefaultLang] ||
                    Object.values(parsed)[0] ||
                    val
                );
            } catch (e) {
                return val;
            }
        }
        if (typeof val === "object" && val !== null) {
            return (
                val[lang] || val[dbDefaultLang] || Object.values(val)[0] || ""
            );
        }
        return val;
    }

    const siteTitle = $derived(
        getTrans(settings.header?.logoText) || getTrans(settings.site_title) || "Blog",
    );
    const siteDescription = $derived(
        getTrans(settings.description) || "Welcome to my blog",
    );
    // [CRITICAL] SEO title from page loader MUST take precedence
    const displayTitle = $derived(
        seo?.title || getTrans(headerConfig.logoText) || siteTitle,
    );
    const displayDescription = $derived(seo?.description || siteDescription);
    const lcpImageUrl = $derived(page.data.lcpImage || "");

    const safeSideMargin = $derived(headerConfig.safeSideMargin || "0px");
    const safeSideMarginMobile = $derived(headerConfig.safeSideMarginMobile || "0px");
    const safeTopMargin = $derived(headerConfig.safeTopMargin || "0px");
    const safeTopMarginMobile = $derived(headerConfig.safeTopMarginMobile || "0px");
</script>

<svelte:head>
    {#if lcpImageUrl}
        <link
            rel="preload"
            href={lcpImageUrl}
            as="image"
            fetchpriority="high"
        />
    {/if}
    <title>{displayTitle}</title>
    <meta name="description" content={displayDescription} />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta charset="utf-8" />

    <!-- 범용 페이지용 전역 Hreflang 자동 생성 (하드코딩 배제, DB 활성화 언어 연동) -->
    {#if !seo?.alternates && data.languages && data.languages.length > 0}
        {@const dbDefaultLang = data.dbDefaultLang || 'ko'}
        {@const nonDefaultLangs = data.languages.map(l => l.code).filter(c => c !== dbDefaultLang)}
        {@const langRegex = new RegExp(`^\\/(${nonDefaultLangs.join('|')})(\\/|$)`)}
        {@const currentPath = page.url.pathname}
        {@const cleanPath = currentPath.replace(langRegex, '$2')}
        
        {#each data.languages as l}
            {@const isDefault = l.code === dbDefaultLang}
            {@const path = isDefault
                ? (cleanPath === '/' ? '' : cleanPath)
                : `/${l.code}${cleanPath === '/' ? '' : cleanPath}`}
            <link rel="alternate" hreflang={l.code} href="{settings.siteUrl || ''}{path}" />
        {/each}
        <link rel="alternate" hreflang="x-default" href="{settings.siteUrl || ''}{cleanPath === '/' ? '' : cleanPath}" />
    {/if}

    <meta property="og:site_name" content={siteTitle} />
    <meta property="og:locale" content={lang === "ko" ? "ko_KR" : lang} />

    {#if data.googleFonts && data.googleFonts.length > 0}
        {#each data.googleFonts as fontName}
            <link
                rel="stylesheet"
                href="/api/font-css?name={fontName}"
            />
        {/each}
    {:else}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossorigin=""
        />
        <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
            rel="stylesheet"
        />
    {/if}

    {#if fontFamily.includes("Pretendard")}
        <link
            rel="stylesheet"
            crossorigin
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
    {/if}

    {#if headCode}
        {@html headCode}
    {/if}

    {#if globalCss}
        {@html `<style>${globalCss}</style>`}
    {/if}

    {#if headerCss}
        {@html `<style>${headerCss}</style>`}
    {/if}

    {#if footerCss}
        {@html `<style>${footerCss}</style>`}
    {/if}
</svelte:head>

<div
    class="app-root"
    style="
        --base-font-family: {fontFamily};
        --base-font-size: {baseFontSize};
        --mobile-base-font-size: {mobileBaseFontSize};
        --primary-color: {theme.primary || '#3b82f6'};
        --secondary-color: {theme.secondary || '#64748b'};
        --bg-value: {bodyBg === 'transparent'
        ? 'var(--surface-color, #f8fafc)'
        : bodyBg};
        --body-blur: {bodyBlur}px;
        --body-layer-blur: {bodyLayerBlur}px;
        --header-bg: {headerBg};
        --footer-bg: {footerBg};
        --surface-color: {theme.cardBg};
        --text-color: {theme.text};
        --accent-color: {theme.accent || '#10b981'};
        --border-color: {theme.border || '#e2e8f0'};
        --max-width: {theme.maxWidth};
        --side-margin: {theme.sideMargin || '1.5rem'};
        --mobile-side-margin: {theme.mobileSideMargin || '24px'};
        --header-bottom-margin: {theme.headerBodySpacing || '1rem'};
        --header-bottom-margin-mobile: {theme.headerBodySpacingMobile || '0.5rem'};
        --footer-top-margin: {theme.bodyFooterSpacing || '1rem'};
        --footer-top-margin-mobile: {theme.bodyFooterSpacingMobile || '0.5rem'};
        --post-font-size: {postFontSize};
        --header-radius: {headerRadius};
        --header-shadow: {headerShadow};
        --footer-radius: {footerRadius};
        --footer-shadow: {footerShadow};
        --header-side-margin: {headerConfig.sideMargin || '0'};
        --footer-side-margin: {footerConfig.sideMargin || '0'};
        --safe-side-margin: {safeSideMargin};
        --safe-side-margin-mobile: {safeSideMarginMobile};
        --safe-top-margin: {safeTopMargin};
        --safe-top-margin-mobile: {safeTopMarginMobile};
        --body-overlay-color: {normalizedBodyBg.overlayColor};
        --body-overlay-opacity: {normalizedBodyBg.overlayOpacity};
    "
>
    <div class="body-background-wrapper">
        <div class="body-backdrop-layer"></div>
        {#if normalizedBodyBg.type === "js"}
            <DynamicBgRenderer
                area="main"
                code={normalizedBodyBg.jsCode || ""}
                config={normalizedBodyBg.jsConfig || {}}
                zIndex={2}
                opacity={bodyOpacity}
                layerBlur={bodyLayerBlur}
                allowMobile={normalizedBodyBg.allowMobile}
                fallbackColor={normalizedBodyBg.fallbackColor}
            />
        {:else}
            <div class="body-visual-layer"></div>
        {/if}
        <div class="body-overlay-layer"></div>
    </div>
    <Header
        {settings}
        user={data.user}
        categories={data.categories || []}
        navIconSvgs={data.navIconSvgs || {}}
        isMobile={isMobile}
    />

    <main>
        <div class="container">
            <LayoutRenderer
                layout={layoutConfig}
                {layoutWidgets}
                desktopWidgets={data.desktopWidgets || []}
                mobileWidgets={data.mobileWidgets || []}
                mobileLayout={data.mobileLayout || {
                    columnCount: 1,
                    columnWidths: "1fr",
                }}
                categories={data.categories || []}
                recentPosts={data.recentPosts || []}
                popularPosts={data.popularPosts || []}
                tags={data.tags || []}
                recentComments={data.recentComments || []}
                recentGuestbooks={data.recentGuestbooks || []}
                {settings}
            >
                {@render children()}
            </LayoutRenderer>
        </div>
    </main>

    <Footer {settings} />
</div>

<style>
    :global(*, *::before, *::after) {
        box-sizing: border-box;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        transition: color 0.3s ease;
    }

    .body-background-wrapper {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
    }

    .body-backdrop-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        pointer-events: none;
    }

    :global(.app-root:not([style*="--body-blur: 0px"])) .body-backdrop-layer {
        backdrop-filter: blur(var(--body-blur, 0px));
        -webkit-backdrop-filter: blur(var(--body-blur, 0px));
    }

    .body-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--body-overlay-color, #000000);
        opacity: var(--body-overlay-opacity, 0);
        pointer-events: none;
        transition: opacity 0.3s ease;
    }

    .body-visual-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        background: var(--bg-value, transparent);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: var(--body-opacity, 1);
        filter: blur(var(--body-layer-blur, 0px));
        transform: scale(calc(1 + var(--body-layer-blur, 0) * 0.01));
        pointer-events: none;
    }

    .app-root {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg-value, transparent);
        background-attachment: fixed;
        background-size: cover;
        background-position: center;
        transition: background 0.3s ease;
        color: var(--text-color);
        font-family: var(--base-font-family, "Inter"), sans-serif;
        font-size: var(--base-font-size, 16px);
        position: relative;
        isolation: isolate;
    }

    main {
        flex-grow: 1;
        padding-top: var(--header-bottom-margin, 1rem);
        padding-bottom: var(--footer-top-margin, 1rem);
    }

    .container {
        max-width: var(--max-width, 1200px);
        margin: 0 auto;
        width: 100%;
    }

    @media (max-width: 768px) {
        .app-root {
            --base-font-size: var(--mobile-base-font-size, 16px) !important;
            font-size: var(--mobile-base-font-size, 16px) !important;
        }
        main {
            padding-top: var(--header-bottom-margin-mobile, 0.5rem);
            padding-bottom: var(--footer-top-margin-mobile, 0.5rem);
        }
        .container {
            padding: 0 var(--mobile-side-margin) !important;
        }
    }
</style>
