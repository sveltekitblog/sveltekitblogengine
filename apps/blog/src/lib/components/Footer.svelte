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
    import { Rss, Download } from "lucide-svelte";
    import DynamicBgRenderer from "./DynamicBgRenderer.svelte";
    import { normalizeBackground, getBgValue } from "$lib/utils/background";
    import { onMount } from "svelte";
    import { t } from "$lib/i18n";

    let { settings }: { settings: any } = $props();
    let isMobile = $state(false);

    onMount(() => {
        const media = window.matchMedia("(max-width: 768px)");
        isMobile = media.matches;
        const listener = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    });
    let baseFooter = $derived(settings?.footer || {});
    let footer = $derived(
        isMobile
            ? {
                  ...baseFooter,
                  copyright: baseFooter.mobile?.copyright || baseFooter.copyright,
                  navLinks: baseFooter.mobile?.navLinks && baseFooter.mobile.navLinks.length > 0 ? baseFooter.mobile.navLinks : baseFooter.navLinks,
                  navFontSize: baseFooter.mobile?.navFontSize || baseFooter.navFontSize,
                  navColor: baseFooter.mobile?.navColor || baseFooter.navColor,
                  navHoverColor: baseFooter.mobile?.navHoverColor || baseFooter.navHoverColor,
                  text: {
                      ...baseFooter.text,
                      color: baseFooter.mobile?.text?.color || baseFooter.text?.color,
                      fontSize: baseFooter.mobile?.text?.fontSize || baseFooter.text?.fontSize,
                  },
                  borderRadius: baseFooter.mobile?.borderRadius || baseFooter.borderRadius,
                  boxShadow: baseFooter.mobile?.boxShadow || baseFooter.boxShadow,
              }
            : baseFooter
    );
    let theme = $derived(settings?.theme || {});
    const dbDefaultLang = $derived($page.data.dbDefaultLang || "ko");
    let lang = $derived($page.data.lang || dbDefaultLang);
    let langPrefix = $derived(lang === dbDefaultLang ? "" : `/${lang}`);
    const footerStaticHtml = $derived(
        settings[`footer_static_html_${lang}`] || 
        settings.footer_static_html_ko || 
        ""
    );

    function processUrl(url: string) {
        if (!url || url === "#") return url;
        if (url.startsWith("http") || url.startsWith("mailto:")) return url;
        if (url === "/") return langPrefix || "/";
        return url.startsWith("/")
            ? `${langPrefix}${url}`
            : `${langPrefix}/${url}`;
    }

    function ensureArray(val: any) {
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }

    function getLocalizedText(val: any, fallback: string = "") {
        if (!val) return fallback;
        let obj = val;
        if (typeof val === "string" && val.startsWith("{")) {
            try {
                obj = JSON.parse(val);
            } catch (e) {}
        }
        if (typeof obj === "object" && obj !== null) {
            return (
                obj[lang] ||
                obj[dbDefaultLang] ||
                Object.values(obj)[0] ||
                fallback
            );
        }
        return val;
    }

    let navLinksRaw = $derived(ensureArray(footer.navLinks));
    let navLinks = $derived(
        navLinksRaw.map((link) => {
            return {
                ...link,
                label: getLocalizedText(link.label, "Untitled"),
            };
        }),
    );
    let socialLinks = $derived(ensureArray(footer.socialLinks));

    let copyrightRaw = $derived(footer.copyright);
    let copyright = $derived(getLocalizedText(copyrightRaw, ""));

    let normalizedFooterBg = $derived.by(() => {
        const normalized = normalizeBackground(
            footer.footerBackground,
            footer.footerBackgroundOpacity,
            footer.footerBackgroundBlur,
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

    let footerBlur = $derived(normalizedFooterBg.blur);
    let footerLayerBlur = $derived(normalizedFooterBg.layerBlur);
    let footerOpacity = $derived(normalizedFooterBg.opacity);
</script>

<footer class="blog-footer">
    <div
        class="footer-inner"
        style="color: {footer.text?.color ||
            theme.secondary ||
            '#666'}; font-size: {footer.text?.fontSize || '0.9rem'};
            --footer-nav-color: {footer.navColor || '#475569'};
            --footer-nav-hover-color: {footer.navHoverColor ||
            'var(--primary-color)'};
            --footer-nav-font-size: {footer.navFontSize || '0.85rem'};
            --footer-bg: {getBgValue(footer.footerBackground) === 'transparent'
            ? 'transparent'
            : getBgValue(footer.footerBackground)};
            --footer-blur: {footerBlur}px;
            --footer-layer-blur: {footerLayerBlur}px;
            --footer-opacity: {footerOpacity};
            --footer-overlay-color: {normalizedFooterBg.overlayColor};
            --footer-overlay-opacity: {normalizedFooterBg.overlayOpacity};
            position: relative;
            z-index: 1;"
    >
        <div class="footer-background-wrapper">
            <div class="footer-backdrop-layer"></div>
            {#if normalizedFooterBg.type === "js"}
                <DynamicBgRenderer
                    area="footer"
                    code={normalizedFooterBg.jsCode || ""}
                    config={normalizedFooterBg.jsConfig || {}}
                    zIndex={2}
                    opacity={footerOpacity}
                    layerBlur={footerLayerBlur}
                    allowMobile={normalizedFooterBg.allowMobile}
                    fallbackColor={normalizedFooterBg.fallbackColor}
                />
            {:else}
                <div class="footer-visual-layer"></div>
            {/if}
            <div class="footer-overlay-layer"></div>
        </div>
        {#if navLinks.length > 0}
            <nav class="footer-nav">
                {#each navLinks as link}
                    <a href={processUrl(link.url)}>{link.label}</a>
                {/each}
            </nav>
        {/if}
        {#if footerStaticHtml}
            {@html footerStaticHtml}
        {:else}
            <p style="color: inherit; font-size: inherit;">
                {@html copyright ||
                    `&copy; ${new Date().getFullYear()} ${settings.site_title || "Blog"}. All rights reserved.`}
            </p>
        {/if}
        <nav class="footer-social">
            <a
                href={processUrl("/rss.xml")}
                title="RSS Feed"
                style="display: flex; align-items: center; gap: 0.3rem;"
            >
                <Rss size={15} /> RSS
            </a>
            {#if footer.shareDesign}
                <a
                    href="/api/share-design"
                    download="blog-design-share.json"
                    style="display: flex; align-items: center; gap: 0.3rem;"
                    title={$t("blog.footer.share_design")}
                >
                    <Download size={15} />
                    {$t("blog.footer.share_design")}
                </a>
            {/if}
            {#each socialLinks as link}
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                    >{getLocalizedText(link.label)}</a
                >
            {/each}
        </nav>
    </div>
</footer>

<style>
    .footer-background-wrapper {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: var(--footer-radius);
        overflow: hidden;
        pointer-events: none;
    }

    .footer-backdrop-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        backdrop-filter: blur(var(--footer-blur, 0px));
        -webkit-backdrop-filter: blur(var(--footer-blur, 0px));
        pointer-events: none;
    }

    .footer-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--footer-overlay-color, #000000);
        opacity: var(--footer-overlay-opacity, 0);
        pointer-events: none;
        transition: opacity 0.3s ease;
    }

    .footer-visual-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        background: var(--footer-bg);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: var(--footer-opacity, 1);
        filter: blur(var(--footer-layer-blur, 0px));
        transform: scale(calc(1 + var(--footer-layer-blur, 0) * 0.01));
        pointer-events: none;
    }

    .blog-footer {
        max-width: var(--max-width, 1200px);
        width: calc(100% - 2 * var(--safe-side-margin, 0px)) !important;
        margin: 0 auto var(--safe-top-margin, 0px) !important;
        padding: 0;
        box-sizing: border-box;
        border-radius: var(--footer-radius);
    }
    .footer-inner {
        max-width: var(--max-width, 1200px);
        margin: 0 auto;
        padding: 2rem var(--side-margin, 0px);
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        position: relative;
        border-radius: var(--footer-radius);
        box-shadow: var(--footer-shadow);
        transition: all 0.3s ease;
    }

    @media (max-width: 768px) {
        .blog-footer {
            width: calc(100% - 2 * var(--safe-side-margin-mobile, 0px)) !important;
            margin: 0 auto var(--safe-top-margin-mobile, 0px) !important;
        }
    }

    p {
        color: inherit;
        font-size: inherit;
        position: relative;
        z-index: 1;
    }
    .footer-nav {
        margin-bottom: 1.2rem;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 1.5rem;
        position: relative;
        z-index: 1;
    }
    .footer-nav a {
        text-decoration: none;
        color: var(--footer-nav-color, #888);
        font-size: var(--footer-nav-font-size, 0.85rem);
        font-weight: 500;
        transition: color 0.2s ease;
    }
    .footer-nav a:hover {
        color: var(--footer-nav-hover-color, var(--primary-color));
    }
    .footer-social {
        margin-top: 1rem;
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        position: relative;
        z-index: 1;
    }
    .footer-social a {
        text-decoration: none;
        color: #555555;
        font-size: 0.85rem;
    }
    .footer-social a:hover {
        color: var(--primary-color);
    }
</style>
