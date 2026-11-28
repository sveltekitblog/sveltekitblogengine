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
    import { page } from "$app/stores";
    import { Rss, Download, ChevronDown } from "lucide-svelte";
    import DynamicBgRenderer from "./DynamicBgRenderer.svelte";
    import { normalizeBackground, getBgValue } from "$lib/utils/background";
    import { onMount } from "svelte";
    import { t } from "$lib/i18n";
    import { FULL_VERSION, sanitizeDesignPresetForSharing } from "@blog/shared";

    let { settings }: { settings: any } = $props();
    let isMobile = $state(false);
    let showShareMenu = $state(false);
    let shareMenuEl = $state<HTMLElement | null>(null);
    let availableSlots = $derived<Array<{ id: string; name: string }>>(
        $page.data?.designSlotInfo?.availableSlots?.length > 0
            ? $page.data.designSlotInfo.availableSlots
            : [{ id: String($page.data?.activeSlotId || "1"), name: "Design 1" }],
    );

    function triggerJsonDownload(data: any, fileBaseName: string) {
        const safeName = (fileBaseName || "slot").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
        const dateStr = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `design-preset-${safeName}-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function downloadSharedSlotPreset(slotId: string, slotName?: string) {
        showShareMenu = false;
        const slotBundles = $page.data?.designSlotInfo?.slots || {};
        const bundled = slotBundles[slotId];
        const activeSlotId = String($page.data?.activeSlotId || "1");

        let designPayload: any = null;
        if (bundled) {
            designPayload = {
                theme: bundled.theme || {},
                header: bundled.header || {},
                footer: bundled.footer || {},
                site_title: settings?.site_title || {},
                widget_shadow_global: bundled.widget_shadow_global || settings?.widget_shadow_global || {},
                layout: bundled.layout || { columnCount: 1, columnWidths: "1fr", mobileColumnCount: 1, mobileColumnWidths: "1fr" },
                widgets: Array.isArray(bundled.widgets) ? bundled.widgets : [],
            };
        } else if (slotId === activeSlotId) {
            designPayload = {
                theme: settings?.theme || {},
                header: settings?.header || {},
                footer: settings?.footer || {},
                site_title: settings?.site_title || {},
                widget_shadow_global: settings?.widget_shadow_global || {},
                layout: $page.data?.activeLayout || { columnCount: 1, columnWidths: "1fr", mobileColumnCount: 1, mobileColumnWidths: "1fr" },
                widgets: Array.isArray($page.data?.layoutWidgets) ? $page.data.layoutWidgets : [],
            };
        }

        if (designPayload) {
            const rawPreset = {
                version: "3.0",
                backupType: "design_preset",
                timestamp: new Date().toISOString(),
                presetName: slotName || `Slot ${slotId}`,
                design: designPayload,
            };
            const sanitized = sanitizeDesignPresetForSharing(rawPreset);
            triggerJsonDownload(sanitized, slotName || `slot-${slotId}`);
            return;
        }

        // 클라이언트 미번들 슬롯일 경우에만 정제된 서버 API로 폴백
        const link = document.createElement("a");
        link.href = `/api/share-design?slot=${encodeURIComponent(slotId)}`;
        link.download = `design-preset-slot-${slotId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    onMount(() => {
        const media = window.matchMedia("(max-width: 768px)");
        isMobile = media.matches;
        const listener = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        media.addEventListener("change", listener);
        const handleOutsideClick = (e: MouseEvent) => {
            if (showShareMenu && shareMenuEl && !shareMenuEl.contains(e.target as Node)) {
                showShareMenu = false;
            }
        };
        document.addEventListener("click", handleOutsideClick);
        return () => {
            media.removeEventListener("change", listener);
            document.removeEventListener("click", handleOutsideClick);
        };
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
            '#334155'}; font-size: {footer.text?.fontSize || '0.9rem'};
            --footer-nav-color: {footer.navColor || '#334155'};
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
                data-sveltekit-reload
                target="_blank"
                rel="noopener noreferrer"
                title="RSS Feed"
                style="display: flex; align-items: center; gap: 0.3rem;"
            >
                <Rss size={15} /> RSS
            </a>
            <span class="engine-version-tag" title="Engine Version">
                {FULL_VERSION}
            </span>
            {#if footer.shareDesign}
                {#if availableSlots.length <= 1}
                    <button
                        type="button"
                        class="footer-share-btn"
                        onclick={() => downloadSharedSlotPreset(availableSlots[0]?.id || "1", availableSlots[0]?.name)}
                        title={$t("blog.footer.share_design")}
                    >
                        <Download size={15} />
                        {$t("blog.footer.share_design")}
                    </button>
                {:else}
                    <div class="footer-share-dropdown" bind:this={shareMenuEl}>
                        <button
                            type="button"
                            class="footer-share-btn"
                            aria-expanded={showShareMenu}
                            onclick={() => (showShareMenu = !showShareMenu)}
                            title={$t("blog.footer.share_design")}
                        >
                            <Download size={15} />
                            {$t("blog.footer.share_design")}
                            <ChevronDown size={13} />
                        </button>
                        {#if showShareMenu}
                            <div class="footer-share-menu" role="menu">
                                {#each availableSlots as slot (slot.id)}
                                    <button
                                        type="button"
                                        class="footer-share-menu-item"
                                        role="menuitem"
                                        onclick={() => downloadSharedSlotPreset(slot.id, slot.name)}
                                    >
                                        <Download size={13} />
                                        <span>{slot.name}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
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
        color: var(--footer-nav-color, #475569);
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
        color: #000000;
    }
    .engine-version-tag {
        opacity: 0.95;
        font-size: 0.75rem;
        font-family: monospace;
        display: inline-flex;
        align-items: center;
        padding: 2px 6px;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 4px;
        color: var(--footer-nav-color, inherit);
        font-weight: 700;
    }
    .footer-share-dropdown {
        position: relative;
        display: inline-flex;
        align-items: center;
    }
    .footer-share-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: none;
        border: none;
        padding: 0;
        color: #555555;
        font-size: 0.85rem;
        font-family: inherit;
        cursor: pointer;
    }
    .footer-share-btn:hover {
        color: #000000;
    }
    .footer-share-menu {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        min-width: 150px;
        background: var(--surface-color, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        z-index: 30;
    }
    .footer-share-menu-item {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text-color, #1e293b);
        font-size: 0.8rem;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }
    .footer-share-menu-item:hover {
        background: rgba(148, 163, 184, 0.16);
    }
</style>
