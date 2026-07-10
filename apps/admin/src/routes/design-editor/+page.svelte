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
    import type { PageData } from "./$types";
    import {
        Layout,
        Palette,
        Boxes,
        FileText,
        Save,
        Plus,
        Trash2,
        MoveHorizontal,
        ChevronRight,
        Monitor,
        Smartphone,
        Link,
        Hash,
        Info,
        Settings,
        GripVertical,
        Menu,
        ChevronUp,
        ChevronDown,
        Home,
        Search,
        User,
        Mail,
        Bell,
        Globe,
        LogIn,
        RefreshCw,
        Download,
        MessageSquare,
        Book,
        Box,
        FolderTree,
        Upload,
        Image,
        Braces,
        LayoutTemplate,
        Columns,
        Layers,
        PlusSquare,
        Type,
        Database,
        Maximize,
        Sparkles,
    } from "lucide-svelte";
    import DynamicBgRenderer from "$lib/components/DynamicBgRenderer.svelte";
    import { validateJS } from "$lib/utils/jsValidator";
    import { onMount } from "svelte";
    import ColorControl from "$lib/components/design-editor/ColorControl.svelte";
    import GradientBuilder from "$lib/components/design-editor/GradientBuilder.svelte";
    import BackgroundControl from "$lib/components/design-editor/BackgroundControl.svelte";
    import ShadowControl from "$lib/components/design-editor/ShadowControl.svelte";
    import DesignPreview from "$lib/components/design-editor/DesignPreview.svelte";
    import AccordionItem from "$lib/components/ui/AccordionItem.svelte";
    import { t } from "$lib/i18n.svelte";

    import { untrack } from "svelte";
    let { data } = $props<{ data: PageData }>();

    // Tabs
    let activeTab = $state("layout");
    let jsEditArea = $state("main"); // header, main, footer
    let activeJsTab = $state("desktop"); // 'desktop' | 'mobile'
    let fullBackupFileName = $state("");
    let designBackupFileName = $derived(
        `blog-design-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );

    // Languages
    let languages = untrack(() => data.languages || []);
    let activeLang = $state(
        untrack(() =>
            languages.length > 0
                ? languages.find((l: any) => l.is_default)?.code ||
                  languages[0].code
                : "ko",
        ),
    );

    interface WidgetInstance {
        id: number;
        widget_id: number;
        name: string;
        type: string;
        custom_title?: string; // 레이아웃별 개별 제목
        column_index: number;
        sort_order: number;
    }

    interface LayoutConfig {
        id: number | null;
        name: string;
        columnCount: number;
        columnWidths: string[];
        is_active: boolean;
    }

    // Editor State (Reactive Runes)
    // Helper: Normalize background data (String -> Object)
    function ensureMenuItemStructure(items: any[]) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return [
                {
                    id: 1,
                    type: "link",
                    label: ensureTranslationObj("Home", "Home"),
                    url: "/",
                    icon: "Home",
                },
                {
                    id: 3,
                    type: "category_drawer",
                    label: ensureTranslationObj("Categories", "Categories"),
                    icon: "Menu",
                },
            ];
        }

        return items
            .map((item, index) => {
                // If old format (no id or type), migrate
                if (typeof item !== "object" || !item) return null;
                return {
                    id: item.id || Date.now() + index,
                    type: item.type || "link",
                    label: ensureTranslationObj(item.label, "Untitled"),
                    url: item.url || "/",
                    icon:
                        item.icon ||
                        (item.type === "category_drawer" ? "Menu" : "Link"),
                };
            })
            .filter(Boolean);
    }

    // Helper: Ensure value is an array (handles JSON strings)
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

    function normalizeBackground(
        bg: any,
        legacyOpacity?: number,
        legacyBlur?: number,
        legacyLayerBlur?: number,
    ) {
        let result: any = { type: "solid", value: "#ffffff" };
        if (!bg) {
            result.opacity = legacyOpacity !== undefined ? legacyOpacity : 1;
            result.blur = legacyBlur !== undefined ? legacyBlur : 0;
            result.layerBlur =
                legacyLayerBlur !== undefined ? legacyLayerBlur : 0;
            return result;
        }

        if (typeof bg === "string") {
            const trimmed = bg.trim();
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && parsed.type) {
                        result = parsed;
                    }
                } catch {
                    result = { type: "solid", value: bg };
                }
            } else {
                result = { type: "solid", value: bg };
            }
        } else if (bg && bg.type) {
            result = { ...bg };
        }

        // Ensure new fields exist for JS backgrounds and effects (use legacy values if available)
        if (result.jsCode === undefined) result.jsCode = "";
        if (result.jsConfig === undefined) result.jsConfig = {};
        if (result.opacity === undefined)
            result.opacity = legacyOpacity !== undefined ? legacyOpacity : 1;
        if (result.blur === undefined)
            result.blur = legacyBlur !== undefined ? legacyBlur : 0;
        if (result.layerBlur === undefined)
            result.layerBlur =
                legacyLayerBlur !== undefined ? legacyLayerBlur : 0;
        if (result.overlayColor === undefined) result.overlayColor = "#000000";
        if (result.overlayOpacity === undefined) result.overlayOpacity = 0;
        if (result.allowMobile === undefined) result.allowMobile = false;
        if (result.fallbackColor === undefined) result.fallbackColor = "";

        // 모바일 설정이 객체인 경우 재귀 정규화 수행
        if (result.mobile !== undefined && result.mobile !== null) {
            result.mobile = normalizeBackground(result.mobile);
        }

        return result;
    }

    // Helper: Normalize radius data (Ensure numbers)
    function normalizeRadius(radius: any) {
        if (!radius)
            return { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
        return {
            topLeft:
                parseInt(String(radius.topLeft || 0).replace("px", "")) || 0,
            topRight:
                parseInt(String(radius.topRight || 0).replace("px", "")) || 0,
            bottomLeft:
                parseInt(String(radius.bottomLeft || 0).replace("px", "")) || 0,
            bottomRight:
                parseInt(String(radius.bottomRight || 0).replace("px", "")) ||
                0,
        };
    }

    // Helper: Migrate string to translation string object
    function ensureTranslationObj(val: any, fallbackStr: string = "") {
        if (!val) {
            const temp: Record<string, string> = {};
            languages.forEach((l: any) => (temp[l.code] = fallbackStr));
            return temp;
        }

        let parsedVal = val;
        if (typeof val === "string") {
            try {
                parsedVal = JSON.parse(val);
                if (typeof parsedVal === "string")
                    parsedVal = { ko: parsedVal };
            } catch (e) {
                parsedVal = { ko: val };
            }
        }

        if (typeof parsedVal === "object" && parsedVal !== null) {
            languages.forEach((l: any) => {
                if (!parsedVal[l.code]) parsedVal[l.code] = fallbackStr;
            });
            return parsedVal;
        }

        return {};
    }

    // Editor State (Reactive Runes)
    let themeConfig = $state(
        untrack(() => ({
            primary: data.settings.theme?.primary || "#3b82f6",
            secondary: data.settings.theme?.secondary || "#64748b",
            bodyBackground: normalizeBackground(
                data.settings.theme?.bodyBackground ||
                    data.settings.theme?.background ||
                    "#f8fafc",
                data.settings.theme?.bodyBackgroundOpacity,
                data.settings.theme?.bodyBackgroundBlur,
            ),
            text: data.settings.theme?.text || "#1e293b",
            accent: data.settings.theme?.accent || "#10b981",
            cardBg: data.settings.theme?.cardBg || "#ffffff",
            border: data.settings.theme?.border || "#e2e8f0",
            sideMargin: data.settings.theme?.sideMargin || "1.5rem",
            fontFamily: data.settings.theme?.fontFamily || "Inter",
            googleFontName: data.settings.theme?.googleFontName || "",
            baseFontSize: data.settings.theme?.baseFontSize || "16px",
            mobileBaseFontSize: data.settings.theme?.mobileBaseFontSize || "",
            maxWidth:
                data.settings.theme?.maxWidth ||
                data.settings.header?.maxWidth ||
                "1200px",
            headerBodySpacing: data.settings.theme?.headerBodySpacing || "1rem",
            bodyFooterSpacing: data.settings.theme?.bodyFooterSpacing || "1rem",
            widgetItemStyle: {
                fontSize:
                    data.settings.theme?.widgetItemStyle?.fontSize || "0.95rem",
                fontWeight:
                    data.settings.theme?.widgetItemStyle?.fontWeight || "600",
                color: data.settings.theme?.widgetItemStyle?.color || "",
                fontFamily:
                    data.settings.theme?.widgetItemStyle?.fontFamily || "",
                padding:
                    data.settings.theme?.widgetItemStyle?.padding || "1.5rem",
            },
            widgetTitleStyle: {
                fontSize:
                    data.settings.theme?.widgetTitleStyle?.fontSize || "1.1rem",
                fontWeight:
                    data.settings.theme?.widgetTitleStyle?.fontWeight || "700",
                color: data.settings.theme?.widgetTitleStyle?.color || "",
                fontFamily:
                    data.settings.theme?.widgetTitleStyle?.fontFamily || "",
            },
        })),
    );

    const normalizePadding = (val: any) => {
        if (typeof val === "object" && val !== null) {
            return {
                top: val.top ?? 0,
                right: val.right ?? 0,
                bottom: val.bottom ?? 0,
                left: val.left ?? 0,
            };
        }
        // Legacy string conversion if needed
        return { top: 0, right: 0, bottom: 0, left: 0 };
    };

    let siteTitleConfig = $state(
        untrack(() =>
            ensureTranslationObj(
                data.settings.site_title || data.settings.header?.logoText,
                "Blog",
            ),
        ),
    );

    let headerConfig = $state(
        untrack(() => ({
            logoText: ensureTranslationObj(
                data.settings.header?.logoText || data.settings.site_title,
                "Blog",
            ),
            logoFont: data.settings.header?.logoFont || "Inter",
            logoFontSize: data.settings.header?.logoFontSize || "1.5rem",
            logoAlignment: data.settings.header?.logoAlignment || "left", // left, center
            sideMargin: data.settings.header?.sideMargin || "0",
            showBorderBottom: data.settings.header?.showBorderBottom === true,
            logoPadding: normalizePadding(data.settings.header?.logoPadding),
            navPadding: normalizePadding(data.settings.header?.navPadding),
            logoColor: normalizeBackground(
                data.settings.header?.logoColor || "#000000",
            ),
            logoHoverEffect: data.settings.header?.logoHoverEffect || "scale",
            logoHoverScale: data.settings.header?.logoHoverScale ?? 1.02,
            logoHoverColor: data.settings.header?.logoHoverColor || {
                type: "solid",
                value: "",
            },
            logoHoverFloatOffset:
                data.settings.header?.logoHoverFloatOffset ?? 2,
            logoHoverShadowEnabled:
                data.settings.header?.logoHoverShadowEnabled === true,
            logoHoverShadowColor: data.settings.header
                ?.logoHoverShadowColor || {
                type: "solid",
                value: "rgba(59, 130, 246, 0.2)",
            },
            logoFontWeight: data.settings.header?.logoFontWeight || "700",
            logoLetterSpacing: data.settings.header?.logoLetterSpacing || "0px",
            navAlignment: data.settings.header?.navAlignment || "right",
            headerLayout: data.settings.header?.headerLayout || "single-line",
            logoVerticalAlignment:
                data.settings.header?.logoVerticalAlignment || "middle",
            navVerticalAlignment:
                data.settings.header?.navVerticalAlignment || "middle",
            scrolledLogoVerticalAlignment:
                data.settings.header?.scrolledLogoVerticalAlignment || "middle",
            scrolledLogoAlignment:
                data.settings.header?.scrolledLogoAlignment || "left",
            scrolledNavAlignment:
                data.settings.header?.scrolledNavAlignment || "right",
            scrolledNavVerticalAlignment:
                data.settings.header?.scrolledNavVerticalAlignment || "middle",
            scrolledHeight: data.settings.header?.scrolledHeight || "",
            scrolledMaxWidth: data.settings.header?.scrolledMaxWidth || "",
            scrolledNavSpacing: data.settings.header?.scrolledNavSpacing || "",
            scrolledLogoPadding: normalizePadding(
                data.settings.header?.scrolledLogoPadding,
            ),
            scrolledNavPadding: normalizePadding(
                data.settings.header?.scrolledNavPadding,
            ),
            navSpacing: data.settings.header?.navSpacing || "1.5rem",
            navTextColor: data.settings.header?.navTextColor || "",
            navHoverBackground: data.settings.header?.navHoverBackground || {
                type: "solid",
                value: "rgba(0,0,0,0.05)",
            },
            navHoverTextColor: data.settings.header?.navHoverTextColor || "",
            showCategories: data.settings.header?.showCategories !== false,
            showLanguageSwitcher:
                data.settings.header?.showLanguageSwitcher !== false,
            loginLabel: ensureTranslationObj(
                data.settings.header?.loginLabel,
                "Login",
            ),
            profileLabel: ensureTranslationObj(
                data.settings.header?.profileLabel,
                "Profile",
            ),
            menuItems: ensureMenuItemStructure(
                ensureArray(data.settings.header?.menuItems),
            ),
            headerBackground: normalizeBackground(
                data.settings.header?.headerBackground || "#ffffff",
                data.settings.header?.headerBackgroundOpacity,
                data.settings.header?.headerBackgroundBlur,
            ),
            headerBackgroundBlur:
                data.settings.header?.headerBackgroundBlur ?? 0,
            headerBackgroundOpacity:
                data.settings.header?.headerBackgroundOpacity ?? 1,
            useBottomFade: data.settings.header?.useBottomFade ?? false,
            bottomFadeStrength: data.settings.header?.bottomFadeStrength ?? 20,
            useTextShadow: data.settings.header?.useTextShadow ?? false,
            headerBackgroundOverlayColor:
                data.settings.header?.headerBackgroundOverlayColor || "#000000",
            headerBackgroundOverlayOpacity:
                data.settings.header?.headerBackgroundOverlayOpacity ?? 0,
            maxWidth: data.settings.header?.maxWidth || "1200px",
            height: data.settings.header?.height || "auto",
            borderRadius: normalizeRadius(
                data.settings.header?.borderRadius || {
                    topLeft: 0,
                    topRight: 0,
                    bottomLeft: 12,
                    bottomRight: 12,
                },
            ),
            boxShadow:
                data.settings.header?.boxShadow ||
                "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            mobile: {
                height: data.settings.header?.mobile?.height || "",
                logoFontSize: data.settings.header?.mobile?.logoFontSize || "",
                logoPadding: normalizePadding(
                    data.settings.header?.mobile?.logoPadding,
                ),
                navPadding: normalizePadding(
                    data.settings.header?.mobile?.navPadding,
                ),
                navSpacing: data.settings.header?.mobile?.navSpacing || "",
                logoAlignment:
                    data.settings.header?.mobile?.logoAlignment || "left",
                logoVerticalAlignment: "middle",
                navAlignment:
                    data.settings.header?.mobile?.navAlignment || "right",
                navVerticalAlignment: "middle",
                showLanguageSwitcher:
                    data.settings.header?.mobile?.showLanguageSwitcher !==
                    false,
                menuItems: ensureMenuItemStructure(
                    ensureArray(data.settings.header?.mobile?.menuItems),
                ),
            },
        })),
    );

    // 사용자가 입력한 구글 폰트 설정으로부터 동적 웹 폰트 선택지 추출 (Svelte 5 Derived Rune)
    let customWebFonts = $derived.by(() => {
        const fonts = new Set<string>();

        // 사용자가 googleFontName에 입력한 목록을 파싱 (예: "Noto Serif KR, Newsreader")
        if (themeConfig.googleFontName) {
            themeConfig.googleFontName.split(/[,;]/).forEach((f) => {
                const trimmed = f.trim().replace(/['"]/g, "");
                if (trimmed) fonts.add(trimmed);
            });
        }

        // 현재 설정되어 있는 로고 폰트가 "inherit"이나 "Inter"가 아니라면 선택이 가능하도록 목록에 항시 포함
        if (headerConfig.logoFont && !["inherit", "Inter"].includes(headerConfig.logoFont)) {
            fonts.add(headerConfig.logoFont.trim().replace(/['"]/g, ""));
        }

        return Array.from(fonts);
    });

    let footerConfig = $state(
        untrack(() => ({
            copyright: ensureTranslationObj(
                data.settings.footer?.copyright,
                "© 2026 Blog. All rights reserved.",
            ),
            showBorderTop: data.settings.footer?.showBorderTop !== false,
            socialLinks: ensureArray(data.settings.footer?.socialLinks),
            navLinks: ensureArray(data.settings.footer?.navLinks).map(
                (link: any) => ({
                    ...link,
                    label: ensureTranslationObj(link.label, "Link"),
                }),
            ),
            navFontSize: data.settings.footer?.navFontSize || "0.85rem",
            navColor: data.settings.footer?.navColor || "#888888",
            navHoverColor: data.settings.footer?.navHoverColor || "",
            footerBackground: normalizeBackground(
                data.settings.footer?.footerBackground || "#ffffff",
                data.settings.footer?.footerBackgroundOpacity,
                data.settings.footer?.footerBackgroundBlur,
            ),
            maxWidth: data.settings.footer?.maxWidth || "1200px",
            text: {
                color:
                    data.settings.footer?.text?.color ||
                    data.settings.theme?.secondary ||
                    "#64748b",
                fontSize: data.settings.footer?.text?.fontSize || "0.875rem",
            },
            borderRadius: normalizeRadius(
                data.settings.footer?.borderRadius || {
                    topLeft: 12,
                    topRight: 12,
                    bottomLeft: 0,
                    bottomRight: 0,
                },
            ),
            boxShadow: data.settings.footer?.boxShadow || "none",
            footerBackgroundBlur:
                data.settings.footer?.footerBackgroundBlur ?? 0,
            footerBackgroundOpacity:
                data.settings.footer?.footerBackgroundOpacity ?? 1,
            shareDesign: data.settings.footer?.shareDesign ?? false,
            mobile: {
                copyright: ensureTranslationObj(
                    data.settings.footer?.mobile?.copyright,
                    "",
                ),
                navLinks: ensureArray(
                    data.settings.footer?.mobile?.navLinks,
                ).map((link: any) => ({
                    ...link,
                    label: ensureTranslationObj(link.label, "Link"),
                })),
                navFontSize: data.settings.footer?.mobile?.navFontSize || "",
                navColor: data.settings.footer?.mobile?.navColor || "",
                navHoverColor:
                    data.settings.footer?.mobile?.navHoverColor || "",
                text: {
                    color: data.settings.footer?.mobile?.text?.color || "",
                    fontSize:
                        data.settings.footer?.mobile?.text?.fontSize || "",
                },
                borderRadius: normalizeRadius(
                    data.settings.footer?.mobile?.borderRadius || {
                        topLeft: 0,
                        topRight: 0,
                        bottomLeft: 0,
                        bottomRight: 0,
                    },
                ),
                boxShadow: data.settings.footer?.mobile?.boxShadow || "",
            },
        })),
    );

    let globalCss = $state(
        untrack(
            () =>
                data.settings.global_css ||
                "/* Global Post Styles */\n.post-content {\n  line-height: 1.8;\n  color: var(--text-color);\n}",
        ),
    );

    let headCode = $state(untrack(() => data.settings.head_code || ""));
    let widgetShadowGlobal = $state(
        untrack(() => ({
            enabled: data.settings.widget_shadow_global?.enabled || false,
            normal: data.settings.widget_shadow_global?.normal || "none",
            hover: data.settings.widget_shadow_global?.hover || "none",
            hoverTranslateY:
                data.settings.widget_shadow_global?.hoverTranslateY ?? -2,
        })),
    );

    // Layout State
    let currentLayout = $state(
        untrack(() => ({
            id: data.activeLayout?.id || null,
            name: data.activeLayout?.name || "New Layout",
            columnCount: data.activeLayout?.column_count || 1,
            columnWidths: data.activeLayout?.column_widths?.split(" ") || [
                "1fr",
            ],
            is_active: data.activeLayout?.is_active === 1,
        })),
    );

    let initialColumnWidgets = untrack(() =>
        Array.from({ length: data.activeLayout?.column_count || 1 }, (_, i) =>
            (data.layoutWidgets || [])
                .filter(
                    (lw: any) =>
                        lw.column_index === i && lw.device !== "mobile", // exclude mobile-only widgets
                )
                .map((lw: any) => ({
                    id: lw.id,
                    widget_id: lw.widget_id || lw.widgetId,
                    name: lw.widget_name || lw.name,
                    type: lw.widget_type || lw.type,
                    custom_title: ensureTranslationObj(lw.custom_title, ""),
                    column_index: lw.column_index,
                    sort_order: lw.sort_order,
                    config: (() => {
                        try {
                            if (!lw.widget_config) return {};
                            return typeof lw.widget_config === "string"
                                ? JSON.parse(lw.widget_config)
                                : lw.widget_config;
                        } catch {
                            return {};
                        }
                    })(),
                    device: "desktop",
                }))
                .sort((a: any, b: any) => a.sort_order - b.sort_order),
        ),
    );
    let columnWidgets = $state<WidgetInstance[][]>(initialColumnWidgets);

    let layoutWidgets = $derived(columnWidgets.flat());

    // --- Mobile Layout State ---
    let mobileColumnCount = $state(
        untrack(() => data.activeLayout?.mobile_column_count || 1),
    );
    let mobileColumnWidths = $state<string[]>(
        untrack(() =>
            (data.activeLayout?.mobile_column_widths || "1fr")
                .split(" ")
                .filter(Boolean),
        ),
    );
    let initialMobileColumnWidgets = untrack(() =>
        Array.from(
            { length: data.activeLayout?.mobile_column_count || 1 },
            (_, i) =>
                (data.layoutWidgets || [])
                    .filter(
                        (lw: any) =>
                            lw.device === "mobile" && lw.column_index === i,
                    )
                    .map((lw: any) => ({
                        id: lw.id,
                        widget_id: lw.widget_id || lw.widgetId,
                        name: lw.widget_name || lw.name,
                        type: lw.widget_type || lw.type,
                        custom_title: ensureTranslationObj(lw.custom_title, ""),
                        column_index: lw.column_index,
                        sort_order: lw.sort_order,
                        config: (() => {
                            try {
                                if (!lw.widget_config) return {};
                                return typeof lw.widget_config === "string"
                                    ? JSON.parse(lw.widget_config)
                                    : lw.widget_config;
                            } catch {
                                return {};
                            }
                        })(),
                        device: "mobile",
                    }))
                    .sort((a: any, b: any) => a.sort_order - b.sort_order),
        ),
    );
    let mobileColumnWidgets = $state<any[][]>(initialMobileColumnWidgets);
    let mobileLayoutWidgets = $derived(mobileColumnWidgets.flat());

    let availableWidgets = $state<any[]>(
        untrack(() =>
            (data.widgets || []).map((w: any) => ({
                ...w,
                id: `master-${w.id}`,
            })),
        ),
    );
    let previewMode = $state("desktop"); // desktop, mobile

    // Style Helper: Convert background config to CSS string
    function getBgStyle(config: { type: string; value: string }) {
        if (!config || config.type === "inherit")
            return "background-color: transparent; background-image: none;";
        if (config.type === "solid")
            return `background-color: ${config.value}; background-image: none;`;
        if (config.type === "gradient")
            return `background-image: ${config.value}; background-color: transparent;`;
        if (config.type === "image")
            return `background-image: url(${config.value}); background-size: cover; background-position: center; background-color: transparent;`;
        return "background-color: transparent; background-image: none;";
    }

    function getBgValue(config: any) {
        if (!config) return "transparent";
        if (typeof config === "string") return config;
        if (config.type === "inherit" || config.type === "none")
            return "transparent";
        if (config.type === "solid") return config.value;
        if (config.type === "gradient") return config.value;
        if (config.type === "image") return `url("${config.value}")`;
        return config.value || "transparent";
    }

    function getTextStyle(config: { type: string; value: string }) {
        if (!config || config.type === "inherit") return "";
        if (config.type === "solid") return `color: ${config.value};`;
        if (config.type === "gradient") {
            return `background-image: ${config.value}; -webkit-background-clip: text; background-clip: text; color: transparent; display: inline-block;`;
        }
        return "";
    }

    function adjustColumnWidth(index: number, delta: number) {
        const current = currentLayout.columnWidths[index];
        const value = parseFloat(current.replace("fr", "")) || 1;
        const newValue = Math.max(0.1, value + delta);
        currentLayout.columnWidths[index] = `${newValue}fr`;
    }

    function handleWidthBlur(index: number) {
        let val = currentLayout.columnWidths[index].trim();
        if (!val) {
            currentLayout.columnWidths[index] = "1fr";
            return;
        }
        if (!val.endsWith("fr") && !isNaN(parseFloat(val))) {
            currentLayout.columnWidths[index] = parseFloat(val) + "fr";
        }
    }

    // Gradient Builder State & Helpers (Isolated per section)
    let bodyGradient = $state({ stops: ["#3b82f6", "#1e3a8a"], angle: 180 });
    let headerGradient = $state({ stops: ["#3b82f6", "#1e3a8a"], angle: 180 });
    let footerGradient = $state({ stops: ["#3b82f6", "#1e3a8a"], angle: 180 });
    let logoGradient = $state({ stops: ["#3b82f6", "#1e3a8a"], angle: 180 });
    let logoHoverGradient = $state({
        stops: ["#3b82f6", "#1e3a8a"],
        angle: 180,
    });


    // 테마 설정 로드 시 logoHoverColor 및 logoHoverShadowColor 그라데이션 값 역파싱 복원
    $effect(() => {
        if (!headerConfig) return;

        untrack(() => {
            // 1. 호버 컬러 그라데이션 파싱 복원
            if (
                headerConfig.logoHoverColor?.type === "gradient" &&
                headerConfig.logoHoverColor?.value &&
                headerConfig.logoHoverColor?.value.includes("linear-gradient")
            ) {
                const val = headerConfig.logoHoverColor.value;
                const angleMatch = val.match(/linear-gradient\((\d+)deg/);
                if (angleMatch) {
                    logoHoverGradient.angle = parseInt(angleMatch[1]);
                }
                const stopsPart = val
                    .replace(/linear-gradient\(\d+deg,\s*/, "")
                    .replace(/\)$/, "");
                if (stopsPart) {
                    logoHoverGradient.stops =
                        stopsPart.split(/,\s*(?![^(]*\))/);
                }
            }


        });
    });
    let bodyMobileGradient = $state({
        stops: ["#3b82f6", "#1e3a8a"],
        angle: 180,
    });
    let headerMobileGradient = $state({
        stops: ["#3b82f6", "#1e3a8a"],
        angle: 180,
    });
    let footerMobileGradient = $state({
        stops: ["#3b82f6", "#1e3a8a"],
        angle: 180,
    });

    // Header Menu Order
    function moveMenuUp(index: number) {
        if (index <= 0) return;
        const items = [...headerConfig.menuItems];
        [items[index - 1], items[index]] = [items[index], items[index - 1]];
        headerConfig.menuItems = items;
    }

    function moveMenuDown(index: number) {
        if (index >= headerConfig.menuItems.length - 1) return;
        const items = [...headerConfig.menuItems];
        [items[index + 1], items[index]] = [items[index], items[index + 1]];
        headerConfig.menuItems = items;
    }

    // Icon Picker
    let showIconPicker = $state<number | string | null>(null);
    const commonIcons = [
        { name: "Home", component: Home },
        { name: "Book", component: Book },
        { name: "FileText", component: FileText },
        { name: "Layout", component: Layout },
        { name: "Search", component: Search },
        { name: "User", component: User },
        { name: "Mail", component: Mail },
        { name: "Bell", component: Bell },
        { name: "Globe", component: Globe },
        { name: "MessageSquare", component: MessageSquare },
        { name: "Settings", component: Settings },
        { name: "Link", component: Link },
        { name: "Hash", component: Hash },
        { name: "Info", component: Info },
        { name: "Plus", component: Plus },
        { name: "Trash2", component: Trash2 },
        { name: "Box", component: Box },
        { name: "FolderTree", component: FolderTree },
    ];

    function selectIcon(menuId: number | string, iconName: string) {
        const item = headerConfig.menuItems.find((m) => m.id === menuId);
        if (item) {
            item.icon = iconName;
        }
        showIconPicker = null;
    }

    // Icon component map for rendering
    const iconMap: Record<string, any> = {
        Home,
        FileText,
        Menu,
        Link,
        Search,
        User,
        Mail,
        Bell,
        Globe,
        Settings,
        Info,
        Hash,
        ChevronUp,
        ChevronDown,
        Plus,
        Trash2,
        MessageSquare,
        Book,
        Box,
        FolderTree,
    };

    function getCategorySlug(configStr: string) {
        try {
            const config = JSON.parse(configStr);
            return config.category_slug || "";
        } catch (e) {
            return "";
        }
    }

    // Helpers
    function addColumn() {
        if (currentLayout.columnCount < 3) {
            currentLayout.columnCount++;
            currentLayout.columnWidths = Array(currentLayout.columnCount).fill(
                "1fr",
            );
            columnWidgets = [...columnWidgets, []];
        }
    }

    function removeColumn() {
        if (currentLayout.columnCount > 1) {
            const removedIdx = currentLayout.columnCount - 1;
            const removedItems = columnWidgets[removedIdx] || [];

            currentLayout.columnCount--;
            currentLayout.columnWidths = currentLayout.columnWidths.slice(
                0,
                currentLayout.columnCount,
            );
            columnWidgets = columnWidgets.slice(0, currentLayout.columnCount);

            // Move items from removed column to the new last column
            const targetIdx = currentLayout.columnCount - 1;
            columnWidgets[targetIdx] = [
                ...columnWidgets[targetIdx],
                ...removedItems.map((w) => ({ ...w, column_index: targetIdx })),
            ];
        }
    }

    function addWidgetToLayout(widget: any, colIndex: number) {
        const widgetId =
            typeof widget.id === "string"
                ? parseInt(widget.id.replace("master-", ""))
                : widget.id;

        const rawConfig = widget.config;
        let parsedConfig: any = {};
        if (rawConfig) {
            if (typeof rawConfig === "string") {
                try {
                    parsedConfig = JSON.parse(rawConfig);
                } catch {
                    parsedConfig = {};
                }
            } else {
                parsedConfig = { ...rawConfig };
            }
        }

        const newInstance = {
            id: Date.now(), // temp id
            widget_id: widgetId,
            name: widget.name,
            type: widget.type,
            config: parsedConfig,
            custom_title: ensureTranslationObj("", ""),
            column_index: colIndex,
            sort_order: columnWidgets[colIndex].length,
            device: "desktop",
        };
        columnWidgets[colIndex] = [...columnWidgets[colIndex], newInstance];
    }

    function moveWidget(
        colIdx: number,
        itemIdx: number,
        direction: "up" | "down",
    ) {
        const targetWidgets =
            previewMode === "desktop" ? columnWidgets : mobileColumnWidgets;
        const col = [...targetWidgets[colIdx]];
        if (!col) return;

        if (direction === "up" && itemIdx > 0) {
            const temp = col[itemIdx];
            col[itemIdx] = col[itemIdx - 1];
            col[itemIdx - 1] = temp;
        } else if (direction === "down" && itemIdx < col.length - 1) {
            const temp = col[itemIdx];
            col[itemIdx] = col[itemIdx + 1];
            col[itemIdx + 1] = temp;
        }

        targetWidgets[colIdx] = col;
        if (previewMode === "desktop") columnWidgets = [...columnWidgets];
        else mobileColumnWidgets = [...mobileColumnWidgets];

        // 변경된 배치 순서에 맞게 sort_order와 column_index 재정렬 및 동기화
        if (previewMode === "desktop") {
            columnWidgets = columnWidgets.map((col, cIdx) =>
                col.map((w, wIdx) => ({
                    ...w,
                    sort_order: wIdx,
                    column_index: cIdx,
                })),
            );
        } else {
            mobileColumnWidgets = mobileColumnWidgets.map((col, cIdx) =>
                col.map((w, wIdx) => ({
                    ...w,
                    sort_order: wIdx,
                    column_index: cIdx,
                })),
            );
        }
    }

    function moveWidgetToCol(
        sourceColIdx: number,
        itemIdx: number,
        targetColIdx: number,
    ) {
        if (sourceColIdx === targetColIdx) return;
        const targetWidgets =
            previewMode === "desktop" ? columnWidgets : mobileColumnWidgets;

        const sourceCol = [...targetWidgets[sourceColIdx]];
        const targetCol = [...targetWidgets[targetColIdx]];
        if (!sourceCol || !targetCol) return;

        const item = sourceCol[itemIdx];
        sourceCol.splice(itemIdx, 1);
        item.column_index = targetColIdx;
        targetCol.push(item);

        targetWidgets[sourceColIdx] = sourceCol;
        targetWidgets[targetColIdx] = targetCol;
        if (previewMode === "desktop") columnWidgets = [...columnWidgets];
        else mobileColumnWidgets = [...mobileColumnWidgets];

        // 컬럼 이동 이후 인덱스 정보 전체 재정렬 및 동기화
        if (previewMode === "desktop") {
            columnWidgets = columnWidgets.map((col, cIdx) =>
                col.map((w, wIdx) => ({
                    ...w,
                    sort_order: wIdx,
                    column_index: cIdx,
                })),
            );
        } else {
            mobileColumnWidgets = mobileColumnWidgets.map((col, cIdx) =>
                col.map((w, wIdx) => ({
                    ...w,
                    sort_order: wIdx,
                    column_index: cIdx,
                })),
            );
        }
    }
    function removeWidgetFromLayout(tempId: number | string) {
        columnWidgets = columnWidgets.map((col) =>
            col.filter((w) => String(w.id) !== String(tempId)),
        );
    }

    // --- Mobile Layout Helpers ---
    function addMobileColumn() {
        if (mobileColumnCount < 3) {
            mobileColumnCount++;
            mobileColumnWidths = [...mobileColumnWidths, "1fr"];
            mobileColumnWidgets = [...mobileColumnWidgets, []];
        }
    }

    function removeMobileColumn() {
        if (mobileColumnCount > 1) {
            const removedIdx = mobileColumnCount - 1;
            const removedItems = mobileColumnWidgets[removedIdx] || [];
            mobileColumnCount--;
            mobileColumnWidths = mobileColumnWidths.slice(0, mobileColumnCount);
            mobileColumnWidgets = mobileColumnWidgets.slice(
                0,
                mobileColumnCount,
            );
            const targetIdx = mobileColumnCount - 1;
            mobileColumnWidgets[targetIdx] = [
                ...mobileColumnWidgets[targetIdx],
                ...removedItems.map((w) => ({ ...w, column_index: targetIdx })),
            ];
        }
    }

    function addMobileWidgetToLayout(widget: any, colIndex: number) {
        const widgetId =
            typeof widget.id === "string"
                ? parseInt(widget.id.replace("master-", ""))
                : widget.id;
        const newInstance = {
            id: Date.now() + Math.random(),
            widget_id: widgetId,
            name: widget.name,
            type: widget.type,
            custom_title: ensureTranslationObj("", ""),
            column_index: colIndex,
            sort_order: mobileColumnWidgets[colIndex].length,
            device: "mobile",
        };
        mobileColumnWidgets[colIndex] = [
            ...mobileColumnWidgets[colIndex],
            newInstance,
        ];
    }

    function removeMobileWidgetFromLayout(tempId: number | string) {
        mobileColumnWidgets = mobileColumnWidgets.map((col) =>
            col.filter((w) => String(w.id) !== String(tempId)),
        );
    }

    // Widgets
    let newWidgetName = $state("");
    let newWidgetType = $state("RecentPosts");
    let newWidgetSlug = $state("");
    let newWidgetShadow = $state({
        useGlobal: true,
        normal: "none",
        hover: "none",
        hoverTranslateY: -2,
    });
    let newWidgetItemStyle = $state({
        fontSize: "",
        fontWeight: "600",
        color: "",
        fontFamily: "",
        padding: "1.5rem",
    });
    const DEFAULT_WIDGET_LIMIT = 5;
    let editingWidgetId = $state<number | null>(null);
    let editWidgetName = $state("");
    let editWidgetType = $state("");
    let editWidgetSlug = $state("");

    // 타입 전환 시 설정값 유실 방지용 전용 격리 메모리 $state 맵 추가
    let widgetEditMemory = $state<Record<string, any>>({
        category_link: "",
        HtmlWidget: "",
    });
    let widgetCreateMemory = $state<Record<string, any>>({
        category_link: "",
        HtmlWidget: "",
    });

    let editWidgetShadow = $state({
        useGlobal: true,
        normal: "none",
        hover: "none",
        hoverTranslateY: -2,
    });
    let editWidgetUseShadowDom = $state(false);
    let newWidgetLimit = $state<number>(DEFAULT_WIDGET_LIMIT);
    let editWidgetLimit = $state<number>(DEFAULT_WIDGET_LIMIT);

    // --- Widget Advanced Settings Modal State ---
    let showWidgetModal = $state(false);
    let editingWidgetInstance = $state<any>(null);
    let editingWidgetConfig = $state<any>({});

    // Default PostContent config template
    const defaultPostContentConfig = {
        columns: 2,
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

    // Track the full (nested) config so saveWidgetSettings can merge back
    let editingWidgetFullConfig = $state<any>({});
    // Track which device is being edited (explicitly set by button click)
    let editingDevice = $state<"desktop" | "mobile">("desktop");

    function openWidgetSettings(widget: any, device?: "desktop" | "mobile") {
        editingWidgetInstance = widget;
        editingDevice = device || (previewMode as "desktop" | "mobile");

        // 1. Parse raw config
        let rawConfig: any = {};
        try {
            if (widget.config && typeof widget.config === "string") {
                rawConfig = JSON.parse(widget.config);
            } else if (widget.config) {
                rawConfig = { ...widget.config };
            }
        } catch (e) {
            rawConfig = {};
        }

        // 2. PostContent: handle nested {desktop:{...}, mobile:{...}} structure
        if (widget.type === "PostContent") {
            editingWidgetFullConfig = { ...rawConfig };
            const isNested = rawConfig.desktop || rawConfig.mobile;
            const device = editingDevice; // "desktop" | "mobile"

            if (isNested) {
                // Load device-specific section, fallback to opposite device, then defaults
                editingWidgetConfig = {
                    ...defaultPostContentConfig,
                    ...(rawConfig.desktop || {}),
                    ...(device === "mobile" ? rawConfig.mobile || {} : {}),
                };
            } else if (Object.keys(rawConfig).length > 0) {
                // Legacy flat config — treat as desktop, use defaults for mobile
                editingWidgetFullConfig = { desktop: { ...rawConfig } };
                if (device === "mobile") {
                    editingWidgetConfig = { ...defaultPostContentConfig };
                } else {
                    editingWidgetConfig = { ...rawConfig };
                }
            } else {
                // Empty config — use defaults for both
                editingWidgetFullConfig = {};
                editingWidgetConfig = { ...defaultPostContentConfig };
            }
        } else if (widget.type === "TagCloud" || widget.type === "tag_cloud") {
            const defaultTagConfig = { sortOrder: "popular", maxTags: 20 };
            editingWidgetFullConfig = { ...rawConfig };
            const isNested = rawConfig.desktop || rawConfig.mobile;
            const device = editingDevice;

            if (isNested) {
                editingWidgetConfig = {
                    ...defaultTagConfig,
                    ...(rawConfig.desktop || {}),
                    ...(device === "mobile" ? rawConfig.mobile || {} : {}),
                };
            } else if (Object.keys(rawConfig).length > 0) {
                editingWidgetFullConfig = { desktop: { ...rawConfig } };
                if (device === "mobile") {
                    editingWidgetConfig = { ...defaultTagConfig };
                } else {
                    editingWidgetConfig = { ...rawConfig };
                }
            } else {
                editingWidgetFullConfig = {};
                editingWidgetConfig = { ...defaultTagConfig };
            }
        } else {
            editingWidgetFullConfig = {};
            editingWidgetConfig =
                typeof widget.config === "string"
                    ? JSON.parse(widget.config || "{}")
                    : widget.config || {};
        }

        showWidgetModal = true;
    }

    function closeWidgetModal() {
        showWidgetModal = false;
        editingWidgetInstance = null;
        editingWidgetConfig = {};
        editingDevice = "desktop";
    }

    async function saveWidgetSettings() {
        if (!editingWidgetInstance) return;

        try {
            const targetWidgetId = editingWidgetInstance.widget_id;
            const isPostContent = editingWidgetInstance.type === "PostContent";
            const isTagCloud =
                editingWidgetInstance.type === "TagCloud" ||
                editingWidgetInstance.type === "tag_cloud";

            // Build the final config to save
            let finalConfig: any;
            if (isPostContent || isTagCloud) {
                // Merge current edits into the nested structure
                const device = editingDevice; // "desktop" | "mobile"
                finalConfig = { ...editingWidgetFullConfig };
                finalConfig[device] = { ...editingWidgetConfig };
                // Ensure the nested structure has both keys
                const defaultCfg = isTagCloud
                    ? { sortOrder: "popular", maxTags: 20 }
                    : { ...defaultPostContentConfig };
                if (!finalConfig.desktop)
                    finalConfig.desktop = { ...defaultCfg };
                if (!finalConfig.mobile) finalConfig.mobile = { ...defaultCfg };
                // Remove any legacy flat keys at root level
                const flatKeys = Object.keys(defaultCfg);
                flatKeys.forEach((k) => {
                    delete finalConfig[k];
                });
            } else {
                finalConfig = editingWidgetConfig;
            }

            const configString = JSON.stringify(finalConfig);

            const widgetRef = availableWidgets.find(
                (w) => parseInt(w.id.replace("master-", "")) === targetWidgetId,
            );
            let widgetName = editingWidgetInstance.name || "Widget";
            if (widgetRef) {
                widgetRef.config = configString;
                widgetName = widgetRef.name;
            }

            // Sync with the ORIGINAL source arrays (columnWidgets, mobileColumnWidgets)
            // so ThemePreview picks up updated config on next modal open.
            // Note: columnWidgets stores config as parsed objects, not strings.
            for (const col of columnWidgets) {
                for (const w of col) {
                    if (w.widget_id === targetWidgetId) {
                        w.config = finalConfig;
                    }
                }
            }
            for (const col of mobileColumnWidgets) {
                for (const w of col) {
                    if (w.widget_id === targetWidgetId) {
                        w.config = finalConfig;
                    }
                }
            }

            // Save permanently to the DB
            const formData = new FormData();
            formData.append("id", targetWidgetId.toString());
            formData.append("name", widgetName);
            formData.append("config", configString);

            const res = await fetch("?/updateWidget", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                console.error("Failed to update widget config in DB");
            }
        } catch (e) {
            console.error(e);
        }

        closeWidgetModal();
    }

    async function handleCreateWidget() {
        if (!newWidgetName || !newWidgetType) return;

        const formData = new FormData();
        formData.append("name", newWidgetName);
        formData.append("type", newWidgetType);

        let configObj: any = {};
        if (newWidgetType === "category_link") {
            configObj.category_slug = widgetCreateMemory.category_link;
        } else if (newWidgetType === "HtmlWidget") {
            configObj.html = widgetCreateMemory.HtmlWidget;
        }
        if (
            [
                "RecentPosts",
                "PopularPosts",
                "RecentComments",
                "RecentGuestbooks",
            ].includes(newWidgetType)
        ) {
            const parsedLimit = parseInt(String(newWidgetLimit), 10);
            configObj.limit = isNaN(parsedLimit) || parsedLimit < 1 ? 5 : parsedLimit;
        }

        // Add shadow config
        configObj.shadow = {
            useGlobal: newWidgetShadow.useGlobal,
            normal: newWidgetShadow.normal,
            hover: newWidgetShadow.hover,
            hoverTranslateY: newWidgetShadow.hoverTranslateY,
        };

        const config = JSON.stringify(configObj);
        formData.append("config", config);

        const response = await fetch("?/createWidget", {
            method: "POST",
            body: formData,
        });
        const result = await response.json();

        if (result.type === "success") {
            const data = JSON.parse(result.data);
            availableWidgets = [
                ...availableWidgets,
                {
                    id: `master-${data.id}`,
                    name: newWidgetName,
                    type: newWidgetType,
                    config: config,
                },
            ];
            newWidgetName = "";
            newWidgetSlug = "";
            widgetCreateMemory.category_link = "";
            widgetCreateMemory.HtmlWidget = "";
            newWidgetLimit = DEFAULT_WIDGET_LIMIT;
            newWidgetShadow = {
                useGlobal: true,
                normal: "none",
                hover: "none",
                hoverTranslateY: -2,
            };
        }
    }

    async function handleUpdateWidget() {
        if (!editingWidgetId || !editWidgetName) return;

        const formData = new FormData();
        formData.append("id", String(editingWidgetId).replace("master-", ""));
        formData.append("name", editWidgetName);

        // [버그 A 수정] 기존 config를 spread하여 시작 → 다른 설정값 소실 방지
        let configObj: any = { ...currentEditingWidgetFullConfig };
        if (editWidgetType === "category_link") {
            configObj.category_slug = widgetEditMemory.category_link;
        } else if (editWidgetType === "HtmlWidget") {
            configObj.html = widgetEditMemory.HtmlWidget;
            configObj.useShadowDom = editWidgetUseShadowDom;
        }
        if (
            [
                "RecentPosts",
                "PopularPosts",
                "RecentComments",
                "RecentGuestbooks",
            ].includes(editWidgetType)
        ) {
            const parsedLimit = parseInt(String(editWidgetLimit), 10);
            configObj.limit = isNaN(parsedLimit) || parsedLimit < 1 ? 5 : parsedLimit;
        } else {
            delete configObj.limit;
        }

        // shadow 설정 병합
        configObj.shadow = {
            useGlobal: editWidgetShadow.useGlobal,
            normal: editWidgetShadow.normal,
            hover: editWidgetShadow.hover,
            hoverTranslateY: editWidgetShadow.hoverTranslateY,
        };

        const config = JSON.stringify(configObj);
        formData.append("config", config);

        const response = await fetch("?/updateWidget", {
            method: "POST",
            body: formData,
        });
        const result = await response.json();

        if (result.type === "success") {
            // availableWidgets 업데이트
            availableWidgets = availableWidgets.map((w) =>
                w.id === editingWidgetId
                    ? { ...w, name: editWidgetName, config: config }
                    : w,
            );

            // [버그 B-real 수정] "master-1" 형태 → 숫자 변환 후 widget_id와 비교
            // editingWidgetId는 "master-{n}" 문자열, w.widget_id는 정수이므로
            // 직접 비교하면 항상 false → parseInt로 숫자화 필수
            const numericWidgetId = String(
                parseInt(String(editingWidgetId).replace("master-", "")),
            );
            columnWidgets = columnWidgets.map((col) =>
                col.map((w) =>
                    String(w.widget_id) === numericWidgetId
                        ? { ...w, config: configObj }
                        : w,
                ),
            );
            mobileColumnWidgets = mobileColumnWidgets.map((col) =>
                col.map((w) =>
                    String(w.widget_id) === numericWidgetId
                        ? { ...w, config: configObj }
                        : w,
                ),
            );

            editingWidgetId = null;
        }
    }

    async function handleDeleteWidget(id: number | string) {
        if (!confirm(t("admin.theme.widget_delete_confirm"))) return;

        // Parse ID (remove 'master-' prefix if present)
        const realId =
            typeof id === "string" ? id.replace("master-", "") : id.toString();

        const formData = new FormData();
        formData.append("id", realId);

        const response = await fetch("?/deleteWidget", {
            method: "POST",
            body: formData,
        });
        const result = await response.json();

        if (result.type === "success") {
            // Update UI only if server deletion succeeded
            // Filter using string comparison to cover both number/string variants
            availableWidgets = availableWidgets.filter(
                (w) => String(w.id).replace("master-", "") !== realId,
            );
            layoutWidgets = layoutWidgets.filter(
                (w) => String(w.widget_id) !== realId,
            );
        } else {
            alert(
                t("admin.theme.widget_delete_fail", {
                    default: "삭제에 실패했습니다. 다시 시도해 주세요.",
                }),
            );
        }
    }

    // 마스터 위젯 편집 시 기존 전체 config 보관 (handleUpdateWidget에서 merge에 사용)
    let currentEditingWidgetFullConfig: any = {};

    function startEditWidget(widget: any) {
        editingWidgetId = widget.id;
        editWidgetName = widget.name;
        editWidgetType = widget.type;
        try {
            const config = JSON.parse(widget.config || "{}");
            // [버그 A 연계] 전체 config를 보관해두어 handleUpdateWidget에서 merge 기반으로 활용
            currentEditingWidgetFullConfig = config;
            if (widget.type === "category_link") {
                editWidgetSlug = config.category_slug || "";
                widgetEditMemory.category_link = config.category_slug || "";
            } else if (widget.type === "HtmlWidget") {
                editWidgetSlug = config.html || "";
                widgetEditMemory.HtmlWidget = config.html || "";
                editWidgetUseShadowDom = config.useShadowDom ?? true;
            } else {
                editWidgetSlug = "";
            }
            if (
                [
                    "RecentPosts",
                    "PopularPosts",
                    "RecentComments",
                    "RecentGuestbooks",
                ].includes(widget.type)
            ) {
                editWidgetLimit =
                    parseInt(config.limit, 10) || DEFAULT_WIDGET_LIMIT;
            } else {
                editWidgetLimit = DEFAULT_WIDGET_LIMIT;
            }

            // Load shadow config
            if (config.shadow) {
                editWidgetShadow = {
                    useGlobal: config.shadow.useGlobal !== false,
                    normal: config.shadow.normal || "none",
                    hover: config.shadow.hover || "none",
                    hoverTranslateY: config.shadow.hoverTranslateY ?? -2,
                };
            } else {
                editWidgetShadow = {
                    useGlobal: true,
                    normal: "none",
                    hover: "none",
                    hoverTranslateY: -2,
                };
            }
        } catch {
            currentEditingWidgetFullConfig = {};
            editWidgetSlug = "";
            widgetEditMemory.category_link = "";
            widgetEditMemory.HtmlWidget = "";
            editWidgetShadow = {
                useGlobal: true,
                normal: "none",
                hover: "none",
                hoverTranslateY: -2,
            };
        }
    }

    // Pre-render Compiler Helpers
    function calculateSafeMargins(header, theme) {
        const defaultResult = {
            top: "0px",
            side: "0px",
            topMobile: "0px",
            sideMobile: "0px",
        };
        if (!header) return defaultResult;
        let hasTopRadius = false;
        let hasBottomRadius = false;
        let hasAnyRadius = false;
        let hasShadow = false;

        if (header.borderRadius) {
            const r = header.borderRadius;
            const parseRadius = (v) => {
                if (v === undefined || v === null || v === "") return false;
                const num = Number(String(v).replace(/px/g, ""));
                return !isNaN(num) && num > 0;
            };
            hasTopRadius = parseRadius(r.topLeft) || parseRadius(r.topRight);
            hasBottomRadius =
                parseRadius(r.bottomLeft) || parseRadius(r.bottomRight);
            hasAnyRadius = hasTopRadius || hasBottomRadius;
        }

        if (
            header.boxShadow &&
            header.boxShadow !== "none" &&
            header.boxShadow !== ""
        ) {
            hasShadow = true;
        }

        const sideMarginVal = header.sideMargin || "0px";
        const hasSideMargin =
            sideMarginVal !== "0" &&
            sideMarginVal !== "0px" &&
            sideMarginVal !== "";
        const isFloatingStyle = hasAnyRadius || hasShadow || hasSideMargin;

        if (!isFloatingStyle) {
            return defaultResult;
        }

        const divideMargin = (val) => {
            if (!val) return "0px";
            const num = parseFloat(val);
            if (isNaN(num)) return val;
            const unit = String(val)
                .replace(/[0-9.]/g, "")
                .trim();
            return `${num / 2}${unit || "px"}`;
        };

        const convertToPx = (val) => {
            if (!val) return 0;
            const num = parseFloat(val);
            if (isNaN(num)) return 0;
            if (String(val).includes("rem")) {
                return num * 16;
            }
            return num;
        };

        const themeSideMargin = (theme && theme.sideMargin) || "1.5rem";
        const desktopSide = hasSideMargin ? sideMarginVal : themeSideMargin;
        const desktopTop = hasSideMargin ? sideMarginVal : "8px";

        const sideMobileDivided = divideMargin(desktopSide);
        const sideMobilePx = convertToPx(sideMobileDivided);
        const clampedSideMobilePx = Math.max(12, Math.min(sideMobilePx, 24));
        const mobileSide = `${clampedSideMobilePx}px`;

        const topMobileDivided = divideMargin(desktopTop);
        const topMobilePx = convertToPx(topMobileDivided);
        const clampedTopMobilePx = Math.max(4, Math.min(topMobilePx, 12));
        const mobileTop = `${clampedTopMobilePx}px`;

        return {
            top: desktopTop,
            side: desktopSide,
            topMobile: mobileTop,
            sideMobile: mobileSide,
        };
    }

    function compileHeaderCss(header, theme) {
        if (!header) return "";
        const showBorder = header.showBorderBottom === true;
        const borderCss = showBorder
            ? `border-bottom: 1px solid var(--border-color, #e2e8f0) !important;`
            : "";
        const height = header.height || "64px";
        const logoFontSize = header.logoFontSize || "1.5rem";
        const logoFontWeight = header.logoFontWeight || "700";
        const logoLetterSpacing = header.logoLetterSpacing || "0px";
        const logoFontFamily = header.logoFont || "inherit";
        const scrolledHeight = header.scrolledHeight || "80px";
        const scrolledMaxWidth =
            header.scrolledMaxWidth || (theme && theme.maxWidth) || "1200px";
        const scrolledNavSpacing =
            header.scrolledNavSpacing || header.navSpacing || "1.5rem";
        const logoPadding = header.logoPadding || {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        };
        const scrolledLogoPadding = header.scrolledLogoPadding || logoPadding;
        const navPadding = header.navPadding || {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        };
        const scrolledNavPadding = header.scrolledNavPadding || navPadding;
        const currentNavSpacing = header.navSpacing || "1.5rem";
        const navTextColor = header.navTextColor || "inherit";
        const logoAlignment = header.logoAlignment || "left";
        const navAlignment = header.navAlignment || "right";

        let css = `
.blog-header {
    --header-height: ${height};
    --logo-font-size: ${logoFontSize};
    --logo-font-weight: ${logoFontWeight};
    --logo-letter-spacing: ${logoLetterSpacing};
    --logo-font-family: ${logoFontFamily};
    --scrolled-height: ${scrolledHeight};
    --scrolled-max-width: ${scrolledMaxWidth};
    --scrolled-nav-spacing: ${scrolledNavSpacing};
    --nav-text-color: ${navTextColor};
    --nav-spacing: ${currentNavSpacing};
    
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 100;
    transition: all 0.3s ease;
}
.blog-header .logo {
    font-family: var(--logo-font-family);
    font-size: var(--logo-font-size);
    font-weight: var(--logo-font-weight);
    letter-spacing: var(--logo-letter-spacing);
    text-decoration: none !important;
    outline: none !important;
    padding: ${logoPadding.top ?? 0}px ${logoPadding.right ?? 0}px ${logoPadding.bottom ?? 0}px ${logoPadding.left ?? 0}px;
    align-self: ${header.logoVerticalAlignment === "top" ? "flex-start" : header.logoVerticalAlignment === "bottom" ? "flex-end" : "center"};
}
.blog-header .logo span { text-decoration: none !important; }
.blog-header .header-nav {
    display: flex;
    align-items: ${header.navVerticalAlignment === "top" ? "flex-start" : header.navVerticalAlignment === "bottom" ? "flex-end" : "center"};
    padding: ${navPadding.top ?? 0}px ${navPadding.right ?? 0}px ${navPadding.bottom ?? 0}px ${navPadding.left ?? 0}px;
    gap: var(--nav-gap, var(--nav-spacing));
    justify-content: var(--nav-align, flex-end);
}
.blog-header.scrolled { --header-height: var(--scrolled-height); }
.blog-header.scrolled .logo {
    padding: ${scrolledLogoPadding.top ?? 0}px ${scrolledLogoPadding.right ?? 0}px ${scrolledLogoPadding.bottom ?? 0}px ${scrolledLogoPadding.left ?? 0}px;
    align-self: ${header.scrolledLogoVerticalAlignment === "top" ? "flex-start" : header.scrolledLogoVerticalAlignment === "bottom" ? "flex-end" : "center"};
}
.blog-header.scrolled .header-nav {
    padding: ${scrolledNavPadding.top ?? 0}px ${scrolledNavPadding.right ?? 0}px ${scrolledNavPadding.bottom ?? 0}px ${scrolledNavPadding.left ?? 0}px;
    gap: var(--scrolled-nav-spacing);
    align-items: ${header.scrolledNavVerticalAlignment === "top" ? "flex-start" : header.scrolledNavVerticalAlignment === "bottom" ? "flex-end" : "center"};
}

.blog-header .header-inner,
header.blog-header.scrolled .header-inner {
    ${borderCss}
}
`;
        if (header.headerLayout === "two-line") {
            css += `
@media (min-width: 769px) {
    .blog-header:not(.scrolled) .header-inner {
        flex-direction: column !important;
        justify-content: center !important;
        align-items: stretch !important;
    }
    .blog-header:not(.scrolled) .logo {
        position: static !important;
        align-self: ${logoAlignment === "center" ? "center" : logoAlignment === "right" ? "flex-end" : "flex-start"} !important;
        margin: 0 !important;
        text-align: ${logoAlignment === "center" ? "center" : logoAlignment === "right" ? "right" : "left"} !important;
        width: auto !important;
        display: flex !important;
    }
    .blog-header:not(.scrolled) .header-right {
        width: 100% !important;
        flex: none !important;
        height: auto !important;
        justify-content: ${navAlignment === "left" ? "flex-start" : navAlignment === "center" ? "center" : "flex-end"} !important;
        position: relative !important;
    }
    .blog-header:not(.scrolled) .header-right .header-nav {
        justify-content: ${navAlignment === "left" ? "flex-start" : navAlignment === "center" ? "center" : "flex-end"} !important;
        flex: 1 !important;
    }
}
`;
        }

        // 모바일 오버라이드 미디어 쿼리 추가
        if (header.mobile) {
            const m = header.mobile;
            let mRules = [];
            if (m.height) mRules.push(`--header-height: ${m.height};`);
            if (m.logoFontSize)
                mRules.push(`--logo-font-size: ${m.logoFontSize};`);
            if (m.navSpacing) mRules.push(`--nav-spacing: ${m.navSpacing};`);

            const margins = calculateSafeMargins(header, theme);
            const safeSideMobile = margins.sideMobile;
            const safeTopMobile = margins.topMobile;

            css += `
@media (max-width: 768px) {
    .blog-header,
    .blog-header.scrolled {
        min-height: max(50px, var(--min-header-height, 50px));
        height: var(--header-height, auto) !important;
    }
    .blog-header .header-inner,
    header.blog-header.scrolled .header-inner {
        min-height: 50px;
        height: var(--header-height, auto) !important;
        padding: 8px clamp(12px, var(--side-margin), 24px) !important;
        max-width: 100% !important;
        width: calc(100% - 2 * ${safeSideMobile}) !important;
        margin: ${safeTopMobile} auto 0 !important;
        ${borderCss}
    }
    .blog-header .logo {
        ${m.logoFontSize ? `font-size: ${m.logoFontSize} !important;` : ""}
        ${m.logoPadding ? `padding: ${m.logoPadding.top ?? 0}px ${m.logoPadding.right ?? 0}px ${m.logoPadding.bottom ?? 0}px ${m.logoPadding.left ?? 0}px !important;` : ""}
        ${m.logoVerticalAlignment ? `align-self: ${m.logoVerticalAlignment === "top" ? "flex-start" : m.logoVerticalAlignment === "bottom" ? "flex-end" : "center"} !important;` : ""}
    }
    .blog-header .header-nav {
        ${m.navPadding ? `padding: ${m.navPadding.top ?? 0}px ${m.navPadding.right ?? 0}px ${m.navPadding.bottom ?? 0}px ${m.navPadding.left ?? 0}px !important;` : ""}
        ${m.navSpacing ? `gap: var(--nav-gap, ${m.navSpacing}) !important;` : ""}
        ${m.navVerticalAlignment ? `align-items: ${m.navVerticalAlignment === "top" ? "flex-start" : m.navVerticalAlignment === "bottom" ? "flex-end" : "center"} !important;` : ""}
        ${m.navAlignment ? `justify-content: ${m.navAlignment === "left" ? "flex-start" : m.navAlignment === "center" ? "center" : "flex-end"} !important;` : ""}
    }
}
`;
        }
        return css.trim();
    }

    function compileHeaderHtml(header, lang) {
        if (!header) return "";
        const getTrans = (val) => {
            if (!val) return "";
            if (typeof val === "object" && val !== null)
                return val[lang] || val["ko"] || Object.values(val)[0] || "";
            if (typeof val === "string" && val.startsWith("{")) {
                try {
                    const parsed = JSON.parse(val);
                    return (
                        parsed[lang] ||
                        parsed["ko"] ||
                        Object.values(parsed)[0] ||
                        val
                    );
                } catch {
                    return val;
                }
            }
            return val;
        };

        const logoText = getTrans(header.logoText || "Blog");
        const logoColor = header.logoColor || { type: "solid", value: "" };
        const logoStyleAttr =
            logoColor.type !== "gradient" ? getTextStyle(logoColor) : "";
        const logoHtml =
            logoColor.type === "gradient"
                ? `<span style="background: ${logoColor.value}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent; display: inline-block; padding-bottom: 0.2em; margin-bottom: -0.2em;">${logoText}</span>`
                : logoText;

        let menuItems = header.menuItems || [];
        if (typeof menuItems === "string") {
            try {
                menuItems = JSON.parse(menuItems);
            } catch {
                menuItems = [];
            }
        }

        let navLinksHtml = "";
        menuItems.forEach((item) => {
            if (!item) return;
            const label =
                typeof item.label === "object" && item.label !== null
                    ? item.label[lang] ||
                      item.label["ko"] ||
                      Object.values(item.label)[0] ||
                      "Untitled"
                    : item.label || "Untitled";

            const iconAttr = item.icon ? `data-icon="${item.icon}"` : "";
            if (item.type === "category_drawer") {
                navLinksHtml += `
                <div class="category-dropdown-wrapper">
                    <button class="nav-link category-toggle" data-dropdown-id="${item.id}" style="color: var(--nav-text-color);">
                        <span class="icon-placeholder" ${iconAttr}></span>
                        <span>${label}</span>
                        <span class="arrow-icon">▼</span>
                    </button>
                </div>`;
            } else {
                navLinksHtml += `
                <a href="${item.url || "/"}" class="nav-link" style="color: var(--nav-text-color);">
                    <span class="icon-placeholder" ${iconAttr}></span>
                    <span>${label}</span>
                </a>`;
            }
        });

        const alignmentClass =
            header.logoAlignment === "center"
                ? "logo-centered"
                : header.logoAlignment === "right"
                  ? "logo-right"
                  : "";

        // 효과 유형별로 주입될 CSS 변수 구문 조합 연산
        let hoverTransform = "none";
        let hoverColor = "var(--primary-color)";
        let hoverShadow = "none";

        if (header.logoColor?.type === "gradient") {
            hoverColor =
                header.logoColor.value ||
                "linear-gradient(90deg, #3b82f6, #06b6d4)";
        } else if (header.logoColor?.value) {
            hoverColor = header.logoColor.value;
        }

        if (header.logoHoverEffect === "scale") {
            hoverTransform = `scale(${header.logoHoverScale || 1.02})`;
        } else if (header.logoHoverEffect === "float") {
            hoverTransform = `translateY(-${header.logoHoverFloatOffset ?? 2}px)`;
        } else if (header.logoHoverEffect === "color") {
            hoverColor =
                header.logoHoverColor?.value ||
                "var(--accent-color, var(--primary-color))";
        }

        if (header.logoHoverShadowEnabled) {
            hoverShadow = `0 2px 8px ${header.logoHoverShadowColor?.value || "rgba(0, 0, 0, 0.15)"}`;
        }

        const hoverStyleVars = [
            `--logo-hover-transform: ${hoverTransform};`,
            `--logo-hover-color: ${hoverColor};`,
            `--logo-hover-shadow: ${hoverShadow};`,
        ].join(" ");

        return `
        <a href="/" class="logo" style="${hoverStyleVars} ${logoStyleAttr || "color: var(--primary-color);"}">
            ${logoHtml}
        </a>
        <div class="header-right desktop-only ${alignmentClass}">
            <nav class="header-nav">
                ${navLinksHtml}
            </nav>
        </div>
        `.trim();
    }

    function getRadiusStyle(radius) {
        if (!radius) return "0px";
        const { topLeft, topRight, bottomLeft, bottomRight } = radius;
        const f = (v) => (typeof v === "number" ? `${v}px` : v || "0px");
        return `${f(topLeft)} ${f(topRight)} ${f(bottomRight)} ${f(bottomLeft)}`;
    }

    function compileFooterCss(footer) {
        if (!footer) return "";
        const showBorder = footer.showBorderTop !== false;
        const borderCss = showBorder
            ? `border-top: 1px solid var(--border-color, #e2e8f0);`
            : "";
        let css = `
.blog-footer {
    background: ${footer.footerBackground?.value || "var(--surface-color, #ffffff)"};
    padding: 3rem 1.5rem;
}
.blog-footer .footer-inner {
    color: ${footer.text?.color || "inherit"};
    font-size: ${footer.text?.fontSize || "0.875rem"};
    --footer-nav-color: ${footer.navColor || "#888888"};
    --footer-nav-font-size: ${footer.navFontSize || "0.85rem"};
    border-radius: ${getRadiusStyle(footer.borderRadius)};
    box-shadow: ${footer.boxShadow || "none"};
    ${borderCss}
}
        `.trim();

        if (footer.mobile) {
            const m = footer.mobile;
            let mRules = [];
            if (m.text?.color) mRules.push(`color: ${m.text.color};`);
            if (m.text?.fontSize) mRules.push(`font-size: ${m.text.fontSize};`);
            if (m.navColor) mRules.push(`--footer-nav-color: ${m.navColor};`);
            if (m.navFontSize)
                mRules.push(`--footer-nav-font-size: ${m.navFontSize};`);
            if (m.borderRadius)
                mRules.push(
                    `border-radius: ${getRadiusStyle(m.borderRadius)};`,
                );
            if (m.boxShadow) mRules.push(`box-shadow: ${m.boxShadow};`);

            if (mRules.length > 0) {
                css += `
@media (max-width: 768px) {
    .blog-footer .footer-inner {
        ${mRules.join("\n        ")}
    }
}
`;
            }
        }
        return css.trim();
    }

    function compileFooterHtml(footer, lang) {
        if (!footer) return "";
        const getTrans = (val) => {
            if (!val) return "";
            if (typeof val === "object" && val !== null)
                return val[lang] || val["ko"] || Object.values(val)[0] || "";
            if (typeof val === "string" && val.startsWith("{")) {
                try {
                    const parsed = JSON.parse(val);
                    return (
                        parsed[lang] ||
                        parsed["ko"] ||
                        Object.values(parsed)[0] ||
                        val
                    );
                } catch {
                    return val;
                }
            }
            return val;
        };

        const copyright = getTrans(footer.copyright || "");
        return `
        <div class="footer-inner-content">
            <p class="copyright" style="margin: 0; color: inherit; font-size: inherit;">
                ${copyright || "© " + new Date().getFullYear() + " Blog. All rights reserved."}
            </p>
        </div>
        `.trim();
    }

    // Save Logic
    let saving = $state(false);

    async function saveEverything(publish = false) {
        // Safety check: Prevent accidental mass deletion
        const desktopCount = columnWidgets.flat().length;
        const mobileCount = mobileColumnWidgets.flat().length;
        const totalCount = desktopCount + mobileCount;

        if (totalCount === 0 && (data.layoutWidgets || []).length > 0) {
            const confirmed = confirm(
                t("admin.theme.widget_empty_save_confirm", {
                    default:
                        "⚠️ 위젯 데이터가 비어 있습니다. 모든 위젯을 삭제하고 저장하시겠습니까?",
                }),
            );
            if (!confirmed) return;
        }

        saving = true;
        try {
            // 0. Calculate dynamic safety margins and inject into headerConfig
            const margins = calculateSafeMargins(headerConfig, themeConfig);
            headerConfig.safeTopMargin = margins.top;
            headerConfig.safeSideMargin = margins.side;
            headerConfig.safeTopMarginMobile = margins.topMobile;
            headerConfig.safeSideMarginMobile = margins.sideMobile;

            // Calculate theme mobileSideMargin
            const divideMargin = (val) => {
                if (!val) return "0px";
                const num = parseFloat(val);
                if (isNaN(num)) return val;
                const unit = String(val)
                    .replace(/[0-9.]/g, "")
                    .trim();
                return `${num / 2}${unit || "px"}`;
            };
            const convertToPx = (val) => {
                if (!val) return 0;
                const num = parseFloat(val);
                if (isNaN(num)) return 0;
                if (String(val).includes("rem")) {
                    return num * 16;
                }
                return num;
            };
            const themeSideMargin = themeConfig.sideMargin || "1.5rem";
            const sideMobileDivided = divideMargin(themeSideMargin);
            const sideMobilePx = convertToPx(sideMobileDivided);
            const clampedSideMobilePx = Math.max(
                12,
                Math.min(sideMobilePx, 24),
            );
            themeConfig.mobileSideMargin = `${clampedSideMobilePx}px`;

            // Calculate headerBodySpacingMobile
            const headerBodyDivided = divideMargin(
                themeConfig.headerBodySpacing || "1rem",
            );
            const headerBodyPx = convertToPx(headerBodyDivided);
            const clampedHeaderBodyPx = Math.max(8, Math.min(headerBodyPx, 24));
            themeConfig.headerBodySpacingMobile = `${clampedHeaderBodyPx}px`;

            // Calculate bodyFooterSpacingMobile
            const bodyFooterDivided = divideMargin(
                themeConfig.bodyFooterSpacing || "1rem",
            );
            const bodyFooterPx = convertToPx(bodyFooterDivided);
            const clampedBodyFooterPx = Math.max(8, Math.min(bodyFooterPx, 24));
            themeConfig.bodyFooterSpacingMobile = `${clampedBodyFooterPx}px`;

            // 1. Compile static templates
            const headerCssVal = compileHeaderCss(headerConfig, themeConfig);
            const footerCssVal = compileFooterCss(footerConfig);

            // Compile localized templates for each language
            const compiledHeaderHtmls = {};
            const compiledFooterHtmls = {};
            languages.forEach((langObj) => {
                const code = langObj.code;
                compiledHeaderHtmls[code] = compileHeaderHtml(
                    headerConfig,
                    code,
                );
                compiledFooterHtmls[code] = compileFooterHtml(
                    footerConfig,
                    code,
                );
            });

            // [근본 데이터 정규화] 저장 직전 헤더/푸터 내의 개별 maxWidth 및 테마 구형 필드 삭제 및 정제
            if (headerConfig.logoHoverShadowColor) {
                headerConfig.logoHoverShadowColor.type = "solid";
            }
            delete headerConfig.maxWidth;
            delete footerConfig.maxWidth;
            if (themeConfig.surface) delete themeConfig.surface;
            if (themeConfig.textColor) delete themeConfig.textColor;

            if (
                !headerConfig.scrolledMaxWidth ||
                headerConfig.scrolledMaxWidth === "960px" ||
                headerConfig.scrolledMaxWidth === headerConfig.maxWidth
            ) {
                headerConfig.scrolledMaxWidth = themeConfig.maxWidth;
            }

            // 2. Save Settings
            const settingsToSave = [
                { key: "site_title", value: JSON.stringify(siteTitleConfig) },
                { key: "theme", value: JSON.stringify(themeConfig) },
                { key: "header", value: JSON.stringify(headerConfig) },
                { key: "footer", value: JSON.stringify(footerConfig) },
                { key: "header_css", value: headerCssVal },
                { key: "footer_css", value: footerCssVal },
                {
                    key: "widget_shadow_global",
                    value: JSON.stringify(widgetShadowGlobal),
                },
            ];

            // Add all language-specific compiled htmls
            languages.forEach((langObj) => {
                const code = langObj.code;
                settingsToSave.push({
                    key: `header_static_html_${code}`,
                    value: compiledHeaderHtmls[code],
                });
                settingsToSave.push({
                    key: `footer_static_html_${code}`,
                    value: compiledFooterHtmls[code],
                });
            });

            for (const s of settingsToSave) {
                const formData = new FormData();
                formData.append("key", s.key);
                formData.append("value", s.value);
                await fetch("?/updateSettings", {
                    method: "POST",
                    body: formData,
                });
            }

            // 2. Save Layout
            const layoutFormData = new FormData();
            if (currentLayout.id)
                layoutFormData.append("id", currentLayout.id.toString());
            layoutFormData.append("name", currentLayout.name);
            layoutFormData.append(
                "column_count",
                currentLayout.columnCount.toString(),
            );
            layoutFormData.append(
                "column_widths",
                currentLayout.columnWidths.join(" "),
            );
            layoutFormData.append("is_active", "true");

            // [근본 아키텍처 교정] 가로형 포스트 리스트 위젯의 고정 높이가 너무 낮아 텍스트가 잘리는 현상을 막기 위해 최소 140px 하한선 검증/자동보정 적용
            const sanitizeWidgetCardHeight = (widget: any) => {
                if (widget.type === "recent" || widget.type === "popular" || widget.type === "postcontent") {
                    const pc = widget.config || {};
                    if (pc.layout === "horizontal" && pc.cardHeight && pc.cardHeight.trim() !== "") {
                        const val = parseFloat(pc.cardHeight);
                        const unit = pc.cardHeight.replace(/[0-9.]/g, "").trim().toLowerCase();
                        if (!isNaN(val)) {
                            if ((unit === "px" || unit === "") && val < 140) {
                                widget.config.cardHeight = "140px";
                            } else if ((unit === "rem" || unit === "em") && val < 8.75) {
                                widget.config.cardHeight = `${unit === "rem" ? "8.75rem" : "8.75em"}`;
                            }
                        }
                    }
                }
                return widget;
            };

            // Combine desktop widgets + mobile widgets with safe validation mapping
            const allWidgetsToSave = [
                ...columnWidgets
                    .flat()
                    .map((w) => sanitizeWidgetCardHeight({ ...w, device: "desktop" })),
                ...mobileColumnWidgets
                    .flat()
                    .map((w) => sanitizeWidgetCardHeight({ ...w, device: "mobile" })),
            ];
            layoutFormData.append("widgets", JSON.stringify(allWidgetsToSave));
            layoutFormData.append(
                "mobile_column_count",
                mobileColumnCount.toString(),
            );
            layoutFormData.append(
                "mobile_column_widths",
                mobileColumnWidths.join(" "),
            );

            const res = await fetch("?/saveLayout", {
                method: "POST",
                body: layoutFormData,
            });
            if (res.ok) {
                if (publish) {
                    alert(
                        t("admin.theme.published_alert", {
                            default:
                                "🎉 테마 설정이 실시간 블로그에 완벽하게 적용 및 배포되었습니다! (Cloudflare Pages/KV 캐시 갱신 완료)",
                        }),
                    );
                } else {
                    alert(
                        t("admin.theme.saved_alert", {
                            default: "설정이 성공적으로 저장되었습니다.",
                        }),
                    );
                }
                // Reload to sync state if needed, or just update UI
            } else {
                alert(
                    t("admin.theme.save_error", {
                        default: "저장 중 오류가 발생했습니다.",
                    }),
                );
            }
        } catch (e) {
            console.error(e);
            alert(t("admin.theme.save_fail", { default: "저장 실패: " }) + e);
        } finally {
            saving = false;
        }
    }
</script>

<div class="editor-container">
    <!-- Top Bar -->
    <header class="top-bar">
        <div class="logo">
            <Layout class="logo-icon" />
            <span>{t("admin.theme.editor_title")}</span>
        </div>
        <div class="controls">
            <div class="device-toggles">
                <button
                    class:active={previewMode === "desktop"}
                    onclick={() => (previewMode = "desktop")}
                >
                    <Monitor size={18} />
                </button>
                <button
                    class:active={previewMode === "mobile"}
                    onclick={() => (previewMode = "mobile")}
                >
                    <Smartphone size={18} />
                </button>
            </div>
            <button
                class="btn-draft"
                disabled={saving}
                onclick={() => saveEverything(false)}
            >
                <Save size={18} />
                <span
                    >{saving
                        ? t("admin.common.saving")
                        : t("admin.theme.save_draft_btn", {
                              default: "현재 설정 저장",
                          })}</span
                >
            </button>
            <button
                class="btn-save"
                disabled={saving}
                onclick={() => saveEverything(true)}
            >
                <Globe size={18} />
                <span
                    >{saving
                        ? t("admin.common.saving")
                        : t("admin.theme.publish_btn", {
                              default: "블로그에 적용",
                          })}</span
                >
            </button>
        </div>
    </header>

    <main class="main-content">
        <!-- Sidebar -->
        <aside class="sidebar">
            <nav class="sidebar-nav">
                <button
                    class:active={activeTab === "theme"}
                    onclick={() => (activeTab = "theme")}
                >
                    <Palette size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_theme")}</span
                    >
                </button>
                <button
                    class:active={activeTab === "layout"}
                    onclick={() => (activeTab = "layout")}
                >
                    <Layout size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_layout")}</span
                    >
                </button>
                <button
                    class:active={activeTab === "widgets"}
                    onclick={() => (activeTab = "widgets")}
                >
                    <Boxes size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_widgets")}</span
                    >
                </button>
                <button
                    class:active={activeTab === "header"}
                    onclick={() => (activeTab = "header")}
                >
                    <Link size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_header")}</span
                    >
                </button>

                <button
                    class:active={activeTab === "settings"}
                    onclick={() => (activeTab = "settings")}
                >
                    <Book size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_font")}</span
                    >
                </button>
                <button
                    class:active={activeTab === "background"}
                    onclick={() => (activeTab = "background")}
                >
                    <Palette size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_background")}</span
                    >
                </button>
                <button
                    class:active={activeTab === "config"}
                    onclick={() => (activeTab = "config")}
                >
                    <Settings size={20} />
                    <span class="depth-4-label"
                        >{t("admin.theme.tab_config")}</span
                    >
                </button>
            </nav>

            <div class="db-status-bar">
                <div
                    class="status-indicator"
                    class:remote={data.dbInfo.isRemote}
                ></div>
                <span class="db-name"
                    >{data.dbInfo.type} ({data.dbInfo.isRemote
                        ? "Remote"
                        : "Local"})</span
                >
            </div>

            <div class="tab-content">
                {#if activeTab === "theme"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.tab_theme", { default: "테마 설정" })}
                    </h2>

                    <AccordionItem
                        title={t("admin.theme.brand_colors")}
                        icon={Palette}
                    >
                        <section class="config-section">
                            <div class="color-grid">
                                <ColorControl
                                    label="Primary (Brand)"
                                    bind:value={themeConfig.primary}
                                />
                                <ColorControl
                                    label="Secondary"
                                    bind:value={themeConfig.secondary}
                                />
                                <ColorControl
                                    label="Accent"
                                    bind:value={themeConfig.accent}
                                />
                                <ColorControl
                                    label="Text"
                                    bind:value={themeConfig.text}
                                />
                                <ColorControl
                                    label="Card Background"
                                    bind:value={themeConfig.cardBg}
                                />
                                <ColorControl
                                    label="Border"
                                    bind:value={themeConfig.border}
                                />
                            </div>
                        </section>
                    </AccordionItem>

                    <AccordionItem
                        title={t("admin.theme.frame_settings")}
                        icon={LayoutTemplate}
                    >
                        <section class="config-section">
                            <div class="form-group-mini">
                                <label for="side-margin" class="depth-3-label"
                                    >{t("admin.theme.side_margin")}</label
                                >
                                <input
                                    id="side-margin"
                                    type="text"
                                    bind:value={themeConfig.sideMargin}
                                    placeholder={t(
                                        "admin.theme.side_margin_placeholder",
                                    )}
                                />
                                <p class="hint depth-4-hint">
                                    {t("admin.theme.side_margin_hint")}
                                </p>
                            </div>

                            <div class="form-group-mini mt-4">
                                <label
                                    for="header-body-spacing"
                                    class="depth-3-label"
                                    >{t(
                                        "admin.theme.header_body_spacing",
                                    )}</label
                                >
                                <input
                                    id="header-body-spacing"
                                    type="text"
                                    bind:value={themeConfig.headerBodySpacing}
                                    placeholder={t(
                                        "admin.theme.header_body_spacing_placeholder",
                                    )}
                                />
                                <p class="hint depth-4-hint">
                                    {t("admin.theme.header_body_spacing_hint")}
                                </p>
                            </div>

                            <div class="form-group-mini mt-4">
                                <label
                                    for="body-footer-spacing"
                                    class="depth-3-label"
                                    >{t(
                                        "admin.theme.body_footer_spacing",
                                    )}</label
                                >
                                <input
                                    id="body-footer-spacing"
                                    type="text"
                                    bind:value={themeConfig.bodyFooterSpacing}
                                    placeholder={t(
                                        "admin.theme.body_footer_spacing_placeholder",
                                    )}
                                />
                                <p class="hint depth-4-hint">
                                    {t("admin.theme.body_footer_spacing_hint")}
                                </p>
                            </div>
                        </section>
                    </AccordionItem>
                {:else if activeTab === "settings"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.web_font_settings", {
                            default: "웹 폰트 설정",
                        })}
                    </h2>

                    <AccordionItem
                        title={t("admin.theme.font_title") ||
                            t("admin.theme.global_web_font", {
                                default: "글로벌 웹 폰트 설정",
                            })}
                        icon={Book}
                    >
                        <!-- 웹 폰트 관리 설정 -->
                        <p class="depth-4-hint">
                            {t("admin.theme.font_hint")}
                        </p>

                        <div class="form-group-mini mt-4">
                            <label for="base-font-family" class="depth-3-label"
                                >{t("admin.theme.font_family_label")}</label
                            >
                            <input
                                id="base-font-family"
                                type="text"
                                bind:value={themeConfig.fontFamily}
                                placeholder={t(
                                    "admin.theme.font_family_placeholder",
                                )}
                            />
                            <p class="depth-4-hint">
                                {t("admin.theme.font_family_hint")}
                            </p>
                        </div>

                        <div class="form-group-mini mt-3">
                            <label for="google-font-name" class="depth-3-label"
                                >{t("admin.theme.google_font_label")}</label
                            >
                            <input
                                id="google-font-name"
                                type="text"
                                bind:value={themeConfig.googleFontName}
                                placeholder={t(
                                    "admin.theme.google_font_placeholder",
                                )}
                            />
                            <p class="depth-4-hint">
                                {t("admin.theme.google_font_hint")}
                            </p>
                        </div>

                        <div class="form-group-mini mt-3">
                            <label for="base-font-size" class="depth-3-label"
                                >{t("admin.theme.base_font_size")}</label
                            >
                            <input
                                id="base-font-size"
                                type="text"
                                bind:value={themeConfig.baseFontSize}
                                placeholder="16px"
                            />
                        </div>

                        <div class="form-group-mini mt-3">
                            <label
                                for="base-font-size-mobile"
                                class="depth-3-label"
                                >{t("admin.theme.base_font_size")} (Mobile)</label
                            >
                            <input
                                id="base-font-size-mobile"
                                type="text"
                                bind:value={themeConfig.mobileBaseFontSize}
                                placeholder="14px"
                            />
                        </div>
                    </AccordionItem>
                {:else if activeTab === "layout"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.blog_layout", {
                            default: "블로그 구조",
                        })}
                    </h2>

                    <AccordionItem
                        title={t("admin.theme.column_settings") ||
                            t("admin.theme.layout_ratio_setting", {
                                default: "레이아웃 단/비율 설정",
                            })}
                        icon={Columns}
                    >
                        {#if previewMode === "desktop"}
                            <div class="col-controls">
                                <span class="depth-4-label"
                                    >{t("admin.theme.col_count", {
                                        n: String(currentLayout.columnCount),
                                    })}</span
                                >
                                <div class="btn-group">
                                    <button onclick={removeColumn}>-</button>
                                    <button onclick={addColumn}>+</button>
                                </div>
                            </div>
                            <div class="col-widths">
                                {#each currentLayout.columnWidths as width, i}
                                    <div class="width-input-container">
                                        <label
                                            for="col-width-{i}"
                                            class="depth-3-label"
                                            >{t("admin.theme.col_ratio", {
                                                n: String(i + 1),
                                            })}</label
                                        >
                                        <div class="width-controls">
                                            <button
                                                class="step-btn"
                                                onclick={() =>
                                                    adjustColumnWidth(i, -0.5)}
                                                >-</button
                                            >
                                            <input
                                                id="col-width-{i}"
                                                type="text"
                                                bind:value={
                                                    currentLayout.columnWidths[
                                                        i
                                                    ]
                                                }
                                                onblur={() =>
                                                    handleWidthBlur(i)}
                                            />
                                            <button
                                                class="step-btn"
                                                onclick={() =>
                                                    adjustColumnWidth(i, 0.5)}
                                                >+</button
                                            >
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="help-box">
                                <strong class="block mb-2"
                                    >{t(
                                        "admin.theme.mobile_guide_title",
                                    )}</strong
                                >
                                <ul class="list-disc pl-5 leading-loose">
                                    <li>
                                        {@html t(
                                            "admin.theme.mobile_guide_col",
                                            {
                                                default:
                                                    "컬럼 수: <strong>1단</strong> 권장 (다단은 모바일에서 내용이 너무 좁아짐)",
                                            },
                                        )}
                                    </li>
                                    <li>
                                        {@html t(
                                            "admin.theme.mobile_guide_layout",
                                            {
                                                default:
                                                    "포스트 레이아웃: <strong>세로(Vertical)</strong> 권장",
                                            },
                                        )}
                                    </li>
                                    <li>
                                        {@html t(
                                            "admin.theme.mobile_guide_height",
                                            {
                                                default:
                                                    "카드 고정 높이: <strong>설정하지 않음</strong> (고정 시 텍스트 잘림 발생)",
                                            },
                                        )}
                                    </li>
                                    <li>
                                        {@html t(
                                            "admin.theme.mobile_guide_img",
                                            {
                                                default:
                                                    "이미지 비율: <strong>50% 이하</strong> (텍스트 영역 확보)",
                                            },
                                        )}
                                    </li>
                                </ul>
                                <p class="mt-2 text-blue-500">
                                    {t("admin.theme.mobile_guide_tip")}
                                </p>
                            </div>
                            <div class="col-controls">
                                <span class="depth-4-label"
                                    >{t("admin.theme.mobile_col_count", {
                                        n: String(mobileColumnCount),
                                    })}</span
                                >
                                <div class="btn-group">
                                    <button onclick={removeMobileColumn}
                                        >-</button
                                    >
                                    <button onclick={addMobileColumn}>+</button>
                                </div>
                            </div>
                            <div class="col-widths">
                                {#each mobileColumnWidths as _, i}
                                    <div class="width-input-container">
                                        <label class="depth-3-label"
                                            >{t(
                                                "admin.theme.mobile_col_ratio",
                                                { n: String(i + 1) },
                                            )}</label
                                        >
                                        <div class="width-controls">
                                            <button
                                                class="step-btn"
                                                onclick={() => {
                                                    const cur =
                                                        parseFloat(
                                                            mobileColumnWidths[
                                                                i
                                                            ].replace("fr", ""),
                                                        ) || 1;
                                                    mobileColumnWidths[i] =
                                                        `${Math.max(0.1, cur - 0.5)}fr`;
                                                }}>-</button
                                            >
                                            <input
                                                type="text"
                                                bind:value={
                                                    mobileColumnWidths[i]
                                                }
                                            />
                                            <button
                                                class="step-btn"
                                                onclick={() => {
                                                    const cur =
                                                        parseFloat(
                                                            mobileColumnWidths[
                                                                i
                                                            ].replace("fr", ""),
                                                        ) || 1;
                                                    mobileColumnWidths[i] =
                                                        `${cur + 0.5}fr`;
                                                }}>+</button
                                            >
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        <div class="form-group-mini mt-6 border-t pt-4">
                            <label
                                for="layout-max-width"
                                class="depth-3-label flex items-center gap-1 font-semibold text-slate-700"
                            >
                                <span
                                    >{t("admin.theme.header_max_width", {
                                        default: "블로그 최대 가로 폭",
                                    })}</span
                                >
                            </label>
                            <input
                                id="layout-max-width"
                                type="text"
                                bind:value={themeConfig.maxWidth}
                                placeholder="1200px"
                                class="text-xs p-1.5 border rounded w-1/2 bg-white mt-1"
                            />
                            <p class="hint depth-4-hint mt-1 text-slate-400">
                                {t("admin.theme.max_width_hint", {
                                    default:
                                        "블로그 레이아웃(헤더/본문/푸터)의 최대 너비를 설정합니다. (기본값: 1200px)",
                                })}
                            </p>
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={t("admin.theme.widget_placement") ||
                            t("admin.theme.widget_placement", {
                                default: "위젯 배치 관리",
                            })}
                        icon={Layers}
                    >
                        <p class="depth-4-hint mb-4">
                            {previewMode === "desktop"
                                ? t("admin.theme.widget_drag_hint")
                                : t("admin.theme.mobile_widget_hint")}
                        </p>

                        {#if previewMode === "desktop"}
                            {#each Array(currentLayout.columnCount) as _, colIdx}
                                <div class="mb-6">
                                    <p class="depth-3-label mb-2">
                                        {t("admin.theme.col_label", {
                                            n: String(colIdx + 1),
                                        })}
                                    </p>
                                    {#each columnWidgets[colIdx] || [] as w, itemIdx}
                                        <div class="widget-item">
                                            <span class="flex-1 text-sm"
                                                >{w.name || w.type}</span
                                            >
                                            <div
                                                class="flex items-center gap-1"
                                            >
                                                <button
                                                    class="btn-action-mini"
                                                    onclick={() =>
                                                        moveWidget(
                                                            colIdx,
                                                            itemIdx,
                                                            "up",
                                                        )}
                                                    disabled={itemIdx === 0}
                                                    >▲</button
                                                >
                                                <button
                                                    class="btn-action-mini"
                                                    onclick={() =>
                                                        moveWidget(
                                                            colIdx,
                                                            itemIdx,
                                                            "down",
                                                        )}
                                                    disabled={itemIdx ===
                                                        (columnWidgets[colIdx]
                                                            ?.length || 1) -
                                                            1}>▼</button
                                                >
                                                {#if currentLayout.columnCount > 1}
                                                    <select
                                                        class="btn-action-mini font-normal py-0"
                                                        onchange={(e) =>
                                                            moveWidgetToCol(
                                                                colIdx,
                                                                itemIdx,
                                                                parseInt(
                                                                    e
                                                                        .currentTarget
                                                                        .value,
                                                                ),
                                                            )}
                                                        value={colIdx}
                                                    >
                                                        {#each Array(currentLayout.columnCount) as _, targetIdx}
                                                            <option
                                                                value={targetIdx}
                                                                >C{targetIdx +
                                                                    1}</option
                                                            >
                                                        {/each}
                                                    </select>
                                                {/if}
                                                <button
                                                    class="btn-action-mini delete ml-1"
                                                    onclick={() =>
                                                        removeWidgetFromLayout(
                                                            w.id,
                                                        )}
                                                    >{t(
                                                        "admin.common.delete",
                                                    )}</button
                                                >
                                            </div>
                                        </div>
                                    {/each}
                                    {#if !(columnWidgets[colIdx] || []).length}
                                        <p class="hint depth-4-hint italic">
                                            {t("admin.theme.widget_none")}
                                        </p>
                                    {/if}
                                </div>
                            {/each}
                        {:else}
                            {#each Array(mobileColumnCount) as _, colIdx}
                                <div class="mb-6">
                                    <p class="depth-3-label mb-2">
                                        {t("admin.theme.col_label", {
                                            n: String(colIdx + 1),
                                        })}
                                    </p>
                                    {#each mobileColumnWidgets[colIdx] || [] as w, itemIdx}
                                        <div class="widget-item">
                                            <span class="flex-1 text-sm"
                                                >{w.name || w.type}</span
                                            >
                                            <div
                                                class="flex items-center gap-1"
                                            >
                                                <button
                                                    class="btn-action-mini"
                                                    onclick={() =>
                                                        moveWidget(
                                                            colIdx,
                                                            itemIdx,
                                                            "up",
                                                        )}
                                                    disabled={itemIdx === 0}
                                                    >▲</button
                                                >
                                                <button
                                                    class="btn-action-mini"
                                                    onclick={() =>
                                                        moveWidget(
                                                            colIdx,
                                                            itemIdx,
                                                            "down",
                                                        )}
                                                    disabled={itemIdx ===
                                                        (mobileColumnWidgets[
                                                            colIdx
                                                        ]?.length || 1) -
                                                            1}>▼</button
                                                >
                                                {#if mobileColumnCount > 1}
                                                    <select
                                                        class="btn-action-mini font-normal py-0"
                                                        onchange={(e) =>
                                                            moveWidgetToCol(
                                                                colIdx,
                                                                itemIdx,
                                                                parseInt(
                                                                    e
                                                                        .currentTarget
                                                                        .value,
                                                                ),
                                                            )}
                                                        value={colIdx}
                                                    >
                                                        {#each Array(mobileColumnCount) as _, targetIdx}
                                                            <option
                                                                value={targetIdx}
                                                                >C{targetIdx +
                                                                    1}</option
                                                            >
                                                        {/each}
                                                    </select>
                                                {/if}
                                                <button
                                                    class="btn-action-mini delete ml-1"
                                                    onclick={() =>
                                                        removeMobileWidgetFromLayout(
                                                            w.id,
                                                        )}
                                                    >{t(
                                                        "admin.common.delete",
                                                    )}</button
                                                >
                                            </div>
                                        </div>
                                    {/each}
                                    {#if !(mobileColumnWidgets[colIdx] || []).length}
                                        <p class="hint depth-4-hint italic">
                                            {t("admin.theme.widget_none")}
                                        </p>
                                    {/if}
                                </div>
                            {/each}
                        {/if}
                    </AccordionItem>

                    <AccordionItem
                        title={t("admin.theme.available_widgets") ||
                            t("admin.theme.widget_available_list", {
                                default: "배치 가능한 위젯 목록",
                            })}
                        icon={PlusSquare}
                    >
                        <div class="widgets-list">
                            {#each availableWidgets as widget (widget.id)}
                                <div class="widget-item">
                                    <span>{widget.name}</span>
                                    <div class="add-to-cols">
                                        {#if previewMode === "desktop"}
                                            {#each Array(currentLayout.columnCount) as _, i (i)}
                                                <button
                                                    aria-label="Add to Column {i +
                                                        1}"
                                                    onclick={() =>
                                                        addWidgetToLayout(
                                                            widget,
                                                            i,
                                                        )}>C{i + 1}</button
                                                >
                                            {/each}
                                        {:else}
                                            {#each Array(mobileColumnCount) as _, i (i)}
                                                <button
                                                    aria-label="Add to Mobile Column {i +
                                                        1}"
                                                    onclick={() =>
                                                        addMobileWidgetToLayout(
                                                            widget,
                                                            i,
                                                        )}>C{i + 1}</button
                                                >
                                            {/each}
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </AccordionItem>
                {:else if activeTab === "header"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.header_footer_settings") ||
                            t("admin.theme.header_footer_settings", {
                                default: "헤더 / 푸터 설정",
                            })}
                    </h2>

                    {#if previewMode === "desktop"}
                        <AccordionItem
                            title={t("admin.theme.header_layout_bg") ||
                                t("admin.theme.header_setting_title", {
                                    default: "헤더 설정",
                                })}
                            icon={Layout}
                        >
                            <section class="config-section compact">
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Layout
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.header_layout_bg", {
                                                default:
                                                    "레이아웃 및 배경 설정",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div
                                            class="form-group-mini mb-6 border-b border-slate-200 pb-4"
                                        >
                                            <label
                                                class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                                >{t(
                                                    "admin.theme.header_layout",
                                                )}</label
                                            >
                                            <div class="flex gap-1.5">
                                                {#each ["single-line", "two-line"] as mode}
                                                    <button
                                                        type="button"
                                                        class="flex-1 p-2 text-xs font-medium border rounded transition-colors {headerConfig.headerLayout ===
                                                        mode
                                                            ? 'bg-blue-500 text-white border-blue-500 font-semibold'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
                                                        onclick={() =>
                                                            (headerConfig.headerLayout =
                                                                mode)}
                                                    >
                                                        {mode === "single-line"
                                                            ? t(
                                                                  "admin.theme.layout_single",
                                                              )
                                                            : t(
                                                                  "admin.theme.layout_two",
                                                              )}
                                                    </button>
                                                {/each}
                                            </div>
                                            <p
                                                class="depth-4-hint mt-2 text-slate-500 leading-normal text-[11.5px]"
                                            >
                                                {t(
                                                    "admin.theme.header_layout_desc",
                                                )}
                                            </p>
                                        </div>

                                        <h4
                                            class="text-[11px] font-bold text-slate-600 uppercase mb-3 flex items-center gap-2"
                                        >
                                            <Maximize
                                                size={12}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.global_layout_settings",
                                            ) ||
                                                t(
                                                    "admin.theme.global_layout_settings",
                                                    {
                                                        default:
                                                            "물리적 레이아웃 설정",
                                                    },
                                                )}
                                        </h4>

                                        <div class="mb-6">
                                            <ShadowControl
                                                bind:value={
                                                    headerConfig.boxShadow
                                                }
                                                label={t(
                                                    "admin.theme.box_shadow",
                                                )}
                                            />
                                        </div>

                                        <div
                                            class="grid grid-cols-2 gap-4 mb-4"
                                        >
                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1 block"
                                                    >{t(
                                                        "admin.theme.header_height",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.height
                                                    }
                                                    placeholder="64px"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1 block"
                                                    >{t(
                                                        "admin.theme.header_side_margin",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.sideMargin
                                                    }
                                                    placeholder="20px"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                        </div>

                                        <div class="setting-group mt-4 mb-4">
                                            <div class="setting-row">
                                                <div class="setting-info">
                                                    <label
                                                        class="depth-3-label"
                                                    >
                                                        {t(
                                                            "admin.theme.header_show_border",
                                                        )}
                                                    </label>
                                                    <span class="depth-4-hint">
                                                        {t(
                                                            "admin.theme.header_show_border_hint",
                                                        )}
                                                    </span>
                                                </div>
                                                <div
                                                    class="setting-control flex-none"
                                                >
                                                    <label
                                                        class="relative inline-flex items-center cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            bind:checked={
                                                                headerConfig.showBorderBottom
                                                            }
                                                            class="sr-only peer"
                                                        />
                                                        <div
                                                            class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"
                                                        ></div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            class="p-2.5 bg-white rounded border border-slate-200"
                                        >
                                            <h5
                                                class="text-[10px] font-bold text-slate-400 uppercase mb-2"
                                            >
                                                {t("admin.theme.border_radius")}
                                            </h5>
                                            <div class="grid grid-cols-2 gap-3">
                                                <div class="form-group-mini">
                                                    <label
                                                        class="text-[9px] text-slate-400"
                                                        >{t(
                                                            "admin.theme.border_radius_tl",
                                                            {
                                                                default:
                                                                    "TL (좌상)",
                                                            },
                                                        )}</label
                                                    >
                                                    <input
                                                        type="number"
                                                        bind:value={
                                                            headerConfig
                                                                .borderRadius
                                                                .topLeft
                                                        }
                                                        class="text-xs p-1 border rounded w-full"
                                                    />
                                                </div>
                                                <div class="form-group-mini">
                                                    <label
                                                        class="text-[9px] text-slate-400"
                                                        >{t(
                                                            "admin.theme.border_radius_tr",
                                                            {
                                                                default:
                                                                    "TR (우상)",
                                                            },
                                                        )}</label
                                                    >
                                                    <input
                                                        type="number"
                                                        bind:value={
                                                            headerConfig
                                                                .borderRadius
                                                                .topRight
                                                        }
                                                        class="text-xs p-1 border rounded w-full"
                                                    />
                                                </div>
                                                <div class="form-group-mini">
                                                    <label
                                                        class="text-[9px] text-slate-400"
                                                        >{t(
                                                            "admin.theme.border_radius_bl",
                                                            {
                                                                default:
                                                                    "BL (좌하)",
                                                            },
                                                        )}</label
                                                    >
                                                    <input
                                                        type="number"
                                                        bind:value={
                                                            headerConfig
                                                                .borderRadius
                                                                .bottomLeft
                                                        }
                                                        class="text-xs p-1 border rounded w-full"
                                                    />
                                                </div>
                                                <div class="form-group-mini">
                                                    <label
                                                        class="text-[9px] text-slate-400"
                                                        >{t(
                                                            "admin.theme.border_radius_br",
                                                            {
                                                                default:
                                                                    "BR (우하)",
                                                            },
                                                        )}</label
                                                    >
                                                    <input
                                                        type="number"
                                                        bind:value={
                                                            headerConfig
                                                                .borderRadius
                                                                .bottomRight
                                                        }
                                                        class="text-xs p-1 border rounded w-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                <!-- Scrolled Header settings -->
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <MoveHorizontal
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.scrolled_header_settings",
                                                {
                                                    default:
                                                        "스크롤 고정 헤더 설정",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_height",
                                                        {
                                                            default:
                                                                "스크롤 시 헤더 높이",
                                                        },
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.scrolledHeight
                                                    }
                                                    placeholder="50px"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_max_width",
                                                        {
                                                            default:
                                                                "스크롤 시 최대 너비",
                                                        },
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.scrolledMaxWidth
                                                    }
                                                    placeholder="1000px"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                            <div
                                                class="form-group-mini col-span-2"
                                            >
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_nav_spacing",
                                                        {
                                                            default:
                                                                "스크롤 시 메뉴 좌우 간격",
                                                        },
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.scrolledNavSpacing
                                                    }
                                                    placeholder="1rem"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                <!-- Scrolled Logo Settings -->
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Type
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.scrolled_logo_settings",
                                                {
                                                    default:
                                                        "스크롤 고정 헤더 로고 설정",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="col-span-2">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.scrolled_logo_padding",
                                                        {
                                                            default:
                                                                "스크롤 시 로고 여백",
                                                        },
                                                    )}</label
                                                >
                                                <div
                                                    class="grid grid-cols-4 gap-2"
                                                >
                                                    {#each ["top", "right", "bottom", "left"] as dir}
                                                        <div
                                                            class="form-group-mini"
                                                        >
                                                            <label
                                                                class="text-[9px] text-slate-400 capitalize"
                                                                >{dir}</label
                                                            >
                                                            <input
                                                                type="number"
                                                                bind:value={
                                                                    headerConfig
                                                                        .scrolledLogoPadding[
                                                                        dir
                                                                    ]
                                                                }
                                                                class="text-xs p-1.5 border rounded w-full bg-white"
                                                            />
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>

                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_logo_alignment",
                                                        {
                                                            default:
                                                                "스크롤 시 로고 정렬 위치",
                                                        },
                                                    )}
                                                </label>
                                                <div class="flex gap-1.5">
                                                    {#each ["left", "center", "right"] as align}
                                                        <button
                                                            type="button"
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.scrolledLogoAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.scrolledLogoAlignment =
                                                                    align)}
                                                        >
                                                            {align === "left"
                                                                ? t(
                                                                      "admin.theme.align_left",
                                                                  )
                                                                : align ===
                                                                    "center"
                                                                  ? t(
                                                                        "admin.theme.align_center",
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_right",
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>

                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_logo_v_alignment",
                                                        {
                                                            default:
                                                                "스크롤 시 로고 수직 정렬",
                                                        },
                                                    )}
                                                </label>
                                                <div class="flex gap-1.5">
                                                    {#each ["top", "middle", "bottom"] as align}
                                                        <button
                                                            type="button"
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.scrolledLogoVerticalAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.scrolledLogoVerticalAlignment =
                                                                    align)}
                                                        >
                                                            {align === "top"
                                                                ? t(
                                                                      "admin.theme.align_top",
                                                                      {
                                                                          default:
                                                                              "상단",
                                                                      },
                                                                  )
                                                                : align ===
                                                                    "middle"
                                                                  ? t(
                                                                        "admin.theme.align_middle",
                                                                        {
                                                                            default:
                                                                                "중앙",
                                                                        },
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_bottom",
                                                                        {
                                                                            default:
                                                                                "하단",
                                                                        },
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                <!-- Scrolled Navigation Settings -->
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Palette
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.scrolled_nav_settings",
                                                {
                                                    default:
                                                        "스크롤 고정 헤더 메뉴 설정",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="col-span-2">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.scrolled_nav_padding",
                                                        {
                                                            default:
                                                                "스크롤 시 메뉴 여백",
                                                        },
                                                    )}</label
                                                >
                                                <div
                                                    class="grid grid-cols-4 gap-2"
                                                >
                                                    {#each ["top", "right", "bottom", "left"] as dir}
                                                        <div
                                                            class="form-group-mini"
                                                        >
                                                            <label
                                                                class="text-[9px] text-slate-400 capitalize"
                                                                >{dir}</label
                                                            >
                                                            <input
                                                                type="number"
                                                                bind:value={
                                                                    headerConfig
                                                                        .scrolledNavPadding[
                                                                        dir
                                                                    ]
                                                                }
                                                                class="text-xs p-1.5 border rounded w-full bg-white"
                                                            />
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>

                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_nav_alignment",
                                                        {
                                                            default:
                                                                "스크롤 시 메뉴 정렬 위치",
                                                        },
                                                    )}
                                                </label>
                                                <div class="flex gap-1.5">
                                                    {#each ["left", "center", "right"] as align}
                                                        <button
                                                            type="button"
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.scrolledNavAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.scrolledNavAlignment =
                                                                    align)}
                                                        >
                                                            {align === "left"
                                                                ? t(
                                                                      "admin.theme.align_left",
                                                                  )
                                                                : align ===
                                                                    "center"
                                                                  ? t(
                                                                        "admin.theme.align_center",
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_right",
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>

                                            <div class="form-group-mini">
                                                <label class="depth-4-label">
                                                    {t(
                                                        "admin.theme.scrolled_nav_v_alignment",
                                                        {
                                                            default:
                                                                "스크롤 시 메뉴 수직 정렬",
                                                        },
                                                    )}
                                                </label>
                                                <div class="flex gap-1.5">
                                                    {#each ["top", "middle", "bottom"] as align}
                                                        <button
                                                            type="button"
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.scrolledNavVerticalAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.scrolledNavVerticalAlignment =
                                                                    align)}
                                                        >
                                                            {align === "top"
                                                                ? t(
                                                                      "admin.theme.align_top",
                                                                      {
                                                                          default:
                                                                              "상단",
                                                                      },
                                                                  )
                                                                : align ===
                                                                    "middle"
                                                                  ? t(
                                                                        "admin.theme.align_middle",
                                                                        {
                                                                            default:
                                                                                "중앙",
                                                                        },
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_bottom",
                                                                        {
                                                                            default:
                                                                                "하단",
                                                                        },
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </section>
                        </AccordionItem>

                        <AccordionItem
                            title={t("admin.theme.header_identity") ||
                                t("admin.theme.logo_identity", {
                                    default: "로고 및 아이덴티티",
                                })}
                            icon={Type}
                        >
                            <section class="config-section compact">
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Type
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.logo_text_color", {
                                                default: "로고 텍스트 및 색상",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="form-group">
                                            <label
                                                for="logo-text"
                                                class="depth-3-label"
                                                >{t(
                                                    "admin.theme.logo_text",
                                                )}</label
                                            >
                                            <input
                                                id="logo-text"
                                                type="text"
                                                value={siteTitleConfig[
                                                    activeLang
                                                ]}
                                                oninput={(e) => {
                                                    const val =
                                                        e.currentTarget.value;
                                                    siteTitleConfig[
                                                        activeLang
                                                    ] = val;
                                                    if (
                                                        !headerConfig.logoText
                                                    ) {
                                                        headerConfig.logoText =
                                                            {};
                                                    }
                                                    headerConfig.logoText[
                                                        activeLang
                                                    ] = val;
                                                }}
                                                class="w-full"
                                            />
                                            <p
                                                class="depth-4-hint mt-1 text-blue-600"
                                            >
                                                💡 {t(
                                                    "admin.theme.logo_text_sync_hint",
                                                    {
                                                        default:
                                                            "이 값은 사이트 설정의 '사이트 제목'과 동기화됩니다.",
                                                    },
                                                )}
                                            </p>
                                        </div>

                                        <div class="mt-4">
                                            <BackgroundControl
                                                title={t(
                                                    "admin.theme.logo_color_gradient",
                                                )}
                                                typeLabel={t(
                                                    "admin.theme.text_color",
                                                )}
                                                bind:config={
                                                    headerConfig.logoColor
                                                }
                                                bind:gradientState={
                                                    logoGradient
                                                }
                                                allowInherit={true}
                                                compact={true}
                                            />
                                        </div>
                                    </div>
                                </details>

                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Palette
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.logo_style_padding",
                                                {
                                                    default:
                                                        "로고 스타일 및 여백",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="form-group-mini">
                                                <label for="logo-font"
                                                    >{t(
                                                        "admin.theme.logo_font",
                                                    )}</label
                                                >
                                                <select
                                                    id="logo-font"
                                                    bind:value={
                                                        headerConfig.logoFont
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full"
                                                >
                                                    <option value="inherit">
                                                        {t("admin.theme.font_inherit", { default: "기본 폰트 상속 (Inherit)" })}
                                                    </option>
                                                    <option value="Inter">Inter</option>
                                                    {#each customWebFonts as font}
                                                        <option value={font}>{font}</option>
                                                    {/each}
                                                </select>
                                            </div>
                                            <div class="form-group-mini">
                                                <label for="logo-font-size"
                                                    >{t(
                                                        "admin.theme.logo_font_size",
                                                    )}</label
                                                >
                                                <input
                                                    id="logo-font-size"
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.logoFontSize
                                                    }
                                                    placeholder="1.5rem"
                                                    class="text-sm p-1.5 border rounded w-full"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label for="logo-weight"
                                                    >{t(
                                                        "admin.theme.logo_weight",
                                                    )}</label
                                                >
                                                <select
                                                    id="logo-weight"
                                                    bind:value={
                                                        headerConfig.logoFontWeight
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full"
                                                >
                                                    {#each [100, 200, 300, 400, 500, 600, 700, 800, 900] as w}
                                                        <option
                                                            value={String(w)}
                                                            >{w}</option
                                                        >
                                                    {/each}
                                                </select>
                                            </div>
                                            <div class="form-group-mini">
                                                <label for="logo-letter-spacing"
                                                    >{t(
                                                        "admin.theme.logo_letter_spacing",
                                                    )}</label
                                                >
                                                <input
                                                    id="logo-letter-spacing"
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.logoLetterSpacing
                                                    }
                                                    placeholder="0px"
                                                    class="text-sm p-1.5 border rounded w-full"
                                                />
                                            </div>
                                            <div class="col-span-2">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1"
                                                    >{t(
                                                        "admin.theme.logo_padding",
                                                    )}</label
                                                >
                                                <div
                                                    class="grid grid-cols-4 gap-2"
                                                >
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Top</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .logoPadding
                                                                    .top
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Right</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .logoPadding
                                                                    .right
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Bottom</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .logoPadding
                                                                    .bottom
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Left</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .logoPadding
                                                                    .left
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            class="grid grid-cols-2 gap-4 mt-3"
                                        >
                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1"
                                                    >{t(
                                                        "admin.theme.logo_alignment",
                                                    )}</label
                                                >
                                                <div class="flex gap-1.5">
                                                    {#each ["left", "center", "right"] as align}
                                                        <button
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.logoAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.logoAlignment =
                                                                    align)}
                                                        >
                                                            {align === "left"
                                                                ? t(
                                                                      "admin.theme.align_left",
                                                                  )
                                                                : align ===
                                                                    "center"
                                                                  ? t(
                                                                        "admin.theme.align_center",
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_right",
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>

                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1"
                                                    >{t(
                                                        "admin.theme.logo_v_alignment",
                                                        {
                                                            default:
                                                                "로고 수직 정렬",
                                                        },
                                                    )}</label
                                                >
                                                <div class="flex gap-1.5">
                                                    {#each ["top", "middle", "bottom"] as align}
                                                        <button
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.logoVerticalAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.logoVerticalAlignment =
                                                                    align)}
                                                        >
                                                            {align === "top"
                                                                ? t(
                                                                      "admin.theme.align_top",
                                                                      {
                                                                          default:
                                                                              "상단",
                                                                      },
                                                                  )
                                                                : align ===
                                                                    "middle"
                                                                  ? t(
                                                                        "admin.theme.align_middle",
                                                                        {
                                                                            default:
                                                                                "중앙",
                                                                        },
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_bottom",
                                                                        {
                                                                            default:
                                                                                "하단",
                                                                        },
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>

                                            {#if headerConfig.headerLayout === "two-line"}
                                                <div
                                                    class="col-span-2 mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-blue-700 text-[10.5px] leading-relaxed flex items-start gap-1.5"
                                                >
                                                    <span
                                                        >{t(
                                                            "admin.theme.header_layout_two_line_hint",
                                                        )}</span
                                                    >
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </details>

                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Sparkles
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.logo_hover_effect")}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-3">
                                            <div
                                                class="form-group-mini col-span-2"
                                            >
                                                <label
                                                    for="logo-hover-effect-select"
                                                    >{t(
                                                        "admin.theme.logo_hover_effect",
                                                    )}</label
                                                >
                                                <select
                                                    id="logo-hover-effect-select"
                                                    bind:value={
                                                        headerConfig.logoHoverEffect
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full bg-white text-slate-800"
                                                >
                                                    <option value="none"
                                                        >{t(
                                                            "admin.theme.logo_hover_effect_none",
                                                        )}</option
                                                    >
                                                    <option value="scale"
                                                        >{t(
                                                            "admin.theme.logo_hover_effect_scale",
                                                        )}</option
                                                    >
                                                    <option value="float"
                                                        >{t(
                                                            "admin.theme.logo_hover_effect_float",
                                                        )}</option
                                                    >
                                                    <option value="color"
                                                        >{t(
                                                            "admin.theme.logo_hover_effect_color",
                                                        )}</option
                                                    >
                                                </select>
                                            </div>
                                            {#if headerConfig.logoHoverEffect === "scale"}
                                                <div
                                                    class="form-group-mini col-span-2"
                                                >
                                                    <div
                                                        class="flex justify-between items-center mb-1"
                                                    >
                                                        <label
                                                            for="logo-hover-scale-slider"
                                                            class="text-xs text-slate-500"
                                                            >{t(
                                                                "admin.theme.logo_hover_scale",
                                                            )}</label
                                                        >
                                                        <span
                                                            class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded"
                                                            >{headerConfig.logoHoverScale ||
                                                                1.02}x</span
                                                        >
                                                    </div>
                                                    <input
                                                        id="logo-hover-scale-slider"
                                                        type="range"
                                                        min="1.00"
                                                        max="1.15"
                                                        step="0.01"
                                                        bind:value={
                                                            headerConfig.logoHoverScale
                                                        }
                                                        class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                    />
                                                </div>
                                            {/if}
                                            {#if headerConfig.logoHoverEffect === "float"}
                                                <div
                                                    class="form-group-mini col-span-2"
                                                >
                                                    <div
                                                        class="flex justify-between items-center mb-1"
                                                    >
                                                        <label
                                                            for="logo-hover-float-offset-slider"
                                                            class="text-xs text-slate-500"
                                                            >{t(
                                                                "admin.theme.logo_hover_float_offset",
                                                                {
                                                                    default:
                                                                        "호버 플로팅 거리",
                                                                },
                                                            )}</label
                                                        >
                                                        <span
                                                            class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded"
                                                            >{headerConfig.logoHoverFloatOffset ||
                                                                2}px</span
                                                        >
                                                    </div>
                                                    <input
                                                        id="logo-hover-float-offset-slider"
                                                        type="range"
                                                        min="0"
                                                        max="10"
                                                        step="1"
                                                        bind:value={
                                                            headerConfig.logoHoverFloatOffset
                                                        }
                                                        class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                    />
                                                </div>
                                            {/if}
                                            {#if headerConfig.logoHoverEffect === "color"}
                                                <div
                                                    class="logo-hover-color-picker mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 col-span-2"
                                                >
                                                    <div
                                                        class="flex justify-between items-center mb-3"
                                                    >
                                                        <label
                                                            for="logo-hover-color-type"
                                                            class="text-xs font-semibold text-slate-600"
                                                        >
                                                            {t(
                                                                "admin.theme.logo_hover_color",
                                                            )}
                                                        </label>
                                                        <select
                                                            id="logo-hover-color-type"
                                                            bind:value={
                                                                headerConfig
                                                                    .logoHoverColor
                                                                    .type
                                                            }
                                                            class="text-xs p-1 border rounded bg-white text-slate-800"
                                                        >
                                                            <option
                                                                value="solid"
                                                                >{t(
                                                                    "admin.theme.bg_solid",
                                                                )}</option
                                                            >
                                                            <option
                                                                value="gradient"
                                                                >{t(
                                                                    "admin.theme.bg_gradient",
                                                                )}</option
                                                            >
                                                        </select>
                                                    </div>

                                                    {#if headerConfig.logoHoverColor.type === "solid"}
                                                        <ColorControl
                                                            label=""
                                                            bind:value={
                                                                headerConfig
                                                                    .logoHoverColor
                                                                    .value
                                                            }
                                                            showPresets={false}
                                                        />
                                                    {:else}
                                                        <GradientBuilder
                                                            bind:state={
                                                                logoHoverGradient
                                                            }
                                                            onUpdate={() => {
                                                                const stopsStr =
                                                                    logoHoverGradient.stops.join(
                                                                        ", ",
                                                                    );
                                                                headerConfig.logoHoverColor.value = `linear-gradient(${logoHoverGradient.angle}deg, ${stopsStr})`;
                                                            }}
                                                        />
                                                        <div
                                                            class="css-preview mt-2 p-1.5 bg-slate-100 rounded border text-mono text-xs overflow-x-auto text-slate-600"
                                                        >
                                                            <code
                                                                >{headerConfig
                                                                    .logoHoverColor
                                                                    .value}</code
                                                            >
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/if}
                                            {#if headerConfig.logoHoverEffect !== "none"}
                                                <div
                                                    class="form-group-mini col-span-2 mt-2 pt-2 border-t border-dashed border-slate-200"
                                                >
                                                    <div
                                                        class="flex items-center justify-between"
                                                    >
                                                        <span
                                                            class="text-xs font-semibold text-slate-600"
                                                        >
                                                            {t(
                                                                "admin.theme.logo_hover_shadow_enabled",
                                                                {
                                                                    default:
                                                                        "로고 호버 그림자 사용",
                                                                },
                                                            )}
                                                        </span>
                                                        <label
                                                            class="relative inline-flex items-center cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                bind:checked={
                                                                    headerConfig.logoHoverShadowEnabled
                                                                }
                                                                class="sr-only peer"
                                                            />
                                                            <div
                                                                class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                                                            ></div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {#if headerConfig.logoHoverShadowEnabled}
                                                    <div
                                                        class="logo-hover-shadow-picker mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 col-span-2"
                                                    >
                                                            <ColorControl
                                                                label={t(
                                                                    "admin.theme.logo_hover_shadow_color",
                                                                    {
                                                                        default:
                                                                            "로고 호버 그림자 색상",
                                                                    },
                                                                )}
                                                                bind:value={
                                                                    headerConfig
                                                                        .logoHoverShadowColor
                                                                        .value
                                                                }
                                                                showPresets={false}
                                                            />
                                                    </div>
                                                {/if}
                                            {/if}
                                        </div>
                                    </div>
                                </details>
                            </section>
                        </AccordionItem>

                        <AccordionItem
                            title={t("admin.theme.header_navigation_system", {
                                default: "내비게이션 및 시스템",
                            })}
                            icon={LayoutTemplate}
                        >
                            <section class="config-section compact">
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Layout
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.nav_menu", {
                                                default: "데스크탑 메뉴 항목",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="flex flex-col gap-3">
                                            {#each headerConfig.menuItems as item, i (item.id)}
                                                <div
                                                    class="p-3 bg-slate-50 rounded-lg border border-slate-100"
                                                >
                                                    <!-- Row 1: 명칭 & 경로 -->
                                                    <div
                                                        class="flex gap-2 items-center mb-3"
                                                    >
                                                        <div class="flex-1">
                                                            <label
                                                                class="text-[9px] text-slate-400 mb-0.5 block"
                                                                >{t(
                                                                    "admin.theme.menu_label",
                                                                )}</label
                                                            >
                                                            <input
                                                                type="text"
                                                                bind:value={
                                                                    item.label[
                                                                        activeLang
                                                                    ]
                                                                }
                                                                placeholder="Home"
                                                                class="w-full p-1.5 border rounded text-xs bg-white"
                                                            />
                                                        </div>
                                                        <div class="flex-1">
                                                            <label
                                                                class="text-[9px] text-slate-400 mb-0.5 block"
                                                                >{t(
                                                                    "admin.theme.menu_path",
                                                                )}</label
                                                            >
                                                            {#if item.type === "link"}
                                                                <input
                                                                    type="text"
                                                                    bind:value={
                                                                        item.url
                                                                    }
                                                                    placeholder="/"
                                                                    class="w-full p-1.5 border rounded text-xs bg-white"
                                                                />
                                                            {:else}
                                                                <div
                                                                    class="w-full p-1.5 border border-transparent text-xs text-blue-600 font-bold"
                                                                >
                                                                    {t(
                                                                        "admin.theme.menu_category",
                                                                    )}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    </div>

                                                    <!-- Row 2: 아이콘 & 도구 -->
                                                    <div
                                                        class="flex items-center justify-between"
                                                    >
                                                        <div
                                                            class="flex items-center gap-2"
                                                        >
                                                            <!-- Icon Picker -->
                                                            <div
                                                                class="relative"
                                                            >
                                                                <button
                                                                    onclick={() =>
                                                                        (showIconPicker =
                                                                            showIconPicker ===
                                                                            item.id
                                                                                ? null
                                                                                : item.id)}
                                                                    class="flex items-center gap-1.5 p-1 px-2.5 border rounded bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    {#if iconMap[item.icon]}
                                                                        {@const IconComp =
                                                                            iconMap[
                                                                                item
                                                                                    .icon
                                                                            ]}
                                                                        <IconComp
                                                                            size={12}
                                                                        />
                                                                    {:else}
                                                                        <Link
                                                                            size={12}
                                                                        />
                                                                    {/if}
                                                                    <span
                                                                        >{item.icon ||
                                                                            "Icon"}</span
                                                                    >
                                                                </button>

                                                                {#if showIconPicker === item.id}
                                                                    <div
                                                                        class="absolute z-50 bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2 grid grid-cols-4 gap-1 w-48"
                                                                    >
                                                                        {#each commonIcons as icon}
                                                                            {@const Icon =
                                                                                icon.component}
                                                                            <button
                                                                                onclick={() =>
                                                                                    selectIcon(
                                                                                        item.id,
                                                                                        icon.name,
                                                                                    )}
                                                                                title={icon.name}
                                                                                class="p-1.5 border-none bg-none rounded-lg cursor-pointer flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-500 transition-colors"
                                                                            >
                                                                                <Icon
                                                                                    size={16}
                                                                                />
                                                                            </button>
                                                                        {/each}
                                                                    </div>
                                                                {/if}
                                                            </div>

                                                            <!-- 순서 조정 -->
                                                            <div
                                                                class="flex border rounded overflow-hidden bg-white"
                                                            >
                                                                <button
                                                                    disabled={i ===
                                                                        0}
                                                                    onclick={() =>
                                                                        moveMenuUp(
                                                                            i,
                                                                        )}
                                                                    class="p-1 px-2 border-none border-r border-slate-100 bg-transparent text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                                                                >
                                                                    <ChevronUp
                                                                        size={14}
                                                                    />
                                                                </button>
                                                                <button
                                                                    disabled={i ===
                                                                        headerConfig
                                                                            .menuItems
                                                                            .length -
                                                                            1}
                                                                    onclick={() =>
                                                                        moveMenuDown(
                                                                            i,
                                                                        )}
                                                                    class="p-1 px-2 border-none bg-transparent text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                                                                >
                                                                    <ChevronDown
                                                                        size={14}
                                                                    />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <!-- 삭제 -->
                                                        <button
                                                            onclick={() =>
                                                                (headerConfig.menuItems =
                                                                    headerConfig.menuItems.filter(
                                                                        (m) =>
                                                                            m.id !==
                                                                            item.id,
                                                                    ))}
                                                            class="p-1 border border-slate-200 rounded bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                                                            title={t(
                                                                "admin.common.delete",
                                                                {
                                                                    default:
                                                                        "삭제",
                                                                },
                                                            )}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>

                                        <div class="mt-4 flex gap-2">
                                            <button
                                                class="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                onclick={() =>
                                                    (headerConfig.menuItems = [
                                                        ...headerConfig.menuItems,
                                                        {
                                                            id: Date.now(),
                                                            type: "link",
                                                            label: ensureTranslationObj(
                                                                "New Page",
                                                                "New Page",
                                                            ),
                                                            url: "/",
                                                            icon: "Plus",
                                                        },
                                                    ])}
                                            >
                                                <Plus size={14} />
                                                {t("admin.theme.add_link")}
                                            </button>
                                            <button
                                                class="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                onclick={() =>
                                                    (headerConfig.menuItems = [
                                                        ...headerConfig.menuItems,
                                                        {
                                                            id: Date.now(),
                                                            type: "category_drawer",
                                                            label: ensureTranslationObj(
                                                                "Categories",
                                                                "Categories",
                                                            ),
                                                            icon: "Menu",
                                                        },
                                                    ])}
                                            >
                                                <Menu size={14} />
                                                {t(
                                                    "admin.theme.add_category_drawer",
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </details>

                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Settings
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.system_fixed_menu",
                                                {
                                                    default:
                                                        "시스템 메뉴 및 인증",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div
                                            class="flex items-center justify-between mb-4 pb-3 border-b border-blue-100/50"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <Globe
                                                    size={14}
                                                    class="text-blue-600"
                                                />
                                                <span
                                                    class="text-[11px] font-medium text-slate-700"
                                                    >{t(
                                                        "admin.theme.show_language_switcher",
                                                    )}</span
                                                >
                                            </div>
                                            <button
                                                class="w-10 h-5 rounded-full transition-colors relative {headerConfig.showLanguageSwitcher
                                                    ? 'bg-blue-500'
                                                    : 'bg-slate-300'}"
                                                onclick={() =>
                                                    (headerConfig.showLanguageSwitcher =
                                                        !headerConfig.showLanguageSwitcher)}
                                            >
                                                <div
                                                    class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {headerConfig.showLanguageSwitcher
                                                        ? 'translate-x-5'
                                                        : ''}"
                                                ></div>
                                            </button>
                                        </div>

                                        <div class="space-y-3">
                                            <div class="form-group-mini">
                                                <div
                                                    class="flex items-center gap-2 mb-1.5"
                                                >
                                                    <LogIn
                                                        size={13}
                                                        class="text-blue-600"
                                                    />
                                                    <label
                                                        class="text-[10px] font-bold text-slate-500 uppercase"
                                                        >{t(
                                                            "admin.theme.login_label",
                                                        )}</label
                                                    >
                                                </div>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.loginLabel[
                                                            activeLang
                                                        ]
                                                    }
                                                    placeholder="Login"
                                                    class="w-full text-xs p-1.5 border border-blue-100 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <div
                                                    class="flex items-center gap-2 mb-1.5"
                                                >
                                                    <User
                                                        size={13}
                                                        class="text-blue-600"
                                                    />
                                                    <label
                                                        class="text-[10px] font-bold text-slate-500 uppercase"
                                                        >{t(
                                                            "admin.theme.profile_label",
                                                        )}</label
                                                    >
                                                </div>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig
                                                            .profileLabel[
                                                            activeLang
                                                        ]
                                                    }
                                                    placeholder="Profile"
                                                    class="w-full text-xs p-1.5 border border-blue-100 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Palette
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.nav_style", {
                                                default:
                                                    "내비게이션 스타일 및 여백",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.nav_align",
                                                    )}</label
                                                >
                                                <div class="flex gap-1.5">
                                                    {#each ["left", "center", "right"] as align}
                                                        <button
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.navAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.navAlignment =
                                                                    align)}
                                                        >
                                                            {align === "left"
                                                                ? t(
                                                                      "admin.theme.align_left",
                                                                  )
                                                                : align ===
                                                                    "center"
                                                                  ? t(
                                                                        "admin.theme.align_center",
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_right",
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.nav_v_alignment",
                                                        {
                                                            default:
                                                                "내비 수직 정렬",
                                                        },
                                                    )}</label
                                                >
                                                <div class="flex gap-1.5">
                                                    {#each ["top", "middle", "bottom"] as align}
                                                        <button
                                                            class="flex-1 p-1.5 text-[10px] border rounded transition-colors {headerConfig.navVerticalAlignment ===
                                                            align
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-600 hover:bg-slate-50'}"
                                                            onclick={() =>
                                                                (headerConfig.navVerticalAlignment =
                                                                    align)}
                                                        >
                                                            {align === "top"
                                                                ? t(
                                                                      "admin.theme.align_top",
                                                                      {
                                                                          default:
                                                                              "상단",
                                                                      },
                                                                  )
                                                                : align ===
                                                                    "middle"
                                                                  ? t(
                                                                        "admin.theme.align_middle",
                                                                        {
                                                                            default:
                                                                                "중앙",
                                                                        },
                                                                    )
                                                                  : t(
                                                                        "admin.theme.align_bottom",
                                                                        {
                                                                            default:
                                                                                "하단",
                                                                        },
                                                                    )}
                                                        </button>
                                                    {/each}
                                                </div>
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.nav_spacing",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        headerConfig.navSpacing
                                                    }
                                                    placeholder="1.5rem"
                                                    class="text-xs p-1.5 border rounded w-full bg-white"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.nav_text_color",
                                                    )}</label
                                                >
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <input
                                                        type="color"
                                                        bind:value={
                                                            headerConfig.navTextColor
                                                        }
                                                        class="w-8 h-8 p-0 border-0 cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        bind:value={
                                                            headerConfig.navTextColor
                                                        }
                                                        class="flex-1 text-[11px] p-1.5 border rounded bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div class="col-span-2">
                                                <label
                                                    class="text-[10px] text-slate-500 mb-1 block"
                                                    >{t(
                                                        "admin.theme.nav_group_padding",
                                                    )}</label
                                                >
                                                <div
                                                    class="grid grid-cols-4 gap-2"
                                                >
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Top</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .navPadding
                                                                    .top
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Right</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .navPadding
                                                                    .right
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Bottom</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .navPadding
                                                                    .bottom
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div
                                                        class="form-group-mini"
                                                    >
                                                        <label
                                                            class="text-[9px] text-slate-400"
                                                            >Left</label
                                                        >
                                                        <input
                                                            type="number"
                                                            bind:value={
                                                                headerConfig
                                                                    .navPadding
                                                                    .left
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            </section>
                        </AccordionItem>

                        <AccordionItem
                            title={t("admin.theme.footer_setting_title", {
                                default: "푸터 설정",
                            })}
                            icon={LayoutTemplate}
                        >
                            <section class="config-section compact">
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Type
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.footer_content", {
                                                default: "콘텐츠 및 텍스트",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <div class="form-group-mini mt-2">
                                            <label
                                                >{t(
                                                    "admin.theme.footer_text_style",
                                                )}</label
                                            >
                                            <div class="color-grid">
                                                <ColorControl
                                                    label={t(
                                                        "admin.theme.footer_text_color",
                                                    )}
                                                    bind:value={
                                                        footerConfig.text.color
                                                    }
                                                />
                                            </div>
                                            <div class="form-group-mini mt-2">
                                                <label
                                                    >{t(
                                                        "admin.theme.footer_font_size",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        footerConfig.text
                                                            .fontSize
                                                    }
                                                    placeholder={t(
                                                        "admin.theme.footer_font_size_placeholder",
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label for="footer-copyright"
                                                >{t(
                                                    "admin.theme.footer_copyright",
                                                )}</label
                                            >
                                            <input
                                                id="footer-copyright"
                                                type="text"
                                                bind:value={
                                                    footerConfig.copyright[
                                                        activeLang
                                                    ]
                                                }
                                            />
                                            <span class="depth-4-hint">
                                                {t(
                                                    "admin.theme.footer_copyright_hint",
                                                )}
                                                {t(
                                                    "admin.theme.footer_copyright_example",
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </details>

                                <!-- Border and Shadow Section -->
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Maximize
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t(
                                                "admin.theme.footer_border_shadow",
                                                {
                                                    default: "테두리 및 그림자",
                                                },
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <h4
                                            class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"
                                        >
                                            {t("admin.theme.border_radius")}
                                        </h4>
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.border_radius_tl",
                                                        {
                                                            default:
                                                                "TL (좌상)",
                                                        },
                                                    )}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        footerConfig
                                                            .borderRadius
                                                            .topLeft
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full bg-slate-50"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.border_radius_tr",
                                                        {
                                                            default:
                                                                "TR (우상)",
                                                        },
                                                    )}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        footerConfig
                                                            .borderRadius
                                                            .topRight
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full bg-slate-50"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.border_radius_bl",
                                                        {
                                                            default:
                                                                "BL (좌하)",
                                                        },
                                                    )}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        footerConfig
                                                            .borderRadius
                                                            .bottomLeft
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full bg-slate-50"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-4-label"
                                                    >{t(
                                                        "admin.theme.border_radius_br",
                                                        {
                                                            default:
                                                                "BR (우하)",
                                                        },
                                                    )}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        footerConfig
                                                            .borderRadius
                                                            .bottomRight
                                                    }
                                                    class="text-sm p-1.5 border rounded w-full bg-slate-50"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <ShadowControl
                                        bind:value={footerConfig.boxShadow}
                                        label={t("admin.theme.box_shadow")}
                                        defaultY={-4}
                                    />

                                    <div class="setting-group mt-4 mb-2">
                                        <div class="setting-row">
                                            <div class="setting-info">
                                                <label class="depth-3-label">
                                                    {t(
                                                        "admin.theme.footer_show_border",
                                                    )}
                                                </label>
                                                <span class="depth-4-hint">
                                                    {t(
                                                        "admin.theme.footer_show_border_hint",
                                                    )}
                                                </span>
                                            </div>
                                            <div
                                                class="setting-control flex-none"
                                            >
                                                <label
                                                    class="relative inline-flex items-center cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        bind:checked={
                                                            footerConfig.showBorderTop
                                                        }
                                                        class="sr-only peer"
                                                    />
                                                    <div
                                                        class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"
                                                    ></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                <!-- Footer Navigation Section -->
                                <details
                                    class="group bg-white rounded-lg border border-slate-200 mb-3 overflow-hidden"
                                >
                                    <summary
                                        class="flex justify-between items-center p-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 text-[13px] uppercase tracking-wider select-none"
                                    >
                                        <div class="flex items-center gap-2">
                                            <Menu
                                                size={14}
                                                class="text-slate-400"
                                            />
                                            {t("admin.theme.footer_nav", {
                                                default: "푸터 내비게이션",
                                            })}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            class="text-slate-400 group-open:rotate-180 transition-transform duration-200"
                                        />
                                    </summary>
                                    <div class="p-3 bg-white">
                                        <!-- Link Style Controls -->
                                        <div
                                            class="grid grid-cols-2 gap-4 mb-4"
                                        >
                                            <div class="form-group-mini">
                                                <label
                                                    >{t(
                                                        "admin.theme.footer_link_font_size",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        footerConfig.navFontSize
                                                    }
                                                    placeholder="0.85rem"
                                                    class="text-sm p-1.5 border rounded w-full"
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label
                                                    >{t(
                                                        "admin.theme.footer_link_color",
                                                    )}</label
                                                >
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <input
                                                        type="color"
                                                        value={footerConfig.navColor ||
                                                            "#000000"}
                                                        oninput={(e) =>
                                                            (footerConfig.navColor =
                                                                e.currentTarget.value)}
                                                        class="w-10 h-8 p-0 border-0 cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        bind:value={
                                                            footerConfig.navColor
                                                        }
                                                        class="flex-1 text-sm p-1.5 border rounded"
                                                    />
                                                </div>
                                            </div>
                                            <div
                                                class="form-group-mini col-span-2"
                                            >
                                                <label
                                                    >{t(
                                                        "admin.theme.footer_link_hover",
                                                    )}</label
                                                >
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <input
                                                        type="color"
                                                        value={footerConfig.navHoverColor ||
                                                            "#000000"}
                                                        oninput={(e) =>
                                                            (footerConfig.navHoverColor =
                                                                e.currentTarget.value)}
                                                        class="w-10 h-8 p-0 border-0 cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        bind:value={
                                                            footerConfig.navHoverColor
                                                        }
                                                        class="flex-1 text-sm p-1.5 border rounded"
                                                        placeholder={t(
                                                            "admin.theme.footer_link_hover_placeholder",
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Link Items -->
                                        <div class="flex flex-col gap-4">
                                            {#each footerConfig.navLinks as link, i (link.id)}
                                                <div
                                                    class="border border-slate-200 rounded-lg p-3 bg-slate-50"
                                                >
                                                    <div
                                                        class="flex items-center gap-2 mb-3"
                                                    >
                                                        <span
                                                            class="depth-4-label min-w-[30px]"
                                                            >{t(
                                                                "admin.theme.footer_item_label",
                                                            )}</span
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                link.label[
                                                                    activeLang
                                                                ]
                                                            }
                                                            placeholder={t(
                                                                "admin.theme.footer_item_label_placeholder",
                                                                {
                                                                    default:
                                                                        "소개",
                                                                },
                                                            )}
                                                            class="flex-1 min-w-0 p-1.5 border rounded text-sm bg-white"
                                                        />
                                                        <span
                                                            class="depth-4-label min-w-[30px] ml-1"
                                                            >{t(
                                                                "admin.theme.footer_item_path",
                                                                {
                                                                    default:
                                                                        "경로",
                                                                },
                                                            )}</span
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                link.url
                                                            }
                                                            placeholder="/about"
                                                            class="flex-1 min-w-0 p-1.5 border rounded text-sm bg-white"
                                                        />
                                                        <button
                                                            onclick={() =>
                                                                (footerConfig.navLinks =
                                                                    footerConfig.navLinks.filter(
                                                                        (l) =>
                                                                            l.id !==
                                                                            link.id,
                                                                    ))}
                                                            class="p-1.5 border border-slate-200 rounded bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                                                            title={t(
                                                                "admin.common.delete",
                                                                {
                                                                    default:
                                                                        "삭제",
                                                                },
                                                            )}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    <div
                                                        class="flex flex-col gap-1.5"
                                                    >
                                                        <label
                                                            class="depth-4-label text-blue-500"
                                                            >{t(
                                                                "admin.theme.footer_html_label",
                                                            )}</label
                                                        >
                                                        <textarea
                                                            bind:value={
                                                                link.htmlContent
                                                            }
                                                            placeholder={t(
                                                                "admin.theme.footer_html_placeholder",
                                                                {
                                                                    default:
                                                                        "<div>여기에 HTML 코드를 입력하면 해당 경로 접속 시 이 내용이 웹페이지로 렌더링됩니다.</div>",
                                                                },
                                                            )}
                                                            class="w-full h-20 p-2 border border-slate-200 rounded text-sm font-mono resize-y focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                                        ></textarea>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>

                                        <button
                                            class="mt-3 w-full p-2 bg-slate-100 border border-dashed border-slate-300 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                            onclick={() =>
                                                (footerConfig.navLinks = [
                                                    ...footerConfig.navLinks,
                                                    {
                                                        id: Date.now(),
                                                        label: ensureTranslationObj(
                                                            "New Link",
                                                            "New Link",
                                                        ),
                                                        url: "/",
                                                        htmlContent: "",
                                                    },
                                                ])}
                                        >
                                            <Plus size={14} />
                                            {t("admin.theme.add_footer_link")}
                                        </button>
                                    </div>
                                </details>
                            </section>
                        </AccordionItem>
                    {:else if previewMode === "mobile"}
                        <!-- 1. 모바일 헤더 레이아웃 설정 -->
                        <AccordionItem
                            // title={`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.header_settings")}`}
                            title={`${t("admin.theme.header_settings")}`}
                            icon={Layout}
                        >
                            <div
                                class="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.header_height")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={headerConfig.mobile.height}
                                        placeholder="50px"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                    <p
                                        class="depth-4-hint mt-1 text-slate-500 text-[11px]"
                                    >
                                        {t("admin.theme.header_height_hint")}
                                    </p>
                                </div>
                            </div>
                        </AccordionItem>

                        <!-- 2. 모바일 로고 및 정렬 설정 -->
                        <AccordionItem
                            // title={`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.header_identity")}`}
                            title={`${t("admin.theme.header_identity")}`}
                            icon={Type}
                        >
                            <div
                                class="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.logo_font_size")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            headerConfig.mobile.logoFontSize
                                        }
                                        placeholder="1.2rem"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.logo_alignment")}
                                    </label>
                                    <div class="flex gap-1">
                                        {#each ["left", "center", "right"] as align}
                                            <button
                                                type="button"
                                                class="flex-1 p-2 text-xs font-medium border rounded transition-colors {headerConfig
                                                    .mobile.logoAlignment ===
                                                align
                                                    ? 'bg-blue-500 text-white border-blue-500 font-semibold'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
                                                onclick={() =>
                                                    (headerConfig.mobile.logoAlignment =
                                                        align)}
                                            >
                                                {align === "left"
                                                    ? t(
                                                          "admin.theme.align_left",
                                                      )
                                                    : align === "center"
                                                      ? t(
                                                            "admin.theme.align_center",
                                                        )
                                                      : t(
                                                            "admin.theme.align_right",
                                                        )}
                                            </button>
                                        {/each}
                                    </div>
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="text-[10px] text-slate-500 mb-1 block"
                                    >
                                        {t("admin.theme.logo_padding")}
                                    </label>
                                    <div class="grid grid-cols-4 gap-2">
                                        {#each ["top", "right", "bottom", "left"] as side}
                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[9px] text-slate-400 capitalize"
                                                    >{side}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        headerConfig.mobile
                                                            .logoPadding[side]
                                                    }
                                                    class="text-xs p-1 border rounded w-full"
                                                />
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </AccordionItem>

                        <!-- 3. 모바일 내비게이션 설정 -->
                        <AccordionItem
                            // title={`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.header_navigation_system")}`}
                            title={`${t("admin.theme.header_navigation_system")}`}
                            icon={LayoutTemplate}
                        >
                            <div
                                class="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.nav_align")}
                                    </label>
                                    <div class="flex gap-1">
                                        {#each ["left", "center", "right"] as align}
                                            <button
                                                type="button"
                                                class="flex-1 p-2 text-xs font-medium border rounded transition-colors {headerConfig
                                                    .mobile.navAlignment ===
                                                align
                                                    ? 'bg-blue-500 text-white border-blue-500 font-semibold'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
                                                onclick={() =>
                                                    (headerConfig.mobile.navAlignment =
                                                        align)}
                                            >
                                                {align === "left"
                                                    ? t(
                                                          "admin.theme.align_left",
                                                      )
                                                    : align === "center"
                                                      ? t(
                                                            "admin.theme.align_center",
                                                        )
                                                      : t(
                                                            "admin.theme.align_right",
                                                        )}
                                            </button>
                                        {/each}
                                    </div>
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="text-[10px] text-slate-500 mb-1 block"
                                    >
                                        {t("admin.theme.nav_group_padding")}
                                    </label>
                                    <div class="grid grid-cols-4 gap-2">
                                        {#each ["top", "right", "bottom", "left"] as side}
                                            <div class="form-group-mini">
                                                <label
                                                    class="text-[9px] text-slate-400 capitalize"
                                                    >{side}</label
                                                >
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        headerConfig.mobile
                                                            .navPadding[side]
                                                    }
                                                    class="text-xs p-1 border rounded w-full"
                                                />
                                            </div>
                                        {/each}
                                    </div>
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.nav_spacing")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            headerConfig.mobile.navSpacing
                                        }
                                        placeholder="1rem"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div
                                    class="mb-4 border border-slate-100 p-2.5 rounded-lg bg-slate-50/50"
                                    style="display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 1rem; width: 100%; box-sizing: border-box;"
                                >
                                    <div
                                        style="display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1;"
                                    >
                                        <Globe
                                            size={14}
                                            class="text-blue-600"
                                            style="flex-shrink: 0;"
                                        />
                                        <span
                                            class="text-[11px] font-medium text-slate-700"
                                            style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                                        >
                                            {t(
                                                "admin.theme.show_language_switcher",
                                            )}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        class="w-10 h-5 rounded-full transition-colors relative {headerConfig
                                            .mobile.showLanguageSwitcher
                                            ? 'bg-blue-500'
                                            : 'bg-slate-300'}"
                                        style="flex-shrink: 0; width: 40px; height: 20px;"
                                        onclick={() =>
                                            (headerConfig.mobile.showLanguageSwitcher =
                                                !headerConfig.mobile
                                                    .showLanguageSwitcher)}
                                    >
                                        <div
                                            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {headerConfig
                                                .mobile.showLanguageSwitcher
                                                ? 'translate-x-5'
                                                : ''}"
                                        ></div>
                                    </button>
                                </div>

                                <div
                                    class="menu-items-section mt-6 border-t border-slate-200 pt-4"
                                >
                                    <h4
                                        class="depth-4-label mb-3 flex items-center gap-2"
                                    >
                                        <Layout
                                            size={14}
                                            class="text-slate-400"
                                        />
                                        <!-- {`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.nav_menu")}`} -->
                                        {`${t("admin.theme.nav_menu")}`}
                                    </h4>
                                    <div class="flex flex-col gap-3">
                                        {#each headerConfig.mobile.menuItems as item, i (item.id)}
                                            <div
                                                class="p-3 bg-white rounded-lg border border-slate-200"
                                            >
                                                <div
                                                    class="flex gap-2 items-center mb-3"
                                                >
                                                    <div class="flex-1">
                                                        <label
                                                            class="text-[9px] text-slate-400 mb-0.5 block"
                                                            >{t(
                                                                "admin.theme.menu_label",
                                                            )}</label
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                item.label[
                                                                    activeLang
                                                                ]
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div class="flex-1">
                                                        <label
                                                            class="text-[9px] text-slate-400 mb-0.5 block"
                                                            >{t(
                                                                "admin.theme.menu_path",
                                                            )}</label
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                item.url
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                </div>
                                                <div
                                                    class="flex justify-between items-center mt-2"
                                                >
                                                    <div class="flex gap-1">
                                                        {#each ["link", "category_drawer"] as type}
                                                            <button
                                                                type="button"
                                                                class="px-2 py-1 text-[10px] border rounded {item.type ===
                                                                type
                                                                    ? 'bg-slate-200 border-slate-300 font-semibold'
                                                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}"
                                                                onclick={() =>
                                                                    (item.type =
                                                                        type)}
                                                            >
                                                                {type === "link"
                                                                    ? t(
                                                                          "admin.theme.menu_type_link",
                                                                      )
                                                                    : t(
                                                                          "admin.theme.menu_category",
                                                                      )}
                                                            </button>
                                                        {/each}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        class="text-red-500 text-xs hover:underline"
                                                        onclick={() =>
                                                            (headerConfig.mobile.menuItems =
                                                                headerConfig.mobile.menuItems.filter(
                                                                    (_, idx) =>
                                                                        idx !==
                                                                        i,
                                                                ))}
                                                    >
                                                        {t(
                                                            "admin.common.delete",
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        {/each}
                                        <button
                                            type="button"
                                            class="w-full py-2 bg-white hover:bg-slate-50 border border-dashed border-slate-300 text-slate-500 text-xs rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all"
                                            onclick={() =>
                                                (headerConfig.mobile.menuItems =
                                                    [
                                                        ...headerConfig.mobile
                                                            .menuItems,
                                                        {
                                                            id: Date.now(),
                                                            type: "link",
                                                            label: {
                                                                ko: "새 메뉴",
                                                                en: "New Link",
                                                            },
                                                            url: "",
                                                            icon: "Link",
                                                        },
                                                    ])}
                                        >
                                            + {t("admin.theme.add_link")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AccordionItem>

                        <!-- 4. 모바일 푸터 설정 -->
                        <AccordionItem
                            // title={`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.footer_settings")}`}
                            title={`${t("admin.theme.footer_settings")}`}
                            icon={LayoutTemplate}
                        >
                            <div
                                class="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.footer_copyright")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            footerConfig.mobile.copyright[
                                                activeLang
                                            ]
                                        }
                                        placeholder="© 2026 Blog. All rights reserved."
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.footer_text_color")}
                                    </label>
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="color"
                                            bind:value={
                                                footerConfig.mobile.text.color
                                            }
                                            class="w-8 h-8 p-0 border-0 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            bind:value={
                                                footerConfig.mobile.text.color
                                            }
                                            class="flex-1 text-[11px] p-1.5 border rounded bg-white"
                                        />
                                    </div>
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.font_size")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            footerConfig.mobile.text.fontSize
                                        }
                                        placeholder="0.8rem"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.footer_link_color")}
                                    </label>
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="color"
                                            bind:value={
                                                footerConfig.mobile.navColor
                                            }
                                            class="w-8 h-8 p-0 border-0 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            bind:value={
                                                footerConfig.mobile.navColor
                                            }
                                            class="flex-1 text-[11px] p-1.5 border rounded bg-white"
                                        />
                                    </div>
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.footer_link_font_size")}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            footerConfig.mobile.navFontSize
                                        }
                                        placeholder="0.8rem"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div class="form-group-mini mb-4">
                                    <label
                                        class="depth-4-label text-slate-700 font-semibold mb-2 block"
                                    >
                                        {t("admin.theme.box_shadow") ||
                                            "그림자"}
                                    </label>
                                    <input
                                        type="text"
                                        bind:value={
                                            footerConfig.mobile.boxShadow
                                        }
                                        placeholder="none"
                                        class="text-xs p-1.5 border rounded w-full bg-white"
                                    />
                                </div>

                                <div
                                    class="menu-items-section mt-6 border-t border-slate-200 pt-4"
                                >
                                    <h4
                                        class="depth-4-label mb-3 flex items-center gap-2"
                                    >
                                        <LayoutTemplate
                                            size={14}
                                            class="text-slate-400"
                                        />
                                        <!-- {`${t("admin.theme.widget_device_mobile")} ${t("admin.theme.add_footer_link")}`} -->
                                        {`${t("admin.theme.add_footer_link")}`}
                                    </h4>
                                    <div class="flex flex-col gap-3">
                                        {#each footerConfig.mobile.navLinks as link, i (link.id || i)}
                                            <div
                                                class="p-3 bg-white rounded-lg border border-slate-200"
                                            >
                                                <div
                                                    class="flex gap-2 items-center mb-3"
                                                >
                                                    <div class="flex-1">
                                                        <label
                                                            class="text-[9px] text-slate-400 mb-0.5 block"
                                                            >{t(
                                                                "admin.theme.menu_label",
                                                            )}</label
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                link.label[
                                                                    activeLang
                                                                ]
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                    <div class="flex-1">
                                                        <label
                                                            class="text-[9px] text-slate-400 mb-0.5 block"
                                                            >{t(
                                                                "admin.theme.menu_path",
                                                            )}</label
                                                        >
                                                        <input
                                                            type="text"
                                                            bind:value={
                                                                link.url
                                                            }
                                                            class="text-xs p-1 border rounded w-full"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    class="text-red-500 text-xs hover:underline mt-2 self-end"
                                                    onclick={() =>
                                                        (footerConfig.mobile.navLinks =
                                                            footerConfig.mobile.navLinks.filter(
                                                                (_, idx) =>
                                                                    idx !== i,
                                                            ))}
                                                >
                                                    {t("admin.common.delete")}
                                                </button>
                                            </div>
                                        {/each}
                                        <button
                                            type="button"
                                            class="w-full py-2 bg-white hover:bg-slate-50 border border-dashed border-slate-300 text-slate-500 text-xs rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all"
                                            onclick={() =>
                                                (footerConfig.mobile.navLinks =
                                                    [
                                                        ...footerConfig.mobile
                                                            .navLinks,
                                                        {
                                                            id: Date.now(),
                                                            label: {
                                                                ko: "새 링크",
                                                                en: "New Link",
                                                            },
                                                            url: "",
                                                        },
                                                    ])}
                                        >
                                            + {t(
                                                "admin.theme.add_footer_link",
                                            ) || "새 링크 추가"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AccordionItem>
                    {/if}
                {:else if activeTab === "widgets"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.widgets_management", {
                            default: "위젯 관리",
                        })}
                    </h2>
                    <AccordionItem
                        title={t("admin.theme.global_widget_design") ||
                            t("admin.theme.global_widget_design", {
                                default: "글로벌 위젯 디자인",
                            })}
                        icon={Box}
                    >
                        <div
                            class="widget-padding-settings mb-4 p-4 bg-white rounded-xl border border-slate-200"
                        >
                            <div class="form-group-mini">
                                <label
                                    for="widget-padding"
                                    class="depth-3-label"
                                    >{t("admin.theme.widget_padding")}</label
                                >
                                <input
                                    id="widget-padding"
                                    type="text"
                                    bind:value={
                                        themeConfig.widgetItemStyle.padding
                                    }
                                    class="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 mt-1"
                                    placeholder="1.5rem"
                                />
                            </div>
                        </div>

                        <div
                            class="shadow-global-settings mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"
                        >
                            <div class="flex items-center justify-between">
                                <div
                                    class="flex items-center gap-3 p-2 bg-slate-100 rounded-lg border border-slate-200 shadow-inner"
                                >
                                    <span class="depth-4-label"
                                        >{t("admin.theme.global_shadow")}</span
                                    >
                                    <label
                                        class="relative inline-flex items-center cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={
                                                widgetShadowGlobal.enabled
                                            }
                                            class="sr-only peer"
                                        />
                                        <div
                                            class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                                        ></div>
                                    </label>
                                </div>
                            </div>

                            {#if widgetShadowGlobal.enabled}
                                <div
                                    class="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col gap-6"
                                >
                                    <ShadowControl
                                        bind:value={widgetShadowGlobal.normal}
                                        label={t(
                                            "admin.theme.global_normal_shadow",
                                        )}
                                    />
                                    <ShadowControl
                                        bind:value={widgetShadowGlobal.hover}
                                        label={t(
                                            "admin.theme.global_hover_shadow",
                                        )}
                                    />
                                    <div>
                                        <div
                                            class="flex items-center gap-3 mt-1 p-3 bg-white rounded-lg border border-slate-200"
                                        >
                                            <label
                                                class="depth-4-label whitespace-nowrap"
                                            >
                                                {t(
                                                    "admin.theme.hover_translate_y",
                                                    {
                                                        default:
                                                            "Hover 이동(Y)",
                                                    },
                                                )}
                                            </label>
                                            <input
                                                type="number"
                                                bind:value={
                                                    widgetShadowGlobal.hoverTranslateY
                                                }
                                                class="w-20 text-center text-sm border border-slate-200 rounded px-2 py-1"
                                                step="1"
                                            />
                                        </div>
                                        <p
                                            class="depth-4-hint mt-1 text-center"
                                        >
                                            {t(
                                                "admin.theme.hover_translate_y_hint",
                                                {
                                                    default:
                                                        "px (0 = 이동 없음, 음수 = 위로)",
                                                },
                                            )}
                                        </p>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={t("admin.theme.widget_text_style") ||
                            t("admin.theme.widget_text_style", {
                                default: "글로벌 위젯 텍스트 스타일",
                            })}
                        icon={Type}
                    >
                        <p class="depth-4-hint">
                            {t("admin.theme.widget_text_style_desc") ||
                                t("admin.theme.widget_text_style_desc", {
                                    default:
                                        "모든 위젯의 제목 및 내부 내용(항목)에 공통으로 적용할 텍스트 스타일을 각각 구성합니다.",
                                })}
                        </p>

                        <!-- Section 1: 글로벌 위젯 제목 스타일 -->
                        <div
                            class="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                        >
                            <h4
                                class="font-bold text-slate-800 text-sm border-b pb-2 mb-3"
                            >
                                {t("admin.theme.widget_title_style_sub") ||
                                    t("admin.theme.widget_title_style_sub", {
                                        default: "글로벌 위젯 제목 스타일",
                                    })}
                            </h4>

                            <div class="form-group-mini">
                                <label
                                    for="widget-title-font-family"
                                    class="depth-3-label"
                                    >{t("admin.theme.font_family_label")}</label
                                >
                                <input
                                    id="widget-title-font-family"
                                    type="text"
                                    bind:value={
                                        themeConfig.widgetTitleStyle.fontFamily
                                    }
                                    placeholder="Inter, Pretendard..."
                                />
                                <p class="depth-4-hint">
                                    {t("admin.theme.widget_font_family_hint") ||
                                        t(
                                            "admin.theme.widget_font_family_hint",
                                            {
                                                default:
                                                    "비워두면 글로벌 폰트를 상속받습니다.",
                                            },
                                        )}
                                </p>
                            </div>

                            <div class="grid grid-cols-2 gap-3 mt-3">
                                <div class="form-group-mini">
                                    <label
                                        for="widget-title-font-size"
                                        class="depth-3-label"
                                        >{t("admin.theme.font_size")}</label
                                    >
                                    <input
                                        id="widget-title-font-size"
                                        type="text"
                                        bind:value={
                                            themeConfig.widgetTitleStyle
                                                .fontSize
                                        }
                                        placeholder="1.1rem"
                                    />
                                </div>
                                <div class="form-group-mini">
                                    <label
                                        for="widget-title-font-weight"
                                        class="depth-3-label"
                                        >{t("admin.theme.font_weight")}</label
                                    >
                                    <select
                                        id="widget-title-font-weight"
                                        bind:value={
                                            themeConfig.widgetTitleStyle
                                                .fontWeight
                                        }
                                        class="text-sm p-1.5 border rounded"
                                    >
                                        <option value="400">Normal (400)</option
                                        >
                                        <option value="500">Medium (500)</option
                                        >
                                        <option value="600"
                                            >Semi-Bold (600)</option
                                        >
                                        <option value="700">Bold (700)</option>
                                        <option value="800"
                                            >Extra-Bold (800)</option
                                        >
                                    </select>
                                </div>
                            </div>

                            <div class="form-group-mini mt-3">
                                <ColorControl
                                    label={t("admin.theme.text_color")}
                                    bind:value={
                                        themeConfig.widgetTitleStyle.color
                                    }
                                />
                            </div>
                        </div>

                        <!-- Section 2: 글로벌 위젯 항목 스타일 -->
                        <div
                            class="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                        >
                            <h4
                                class="font-bold text-slate-800 text-sm border-b pb-2 mb-3"
                            >
                                {t("admin.theme.widget_item_style_sub") ||
                                    t("admin.theme.widget_item_style_sub", {
                                        default: "글로벌 위젯 항목 스타일",
                                    })}
                            </h4>

                            <div class="form-group-mini">
                                <label
                                    for="widget-font-family"
                                    class="depth-3-label"
                                    >{t("admin.theme.font_family_label")}</label
                                >
                                <input
                                    id="widget-font-family"
                                    type="text"
                                    bind:value={
                                        themeConfig.widgetItemStyle.fontFamily
                                    }
                                    placeholder="Inter, Pretendard..."
                                />
                                <p class="depth-4-hint">
                                    {t("admin.theme.widget_font_family_hint") ||
                                        t(
                                            "admin.theme.widget_font_family_hint",
                                            {
                                                default:
                                                    "비워두면 글로벌 폰트를 상속받습니다.",
                                            },
                                        )}
                                </p>
                            </div>

                            <div class="grid grid-cols-2 gap-3 mt-3">
                                <div class="form-group-mini">
                                    <label
                                        for="widget-font-size"
                                        class="depth-3-label"
                                        >{t("admin.theme.font_size")}</label
                                    >
                                    <input
                                        id="widget-font-size"
                                        type="text"
                                        bind:value={
                                            themeConfig.widgetItemStyle.fontSize
                                        }
                                        placeholder="0.95rem"
                                    />
                                </div>
                                <div class="form-group-mini">
                                    <label
                                        for="widget-font-weight"
                                        class="depth-3-label"
                                        >{t("admin.theme.font_weight")}</label
                                    >
                                    <select
                                        id="widget-font-weight"
                                        bind:value={
                                            themeConfig.widgetItemStyle
                                                .fontWeight
                                        }
                                        class="text-sm p-1.5 border rounded"
                                    >
                                        <option value="400">Normal (400)</option
                                        >
                                        <option value="500">Medium (500)</option
                                        >
                                        <option value="600"
                                            >Semi-Bold (600)</option
                                        >
                                        <option value="700">Bold (700)</option>
                                        <option value="800"
                                            >Extra-Bold (800)</option
                                        >
                                    </select>
                                </div>
                            </div>

                            <div class="form-group-mini mt-3">
                                <ColorControl
                                    label={t("admin.theme.text_color")}
                                    bind:value={
                                        themeConfig.widgetItemStyle.color
                                    }
                                />
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem
                        title={t("admin.theme.widget_list_edit") ||
                            t("admin.theme.widget_list_edit", {
                                default: "등록된 위젯 목록 및 편집",
                            })}
                        icon={Database}
                    >
                        <div class="master-widgets-list">
                            {#each availableWidgets as widget}
                                <div
                                    class="master-widget-item"
                                    class:is-editing={editingWidgetId ===
                                        widget.id}
                                >
                                    {#if editingWidgetId === widget.id}
                                        <div class="widget-edit-form">
                                            <div class="form-group-mini">
                                                <label class="depth-3-label"
                                                    >{t(
                                                        "admin.theme.widget_name_label",
                                                    )}</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={editWidgetName}
                                                    placeholder={t(
                                                        "admin.theme.widget_name_placeholder",
                                                    )}
                                                />
                                            </div>
                                            <div class="form-group-mini">
                                                <label class="depth-3-label"
                                                    >{t(
                                                        "admin.theme.widget_type_label",
                                                    )}</label
                                                >
                                                <select
                                                    bind:value={editWidgetType}
                                                >
                                                    <option value="RecentPosts"
                                                        >{t(
                                                            "admin.theme.widget_type_recent",
                                                        )}</option
                                                    >
                                                    <option value="CategoryMenu"
                                                        >{t(
                                                            "admin.theme.widget_type_category",
                                                        )}</option
                                                    >
                                                    <option value="PopularPosts"
                                                        >{t(
                                                            "admin.theme.widget_type_popular",
                                                        )}</option
                                                    >
                                                    <option value="TagCloud"
                                                        >{t(
                                                            "admin.theme.widget_type_tagcloud",
                                                        )}</option
                                                    >
                                                    <option
                                                        value="RecentComments"
                                                        >{t(
                                                            "admin.theme.widget_type_recent_comments",
                                                        )}</option
                                                    >
                                                    <option
                                                        value="RecentGuestbooks"
                                                        >{t(
                                                            "admin.theme.widget_type_recent_guestbooks",
                                                        )}</option
                                                    >
                                                    <option value="PostContent"
                                                        >{t(
                                                            "admin.theme.widget_type_postcontent",
                                                        )}</option
                                                    >
                                                    <option value="HtmlWidget"
                                                        >{t(
                                                            "admin.theme.widget_type_html",
                                                        )}</option
                                                    >
                                                    <option
                                                        value="category_link"
                                                        >{t(
                                                            "admin.theme.widget_type_catlink",
                                                        )}</option
                                                    >
                                                </select>
                                            </div>
                                            {#if editWidgetType === "category_link"}
                                                <div class="form-group-mini">
                                                    <label class="depth-3-label"
                                                        >{t(
                                                            "admin.theme.widget_slug_label",
                                                        )}</label
                                                    >
                                                    <input
                                                        type="text"
                                                        bind:value={
                                                            widgetEditMemory.category_link
                                                        }
                                                        placeholder={t(
                                                            "admin.theme.widget_slug_placeholder",
                                                        )}
                                                    />
                                                </div>
                                            {:else if editWidgetType === "HtmlWidget"}
                                                <div class="form-group-mini">
                                                    <label
                                                        >{t(
                                                            "admin.theme.widget_html_label",
                                                        )}</label
                                                    >
                                                    <textarea
                                                        bind:value={
                                                            widgetEditMemory.HtmlWidget
                                                        }
                                                        placeholder={t(
                                                            "admin.theme.widget_html_placeholder",
                                                        )}
                                                        class="w-full h-14 p-2 border border-slate-200 rounded depth-4-hint font-mono bg-white"
                                                    ></textarea>
                                                </div>
                                                <div
                                                    class="form-group-mini mt-2"
                                                >
                                                    <label
                                                        class="flex items-center gap-2 cursor-pointer select-none"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            bind:checked={
                                                                editWidgetUseShadowDom
                                                            }
                                                            class="rounded border-slate-300 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span
                                                            class="text-sm font-semibold text-slate-700"
                                                        >
                                                            {t(
                                                                "admin.theme.widget_use_shadow_dom",
                                                                {
                                                                    default:
                                                                        "스타일 격리(Shadow DOM) 사용",
                                                                },
                                                            )}
                                                        </span>
                                                    </label>
                                                </div>
                                            {/if}
                                            {#if ["RecentPosts", "PopularPosts", "RecentComments", "RecentGuestbooks"].includes(editWidgetType)}
                                                <div class="form-group-mini">
                                                    <label class="depth-3-label"
                                                        >{t(
                                                            "admin.theme.widget_limit_label",
                                                            {
                                                                default:
                                                                    "표기 개수 (1~10)",
                                                            },
                                                        )}</label
                                                    >
                                                    <input
                                                        type="number"
                                                        bind:value={
                                                            editWidgetLimit
                                                        }
                                                        min="1"
                                                        max="10"
                                                    />
                                                </div>
                                            {/if}

                                            <div
                                                class="form-group-mini border-t border-slate-200 pt-3 mt-3"
                                            >
                                                <div
                                                    class="flex items-center justify-between mb-2"
                                                >
                                                    <span class="depth-4-label"
                                                        >{t(
                                                            "admin.theme.inherit_global_shadow",
                                                        )}</span
                                                    >
                                                    <label
                                                        class="relative inline-flex items-center cursor-pointer scale-75 origin-right"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            bind:checked={
                                                                editWidgetShadow.useGlobal
                                                            }
                                                            class="sr-only peer"
                                                        />
                                                        <div
                                                            class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"
                                                        ></div>
                                                    </label>
                                                </div>
                                                {#if !editWidgetShadow.useGlobal}
                                                    <div
                                                        class="grid grid-cols-2 gap-2 mt-2"
                                                    >
                                                        <ShadowControl
                                                            bind:value={
                                                                editWidgetShadow.normal
                                                            }
                                                            label={t(
                                                                "admin.theme.widget_normal_shadow",
                                                            )}
                                                        />
                                                        <ShadowControl
                                                            bind:value={
                                                                editWidgetShadow.hover
                                                            }
                                                            label={t(
                                                                "admin.theme.widget_hover_shadow",
                                                            )}
                                                        />
                                                        <div class="col-span-2">
                                                            <div
                                                                class="flex items-center gap-3 p-2 bg-white rounded border border-slate-200"
                                                            >
                                                                <label
                                                                    class="depth-4-label whitespace-nowrap"
                                                                >
                                                                    {t(
                                                                        "admin.theme.hover_translate_y",
                                                                        {
                                                                            default:
                                                                                "Hover 이동(Y)",
                                                                        },
                                                                    )}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    bind:value={
                                                                        editWidgetShadow.hoverTranslateY
                                                                    }
                                                                    class="w-16 text-center text-xs border border-slate-200 rounded px-1 py-0.5"
                                                                    step="1"
                                                                />
                                                                <span
                                                                    class="depth-4-hint"
                                                                    >px</span
                                                                >
                                                            </div>
                                                        </div>
                                                    </div>
                                                {/if}
                                            </div>

                                            <div class="edit-actions">
                                                <button
                                                    class="btn-save-mini"
                                                    onclick={() =>
                                                        handleUpdateWidget(
                                                            widget,
                                                        )}
                                                    >{t(
                                                        "admin.common.save",
                                                    )}</button
                                                >
                                                <button
                                                    class="btn-cancel-mini"
                                                    onclick={() =>
                                                        (editingWidgetId =
                                                            null)}
                                                    >{t(
                                                        "admin.common.cancel",
                                                    )}</button
                                                >
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="widget-info">
                                            <span class="w-name"
                                                >{widget.name}</span
                                            >
                                            <span class="w-type">
                                                {t(
                                                    "admin.theme.widget_type_display",
                                                    { type: widget.type },
                                                )}
                                                {#if widget.type === "category_link" && getCategorySlug(widget.config)}
                                                    ({getCategorySlug(
                                                        widget.config,
                                                    )})
                                                {/if}
                                            </span>
                                        </div>
                                        <div class="widget-actions">
                                            <button
                                                class="icon-btn"
                                                onclick={() =>
                                                    startEditWidget(widget)}
                                                ><FileText size={14} /></button
                                            >
                                            <button
                                                class="icon-btn delete"
                                                onclick={() =>
                                                    handleDeleteWidget(
                                                        widget.id,
                                                    )}
                                                ><Trash2 size={14} /></button
                                            >
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </AccordionItem>
                    <AccordionItem
                        title={t("admin.theme.widget_new", {
                            default: "새 위젯 생성",
                        })}
                        icon={PlusSquare}
                    >
                        <p class="hint depth-4-hint">
                            {t("admin.theme.widget_new_hint")}
                        </p>
                        <form
                            class="widget-form"
                            onsubmit={(e) => {
                                e.preventDefault();
                                handleCreateWidget();
                            }}
                        >
                            <div class="form-group">
                                <label for="widget-name"
                                    >{t("admin.theme.widget_name_label")}</label
                                >
                                <input
                                    id="widget-name"
                                    type="text"
                                    bind:value={newWidgetName}
                                    placeholder={t(
                                        "admin.theme.widget_name_placeholder",
                                    )}
                                />
                            </div>
                            <div class="form-group">
                                <label for="widget-type"
                                    >{t("admin.theme.widget_type_label")}</label
                                >
                                <select
                                    id="widget-type"
                                    bind:value={newWidgetType}
                                >
                                    <option value="RecentPosts"
                                        >{t(
                                            "admin.theme.widget_type_recent",
                                        )}</option
                                    >
                                    <option value="CategoryMenu"
                                        >{t(
                                            "admin.theme.widget_type_category",
                                        )}</option
                                    >
                                    <option value="PopularPosts"
                                        >{t(
                                            "admin.theme.widget_type_popular",
                                        )}</option
                                    >
                                    <option value="TagCloud"
                                        >{t(
                                            "admin.theme.widget_type_tagcloud",
                                        )}</option
                                    >
                                    <option value="RecentComments"
                                        >{t(
                                            "admin.theme.widget_type_recent_comments",
                                        )}</option
                                    >
                                    <option value="RecentGuestbooks"
                                        >{t(
                                            "admin.theme.widget_type_recent_guestbooks",
                                        )}</option
                                    >
                                    <option value="PostContent"
                                        >{t(
                                            "admin.theme.widget_type_postcontent",
                                        )}</option
                                    >
                                    <option value="HtmlWidget"
                                        >{t(
                                            "admin.theme.widget_type_html",
                                        )}</option
                                    >
                                    <option value="category_link"
                                        >{t(
                                            "admin.theme.widget_type_catlink",
                                        )}</option
                                    >
                                </select>
                            </div>
                            {#if newWidgetType === "category_link"}
                                <div class="form-group">
                                    <label for="widget-slug"
                                        >{t(
                                            "admin.theme.widget_slug_label",
                                        )}</label
                                    >
                                    <input
                                        id="widget-slug"
                                        type="text"
                                        bind:value={
                                            widgetCreateMemory.category_link
                                        }
                                        placeholder={t(
                                            "admin.theme.widget_slug_placeholder2",
                                        )}
                                    />
                                </div>
                            {:else if newWidgetType === "HtmlWidget"}
                                <div class="form-group">
                                    <label for="widget-html"
                                        >{t(
                                            "admin.theme.widget_html_label",
                                        )}</label
                                    >
                                    <textarea
                                        id="widget-html"
                                        bind:value={
                                            widgetCreateMemory.HtmlWidget
                                        }
                                        placeholder={t(
                                            "admin.theme.widget_html_placeholder",
                                        )}
                                        class="h-24 font-mono"
                                    ></textarea>
                                </div>
                            {/if}
                            {#if ["RecentPosts", "PopularPosts", "RecentComments", "RecentGuestbooks"].includes(newWidgetType)}
                                <div class="form-group">
                                    <label for="widget-limit"
                                        >{t("admin.theme.widget_limit_label", {
                                            default: "표기 개수 (1~10)",
                                        })}</label
                                    >
                                    <input
                                        id="widget-limit"
                                        type="number"
                                        bind:value={newWidgetLimit}
                                        min="1"
                                        max="10"
                                    />
                                </div>
                            {/if}

                            <div
                                class="form-group border-t border-slate-200 pt-4 mt-2"
                            >
                                <div
                                    class="flex items-center justify-between mb-2"
                                >
                                    <span
                                        class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                                        >{t(
                                            "admin.theme.inherit_global_shadow",
                                        )}</span
                                    >
                                    <label
                                        class="relative inline-flex items-center cursor-pointer scale-90 origin-right"
                                    >
                                        <input
                                            type="checkbox"
                                            bind:checked={
                                                newWidgetShadow.useGlobal
                                            }
                                            class="sr-only peer"
                                        />
                                        <div
                                            class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"
                                        ></div>
                                    </label>
                                </div>
                                {#if !newWidgetShadow.useGlobal}
                                    <div class="grid grid-cols-2 gap-3 mt-3">
                                        <ShadowControl
                                            bind:value={newWidgetShadow.normal}
                                            label={t(
                                                "admin.theme.widget_normal_shadow",
                                            )}
                                        />
                                        <ShadowControl
                                            bind:value={newWidgetShadow.hover}
                                            label={t(
                                                "admin.theme.widget_hover_shadow",
                                            )}
                                        />
                                        <div class="col-span-2">
                                            <div
                                                class="flex items-center gap-3 p-2 bg-white rounded border border-slate-200"
                                            >
                                                <label
                                                    class="depth-4-label whitespace-nowrap"
                                                >
                                                    {t(
                                                        "admin.theme.hover_translate_y",
                                                        {
                                                            default:
                                                                "Hover 이동(Y)",
                                                        },
                                                    )}
                                                </label>
                                                <input
                                                    type="number"
                                                    bind:value={
                                                        newWidgetShadow.hoverTranslateY
                                                    }
                                                    class="w-16 text-center text-xs border border-slate-200 rounded px-1 py-0.5"
                                                    step="1"
                                                />
                                                <span
                                                    class="text-[0.65rem] text-slate-400 font-bold"
                                                    >px</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>

                            <button
                                type="submit"
                                class="btn-secondary"
                                disabled={!newWidgetName || !newWidgetType}
                            >
                                <Plus size={16} />
                                {t("admin.theme.widget_create_btn")}
                            </button>
                        </form>
                    </AccordionItem>
                {:else if activeTab === "config"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.tab_config", { default: "고급 설정" })}
                    </h2>

                    <!-- Full Design Backup Section -->
                    <AccordionItem
                        title={t("admin.theme.backup_restore_title") ||
                            t("admin.theme.backup_restore_title", {
                                default: "전체 디자인 데이터 백업 및 복원",
                            })}
                        icon={Settings}
                    >
                        <div class="settings-form mb-8">
                            <div class="form-header">
                                <h3 class="depth-2-subtitle">
                                    {t("admin.theme.backup_restore_title")}
                                </h3>
                                <p class="depth-4-hint">
                                    {t("admin.theme.backup_restore_desc")}<br
                                    /><strong class="text-slate-500"
                                        >{t(
                                            "admin.theme.backup_restore_warning",
                                        )}</strong
                                    >
                                </p>
                            </div>

                            <div class="setting-group">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <label class="depth-3-label"
                                            >{t(
                                                "admin.theme.export_all",
                                            )}</label
                                        >
                                        <span class="depth-4-hint"
                                            >{t(
                                                "admin.theme.export_all_hint",
                                            )}</span
                                        >
                                    </div>
                                    <div
                                        class="setting-control flex items-center justify-start w-full"
                                    >
                                        <a
                                            href="/api/backup?section=design"
                                            download={designBackupFileName}
                                            class="btn-primary flex items-center justify-center gap-2"
                                            style="height: 38px; min-width: 160px; padding: 0 1rem; background-color: #4f46e5;"
                                        >
                                            <Download size={16} />
                                            {t(
                                                "admin.backup.full_download_btn",
                                            )}
                                        </a>
                                    </div>
                                </div>

                                <div class="setting-row">
                                    <div class="setting-info">
                                        <label
                                            class="depth-3-label text-orange-600"
                                            >{t(
                                                "admin.theme.restore_all",
                                            )}</label
                                        >
                                        <span class="depth-4-hint"
                                            ><p>
                                                {t(
                                                    "admin.theme.restore_all_hint",
                                                )}
                                            </p></span
                                        >
                                    </div>
                                    <div
                                        class="setting-control flex flex-col gap-3"
                                    >
                                        <label for="restore-full" class="hidden"
                                            >{t(
                                                "admin.theme.restore_full_label",
                                            )}</label
                                        >
                                        <div
                                            class="flex items-center gap-2 w-full"
                                        >
                                            <button
                                                type="button"
                                                class="btn-action-mini btn-mini flex-none"
                                                style="height: 38px; min-width: 100px; padding: 0 0.75rem;"
                                                onclick={() =>
                                                    document
                                                        .getElementById(
                                                            "restore-full",
                                                        )
                                                        ?.click()}
                                            >
                                                <Upload size={16} />
                                                {t("admin.theme.browse")}
                                            </button>
                                            <div
                                                class="flex-1 text-sm text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap bg-slate-50 px-3 py-2 border rounded border-slate-200 flex items-center"
                                                style="height: 38px;"
                                            >
                                                {fullBackupFileName ||
                                                    t(
                                                        "admin.theme.no_file_selected",
                                                    )}
                                            </div>
                                        </div>
                                        <input
                                            id="restore-full"
                                            type="file"
                                            accept=".json"
                                            class="hidden"
                                            onchange={async (e) => {
                                                const file =
                                                    e.currentTarget.files?.[0];
                                                if (!file) {
                                                    fullBackupFileName = "";
                                                    return;
                                                }
                                                fullBackupFileName = file.name;
                                                if (
                                                    !confirm(
                                                        t(
                                                            "admin.theme.confirm_restore_all",
                                                        ),
                                                    )
                                                )
                                                    return;

                                                const text = await file.text();
                                                const data = JSON.parse(text);
                                                const res = await fetch(
                                                    "/api/restore",
                                                    {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type":
                                                                "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            data,
                                                            backupType:
                                                                "design",
                                                        }),
                                                    },
                                                );
                                                if (res.ok) {
                                                    alert(
                                                        t(
                                                            "admin.theme.restore_success",
                                                        ),
                                                    );
                                                    window.location.reload();
                                                } else {
                                                    alert(
                                                        t(
                                                            "admin.theme.restore_fail",
                                                        ) +
                                                            (await res.json())
                                                                .error,
                                                    );
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div></AccordionItem
                    >

                    <!-- 디자인 공유 설정 -->
                    <AccordionItem
                        title={t("admin.theme.share_design_title", {
                            default: "디자인 공유 설정",
                        })}
                        icon={Globe}
                    >
                        <div class="settings-form mb-8">
                            <div class="form-header">
                                <h3 class="depth-2-subtitle">
                                    {t("admin.theme.share_design_title", {
                                        default: "디자인 공유 설정",
                                    })}
                                </h3>
                                <p class="depth-4-hint">
                                    {t("admin.theme.share_design_desc", {
                                        default:
                                            "이 옵션을 활성화하면 블로그 푸터 영역에 '디자인 설정파일 공유' 링크가 표시됩니다. 방문자가 이를 통해 개인정보가 제외된 디자인 JSON 설정 파일을 내려받을 수 있습니다.",
                                    })}
                                </p>
                            </div>

                            <div class="setting-group">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <label class="depth-3-label">
                                            {t(
                                                "admin.theme.share_design_enable",
                                                {
                                                    default:
                                                        "디자인 공유 활성화",
                                                },
                                            )}
                                        </label>
                                        <span class="depth-4-hint">
                                            {t(
                                                "admin.theme.share_design_enable_hint",
                                                {
                                                    default:
                                                        "블로그 푸터의 RSS 옆에 공유 링크를 생성합니다.",
                                                },
                                            )}
                                        </span>
                                    </div>
                                    <div class="setting-control flex-none">
                                        <label
                                            class="relative inline-flex items-center cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                bind:checked={
                                                    footerConfig.shareDesign
                                                }
                                                class="sr-only peer"
                                            />
                                            <div
                                                class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"
                                            ></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div></AccordionItem
                    >
                {:else if activeTab === "background"}
                    <h2 class="depth-1-title">
                        {t("admin.theme.tab_background", {
                            default: "배경 설정",
                        })}
                    </h2>

                    <!-- 영역 선택 탭 -->
                    <div
                        class="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg w-fit border border-slate-200"
                    >
                        <button
                            class="px-5 py-2 rounded-md transition-all text-sm font-medium {jsEditArea ===
                            'header'
                                ? 'bg-white shadow-sm text-blue-600'
                                : 'text-slate-500 hover:bg-slate-200'}"
                            onclick={() => (jsEditArea = "header")}
                        >
                            {t("admin.theme.bg_area_header")}
                        </button>
                        <button
                            class="px-5 py-2 rounded-md transition-all text-sm font-medium {jsEditArea ===
                            'main'
                                ? 'bg-white shadow-sm text-blue-600'
                                : 'text-slate-500 hover:bg-slate-200'}"
                            onclick={() => (jsEditArea = "main")}
                        >
                            {t("admin.theme.bg_area_body")}
                        </button>
                        <button
                            class="px-5 py-2 rounded-md transition-all text-sm font-medium {jsEditArea ===
                            'footer'
                                ? 'bg-white shadow-sm text-blue-600'
                                : 'text-slate-500 hover:bg-slate-200'}"
                            onclick={() => (jsEditArea = "footer")}
                        >
                            {t("admin.theme.bg_area_footer")}
                        </button>
                    </div>

                    <AccordionItem
                        title={t("admin.theme.tab_background", {
                            default: "배경 설정",
                        })}
                        icon={Palette}
                    >
                        {#if previewMode === "mobile"}
                            <div
                                class="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-2 flex items-center justify-between"
                            >
                                <span
                                    class="text-xs font-semibold text-slate-700"
                                >
                                    {t("admin.theme.bg_mobile_different", {
                                        default:
                                            "모바일 기기에서 데스크톱과 다른 배경 설정 사용",
                                    })}
                                </span>
                                <label
                                    class="relative inline-flex items-center cursor-pointer scale-75 origin-right"
                                >
                                    {#if jsEditArea === "header"}
                                        <input
                                            type="checkbox"
                                            checked={!!headerConfig
                                                .headerBackground.mobile}
                                            onchange={(e) => {
                                                if (e.currentTarget.checked) {
                                                    headerConfig.headerBackground.mobile =
                                                        {
                                                            type: "solid",
                                                            value: "#ffffff",
                                                            opacity: 1,
                                                            blur: 0,
                                                            layerBlur: 0,
                                                            overlayColor:
                                                                "#000000",
                                                            overlayOpacity: 0,
                                                            jsCode: "",
                                                            inheritJs: true,
                                                        };
                                                } else {
                                                    delete headerConfig
                                                        .headerBackground
                                                        .mobile;
                                                }
                                            }}
                                            class="sr-only peer"
                                        />
                                    {:else if jsEditArea === "footer"}
                                        <input
                                            type="checkbox"
                                            checked={!!footerConfig
                                                .footerBackground.mobile}
                                            onchange={(e) => {
                                                if (e.currentTarget.checked) {
                                                    footerConfig.footerBackground.mobile =
                                                        {
                                                            type: "solid",
                                                            value: "#ffffff",
                                                            opacity: 1,
                                                            blur: 0,
                                                            layerBlur: 0,
                                                            overlayColor:
                                                                "#000000",
                                                            overlayOpacity: 0,
                                                            jsCode: "",
                                                            inheritJs: true,
                                                        };
                                                } else {
                                                    delete footerConfig
                                                        .footerBackground
                                                        .mobile;
                                                }
                                            }}
                                            class="sr-only peer"
                                        />
                                    {:else}
                                        <input
                                            type="checkbox"
                                            checked={!!themeConfig
                                                .bodyBackground.mobile}
                                            onchange={(e) => {
                                                if (e.currentTarget.checked) {
                                                    themeConfig.bodyBackground.mobile =
                                                        {
                                                            type: "solid",
                                                            value: "#ffffff",
                                                            opacity: 1,
                                                            blur: 0,
                                                            layerBlur: 0,
                                                            overlayColor:
                                                                "#000000",
                                                            overlayOpacity: 0,
                                                            jsCode: "",
                                                            inheritJs: true,
                                                        };
                                                } else {
                                                    delete themeConfig
                                                        .bodyBackground.mobile;
                                                }
                                            }}
                                            class="sr-only peer"
                                        />
                                    {/if}
                                    <div
                                        class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"
                                    ></div>
                                </label>
                            </div>
                        {/if}

                        <div class="p-4 flex flex-col gap-4">
                            {#if previewMode === "mobile"}
                                {#if jsEditArea === "header"}
                                    {#if headerConfig.headerBackground.mobile}
                                        <BackgroundControl
                                            title={t(
                                                "admin.theme.bg_mobile_title",
                                                {
                                                    default:
                                                        "모바일 전용 배경 설정",
                                                },
                                            )}
                                            bind:config={
                                                headerConfig.headerBackground
                                                    .mobile
                                            }
                                            bind:gradientState={
                                                headerMobileGradient
                                            }
                                            allowInherit={true}
                                            isMobileSection={true}
                                        />
                                    {:else}
                                        <div
                                            class="p-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500"
                                        >
                                            {t(
                                                "admin.theme.bg_mobile_inherit_desc",
                                                {
                                                    default:
                                                        "데스크톱 설정을 그대로 상속하여 사용 중입니다. 모바일 전용 배경을 개별적으로 적용하려면 위 스위치를 활성화해 주세요.",
                                                },
                                            )}
                                        </div>
                                    {/if}
                                {:else if jsEditArea === "footer"}
                                    {#if footerConfig.footerBackground.mobile}
                                        <BackgroundControl
                                            title={t(
                                                "admin.theme.bg_mobile_title",
                                                {
                                                    default:
                                                        "모바일 전용 배경 설정",
                                                },
                                            )}
                                            bind:config={
                                                footerConfig.footerBackground
                                                    .mobile
                                            }
                                            bind:gradientState={
                                                footerMobileGradient
                                            }
                                            allowInherit={true}
                                            isMobileSection={true}
                                        />
                                    {:else}
                                        <div
                                            class="p-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500"
                                        >
                                            {t(
                                                "admin.theme.bg_mobile_inherit_desc",
                                                {
                                                    default:
                                                        "데스크톱 설정을 그대로 상속하여 사용 중입니다. 모바일 전용 배경을 개별적으로 적용하려면 위 스위치를 활성화해 주세요.",
                                                },
                                            )}
                                        </div>
                                    {/if}
                                {:else if themeConfig.bodyBackground.mobile}
                                    <BackgroundControl
                                        title={t(
                                            "admin.theme.bg_mobile_title",
                                            {
                                                default:
                                                    "모바일 전용 배경 설정",
                                            },
                                        )}
                                        bind:config={
                                            themeConfig.bodyBackground.mobile
                                        }
                                        bind:gradientState={bodyMobileGradient}
                                        allowInherit={false}
                                        isMobileSection={true}
                                    />
                                {:else}
                                    <div
                                        class="p-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500"
                                    >
                                        {t(
                                            "admin.theme.bg_mobile_inherit_desc",
                                            {
                                                default:
                                                    "데스크톱 설정을 그대로 상속하여 사용 중입니다. 모바일 전용 배경을 개별적으로 적용하려면 위 스위치를 활성화해 주세요.",
                                            },
                                        )}
                                    </div>
                                {/if}
                            {:else if jsEditArea === "header"}
                                <BackgroundControl
                                    title=""
                                    bind:config={headerConfig.headerBackground}
                                    bind:gradientState={headerGradient}
                                    allowInherit={true}
                                />
                            {:else if jsEditArea === "footer"}
                                <BackgroundControl
                                    title=""
                                    bind:config={footerConfig.footerBackground}
                                    bind:gradientState={footerGradient}
                                    allowInherit={true}
                                />
                            {:else}
                                <BackgroundControl
                                    title=""
                                    bind:config={themeConfig.bodyBackground}
                                    bind:gradientState={bodyGradient}
                                    allowInherit={false}
                                />
                            {/if}

                            {#if (previewMode === "desktop" && ((jsEditArea === "header" && headerConfig.headerBackground.type === "js") || (jsEditArea === "main" && themeConfig.bodyBackground.type === "js") || (jsEditArea === "footer" && footerConfig.footerBackground.type === "js"))) || (previewMode === "mobile" && ((jsEditArea === "header" && headerConfig.headerBackground.mobile?.type === "js") || (jsEditArea === "main" && themeConfig.bodyBackground.mobile?.type === "js") || (jsEditArea === "footer" && footerConfig.footerBackground.mobile?.type === "js")))}
                                <div class="form-group border-t pt-4">
                                    <div
                                        class="flex justify-between items-center mb-3"
                                    >
                                        <label
                                            class="depth-3-label flex items-center gap-2"
                                        >
                                            <span>
                                                {previewMode === "mobile"
                                                    ? t(
                                                          "admin.theme.bg_js_mobile_title",
                                                          {
                                                              default:
                                                                  "모바일 JS 코드",
                                                          },
                                                      )
                                                    : t(
                                                          "admin.theme.bg_js_desktop_title",
                                                          {
                                                              default:
                                                                  "데스크톱 JS 코드",
                                                          },
                                                      )}
                                            </span>
                                            <span
                                                class="text-xs text-blue-500 font-normal"
                                                >Canvas ID: dynamic-bg-{jsEditArea}</span
                                            >
                                        </label>
                                    </div>

                                    {#if previewMode === "mobile"}
                                        <div class="mb-3">
                                            {#if jsEditArea === "header" && headerConfig.headerBackground.mobile}
                                                <label
                                                    class="checkbox-label text-blue"
                                                    style="display: inline-flex; align-items: flex-start; justify-content: flex-start; text-align: left; gap: 0.5rem; width: 100%; cursor: pointer; user-select: none; font-size: 0.75rem; font-weight: 600; color: #1e40af; line-height: 1.4;"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        bind:checked={
                                                            headerConfig
                                                                .headerBackground
                                                                .mobile
                                                                .inheritJs
                                                        }
                                                        class="checkbox-input"
                                                        style="width: 14px; height: 14px; margin: 2px 0 0 0; cursor: pointer; accent-color: #2563eb; flex-shrink: 0;"
                                                    />
                                                    <span
                                                        >{t(
                                                            "admin.theme.inherit_desktop_js",
                                                            {
                                                                default:
                                                                    "데스크톱 커스텀 JS 상속",
                                                            },
                                                        )}</span
                                                    >
                                                </label>
                                            {:else if jsEditArea === "footer" && footerConfig.footerBackground.mobile}
                                                <label
                                                    class="checkbox-label text-blue"
                                                    style="display: inline-flex; align-items: flex-start; justify-content: flex-start; text-align: left; gap: 0.5rem; width: 100%; cursor: pointer; user-select: none; font-size: 0.75rem; font-weight: 600; color: #1e40af; line-height: 1.4;"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        bind:checked={
                                                            footerConfig
                                                                .footerBackground
                                                                .mobile
                                                                .inheritJs
                                                        }
                                                        class="checkbox-input"
                                                        style="width: 14px; height: 14px; margin: 2px 0 0 0; cursor: pointer; accent-color: #2563eb; flex-shrink: 0;"
                                                    />
                                                    <span
                                                        >{t(
                                                            "admin.theme.inherit_desktop_js",
                                                            {
                                                                default:
                                                                    "데스크톱 커스텀 JS 상속",
                                                            },
                                                        )}</span
                                                    >
                                                </label>
                                            {:else if jsEditArea === "main" && themeConfig.bodyBackground.mobile}
                                                <label
                                                    class="checkbox-label text-blue"
                                                    style="display: inline-flex; align-items: flex-start; justify-content: flex-start; text-align: left; gap: 0.5rem; width: 100%; cursor: pointer; user-select: none; font-size: 0.75rem; font-weight: 600; color: #1e40af; line-height: 1.4;"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        bind:checked={
                                                            themeConfig
                                                                .bodyBackground
                                                                .mobile
                                                                .inheritJs
                                                        }
                                                        class="checkbox-input"
                                                        style="width: 14px; height: 14px; margin: 2px 0 0 0; cursor: pointer; accent-color: #2563eb; flex-shrink: 0;"
                                                    />
                                                    <span
                                                        >{t(
                                                            "admin.theme.inherit_desktop_js",
                                                            {
                                                                default:
                                                                    "데스크톱 커스텀 JS 상속",
                                                            },
                                                        )}</span
                                                    >
                                                </label>
                                            {/if}
                                        </div>
                                    {/if}

                                    {#if previewMode === "desktop"}
                                        {#if jsEditArea === "header"}
                                            <textarea
                                                class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none"
                                                bind:value={
                                                    headerConfig
                                                        .headerBackground.jsCode
                                                }
                                                spellcheck="false"
                                                placeholder="// Canvas ID: dynamic-bg-header (Desktop)"
                                            ></textarea>
                                        {:else if jsEditArea === "footer"}
                                            <textarea
                                                class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none"
                                                bind:value={
                                                    footerConfig
                                                        .footerBackground.jsCode
                                                }
                                                spellcheck="false"
                                                placeholder="// Canvas ID: dynamic-bg-footer (Desktop)"
                                            ></textarea>
                                        {:else}
                                            <textarea
                                                class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none"
                                                bind:value={
                                                    themeConfig.bodyBackground
                                                        .jsCode
                                                }
                                                spellcheck="false"
                                                placeholder="// Canvas ID: dynamic-bg-main (Desktop)"
                                            ></textarea>
                                        {/if}
                                    {:else if jsEditArea === "header" && headerConfig.headerBackground.mobile}
                                        <textarea
                                            class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none {headerConfig
                                                .headerBackground.mobile
                                                .inheritJs
                                                ? 'opacity-50'
                                                : ''}"
                                            value={headerConfig.headerBackground
                                                .mobile.inheritJs
                                                ? headerConfig.headerBackground
                                                      .jsCode
                                                : headerConfig.headerBackground
                                                      .mobile.jsCode}
                                            oninput={(e) => {
                                                headerConfig.headerBackground.mobile.jsCode =
                                                    e.currentTarget.value;
                                                headerConfig.headerBackground.mobile.inheritJs = false;
                                            }}
                                            readonly={headerConfig
                                                .headerBackground.mobile
                                                .inheritJs}
                                            spellcheck="false"
                                            placeholder={headerConfig
                                                .headerBackground.mobile
                                                .inheritJs
                                                ? "// 데스크톱 커스텀 JS가 상속되고 있습니다. 편집하려면 위 상속 체크박스를 해제해 주세요."
                                                : "// Canvas ID: dynamic-bg-header (Mobile Override)"}
                                        ></textarea>
                                    {:else if jsEditArea === "footer" && footerConfig.footerBackground.mobile}
                                        <textarea
                                            class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none {footerConfig
                                                .footerBackground.mobile
                                                .inheritJs
                                                ? 'opacity-50'
                                                : ''}"
                                            value={footerConfig.footerBackground
                                                .mobile.inheritJs
                                                ? footerConfig.footerBackground
                                                      .jsCode
                                                : footerConfig.footerBackground
                                                      .mobile.jsCode}
                                            oninput={(e) => {
                                                footerConfig.footerBackground.mobile.jsCode =
                                                    e.currentTarget.value;
                                                footerConfig.footerBackground.mobile.inheritJs = false;
                                            }}
                                            readonly={footerConfig
                                                .footerBackground.mobile
                                                .inheritJs}
                                            spellcheck="false"
                                            placeholder={footerConfig
                                                .footerBackground.mobile
                                                .inheritJs
                                                ? "// 데스크톱 커스텀 JS가 상속되고 있습니다. 편집하려면 위 상속 체크박스를 해제해 주세요."
                                                : "// Canvas ID: dynamic-bg-footer (Mobile Override)"}
                                        ></textarea>
                                    {:else if jsEditArea === "main" && themeConfig.bodyBackground.mobile}
                                        <textarea
                                            class="w-full h-80 p-3 font-mono text-[11px] border rounded-lg bg-slate-900 text-slate-100 leading-normal focus:ring-2 focus:ring-blue-500 outline-none {themeConfig
                                                .bodyBackground.mobile.inheritJs
                                                ? 'opacity-50'
                                                : ''}"
                                            value={themeConfig.bodyBackground
                                                .mobile.inheritJs
                                                ? themeConfig.bodyBackground
                                                      .jsCode
                                                : themeConfig.bodyBackground
                                                      .mobile.jsCode}
                                            oninput={(e) => {
                                                themeConfig.bodyBackground.mobile.jsCode =
                                                    e.currentTarget.value;
                                                themeConfig.bodyBackground.mobile.inheritJs = false;
                                            }}
                                            readonly={themeConfig.bodyBackground
                                                .mobile.inheritJs}
                                            spellcheck="false"
                                            placeholder={themeConfig
                                                .bodyBackground.mobile.inheritJs
                                                ? "// 데스크톱 커스텀 JS가 상속되고 있습니다. 편집하려면 위 상속 체크박스를 해제해 주세요."
                                                : "// Canvas ID: dynamic-bg-main (Mobile Override)"}
                                        ></textarea>
                                    {/if}
                                </div>

                                <div
                                    class="info-box p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 mt-2"
                                >
                                    <p
                                        class="font-semibold mb-1 flex items-center gap-1"
                                    >
                                        <Info size={12} />
                                        {t("admin.theme.bg_js_dev_guide", {
                                            default: "개발 가이드:",
                                        })}
                                    </p>
                                    <p>
                                        {@html t(
                                            "admin.theme.bg_js_sandbox_hint",
                                            {
                                                default:
                                                    "모든 배경 스크립트는 Sandbox 환경에서 실행됩니다. <code>window.innerWidth/Height</code>에 맞춰 Canvas 크기를 조절하는 코드를 포함해 주세요.",
                                            },
                                        )}
                                    </p>
                                </div>
                            {:else}
                                <div
                                    class="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"
                                >
                                    <Braces
                                        size={48}
                                        class="mx-auto mb-3 text-slate-300"
                                    />
                                    <p class="text-sm text-slate-500">
                                        {@html t(
                                            "admin.theme.bg_js_inactive_hint",
                                            {
                                                default:
                                                    "상위 배경 타입 설정에서 'Custom JavaScript'를 선택하면<br />여기에 고급 코드 에디터가 활성화됩니다.",
                                            },
                                        )}
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </AccordionItem>
                {/if}
            </div>
        </aside>

        <!-- Preview Area -->
        <!-- Preview Area -->
        <DesignPreview
            {themeConfig}
            {headerConfig}
            {footerConfig}
            categories={data.categories || []}
            {currentLayout}
            {columnWidgets}
            {mobileColumnCount}
            {mobileColumnWidths}
            {mobileColumnWidgets}
            {previewMode}
            bind:activeLang
            {languages}
            {getBgStyle}
            {getBgValue}
            {getTextStyle}
            {removeWidgetFromLayout}
            {removeMobileWidgetFromLayout}
            {openWidgetSettings}
            {widgetShadowGlobal}
        />

        <!-- Widget Advanced Settings Modal -->
        {#if showWidgetModal && editingWidgetInstance}
            <div class="modal-overlay" onclick={closeWidgetModal}>
                <div class="modal-content" onclick={(e) => e.stopPropagation()}>
                    <div class="modal-header">
                        <h3 class="depth-2-subtitle">
                            {t("admin.theme.widget_modal_title", {
                                name: editingWidgetInstance.name,
                            })}
                            <span class="depth-4-hint ml-1"
                                >({editingDevice === "mobile"
                                    ? t("admin.theme.widget_device_mobile")
                                    : t(
                                          "admin.theme.widget_device_desktop",
                                      )})</span
                            >
                        </h3>
                        <button class="btn-close" onclick={closeWidgetModal}
                            >×</button
                        >
                    </div>
                    <div class="modal-body">
                        {#if editingWidgetInstance.type === "PostContent" || editingWidgetInstance.type === "post_content"}
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t("admin.theme.widget_columns")}</label
                                >
                                <select
                                    bind:value={editingWidgetConfig.columns}
                                >
                                    <option value={1}
                                        >{t("admin.theme.widget_col_1")}</option
                                    >
                                    <option value={2}
                                        >{t("admin.theme.widget_col_2")}</option
                                    >
                                    <option value={3}
                                        >{t("admin.theme.widget_col_3")}</option
                                    >
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t("admin.theme.widget_layout")}</label
                                >
                                <select bind:value={editingWidgetConfig.layout}>
                                    <option value="vertical"
                                        >{t(
                                            "admin.theme.widget_layout_vertical",
                                        )}</option
                                    >
                                    <option value="horizontal"
                                        >{t(
                                            "admin.theme.widget_layout_horizontal",
                                        )}</option
                                    >
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t(
                                        "admin.theme.widget_card_height",
                                    )}</label
                                >
                                <input
                                    type="text"
                                    bind:value={editingWidgetConfig.cardHeight}
                                    placeholder={t(
                                        "admin.theme.widget_card_height_placeholder",
                                    )}
                                />
                                <p class="depth-4-hint">
                                    {t("admin.theme.widget_card_height_hint")}
                                </p>
                            </div>

                            {#if editingWidgetConfig.layout === "horizontal"}
                                <div class="form-group">
                                    <label class="depth-3-label"
                                        >{t(
                                            "admin.theme.widget_img_ratio_h",
                                        )}</label
                                    >
                                    <input
                                        type="number"
                                        bind:value={
                                            editingWidgetConfig.imageRatio
                                        }
                                        min="10"
                                        max="90"
                                    />
                                    <p class="depth-4-hint">
                                        {t(
                                            "admin.theme.widget_img_ratio_h_hint",
                                        )}
                                    </p>
                                </div>
                            {:else}
                                <!-- Vertical Layout -->
                                <div class="form-group">
                                    <label class="depth-3-label"
                                        >{t(
                                            "admin.theme.widget_img_ratio_v",
                                        )}</label
                                    >
                                    <input
                                        type="number"
                                        bind:value={
                                            editingWidgetConfig.imageRatio
                                        }
                                        placeholder="50"
                                        min="10"
                                        max="90"
                                    />
                                    <p class="depth-4-hint">
                                        {t(
                                            "admin.theme.widget_img_ratio_v_hint",
                                        )}
                                    </p>
                                </div>
                            {/if}
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t(
                                        "admin.theme.widget_items_per_page",
                                    )}</label
                                >
                                <input
                                    type="number"
                                    bind:value={
                                        editingWidgetConfig.itemsPerPage
                                    }
                                    min="1"
                                    max="100"
                                />
                            </div>
                            <div class="form-group mt-3">
                                <label class="depth-3-label"
                                    >{t("admin.theme.widget_card_font")}</label
                                >
                                <input
                                    type="text"
                                    bind:value={
                                        editingWidgetConfig.cardFontSize
                                    }
                                    placeholder="1rem"
                                />
                            </div>
                            <div class="form-group mt-3">
                                <label class="depth-3-label"
                                    >{t(
                                        "admin.theme.widget_hover_effect",
                                    )}</label
                                >
                                <select
                                    bind:value={editingWidgetConfig.hoverEffect}
                                >
                                    <option value="default"
                                        >{t(
                                            "admin.theme.hover_default",
                                        )}</option
                                    >
                                    <option value="lift"
                                        >{t("admin.theme.hover_lift")}</option
                                    >
                                    <option value="zoom"
                                        >{t("admin.theme.hover_zoom")}</option
                                    >
                                    <option value="glow"
                                        >{t("admin.theme.hover_glow")}</option
                                    >
                                </select>
                            </div>

                            {#if editingWidgetConfig.hoverEffect === "glow"}
                                <div class="form-group mt-3">
                                    <label class="depth-3-label"
                                        >{t("admin.theme.glow_color")}</label
                                    >
                                    <div class="flex items-center gap-2">
                                        <input
                                            type="color"
                                            bind:value={
                                                editingWidgetConfig.glowColor
                                            }
                                            class="h-8 w-8 cursor-pointer border-0 p-0"
                                        />
                                        <input
                                            type="text"
                                            bind:value={
                                                editingWidgetConfig.glowColor
                                            }
                                            placeholder="#3b82f6"
                                            class="flex-1"
                                        />
                                    </div>
                                    <p class="depth-4-hint">
                                        {t("admin.theme.glow_color_hint")}
                                    </p>
                                </div>
                            {/if}

                            <div class="form-group mt-3">
                                <label class="depth-3-label"
                                    >{t("admin.theme.pagination_style")}</label
                                >
                                <select
                                    bind:value={
                                        editingWidgetConfig.paginationStyle
                                    }
                                >
                                    <option value="default"
                                        >{t(
                                            "admin.theme.pagination_default",
                                        )}</option
                                    >
                                    <option value="minimal"
                                        >{t(
                                            "admin.theme.pagination_minimal",
                                        )}</option
                                    >
                                    <option value="bordered"
                                        >{t(
                                            "admin.theme.pagination_bordered",
                                        )}</option
                                    >
                                </select>
                            </div>
                        {:else if editingWidgetInstance.type === "TagCloud" || editingWidgetInstance.type === "tag_cloud"}
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t("admin.theme.tagcloud_sort")}</label
                                >
                                <select
                                    bind:value={editingWidgetConfig.sortOrder}
                                >
                                    <option value="popular"
                                        >{t("admin.theme.sort_popular")}</option
                                    >
                                    <option value="latest"
                                        >{t("admin.theme.sort_latest")}</option
                                    >
                                    <option value="alphabet"
                                        >{t(
                                            "admin.theme.sort_alphabet",
                                        )}</option
                                    >
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="depth-3-label"
                                    >{t("admin.theme.tagcloud_max")}</label
                                >
                                <input
                                    type="number"
                                    bind:value={editingWidgetConfig.maxTags}
                                    min="1"
                                    max="100"
                                />
                                <p class="hint">
                                    {t("admin.theme.tagcloud_max_hint")}
                                </p>
                            </div>
                        {:else}
                            <p class="text-slate-500 text-sm py-4">
                                {t("admin.theme.widget_no_settings")}
                            </p>
                            <textarea
                                bind:value={editingWidgetConfig}
                                class="w-full h-32 text-xs font-mono p-2 border rounded"
                                placeholder="JSON 형태의 config"
                            ></textarea>
                        {/if}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick={closeWidgetModal}
                            >{t("admin.common.cancel")}</button
                        >
                        <button class="btn-primary" onclick={saveWidgetSettings}
                            >{t("admin.theme.widget_apply")}</button
                        >
                    </div>
                </div>
            </div>
        {/if}
    </main>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family:
            "Inter",
            system-ui,
            -apple-system,
            sans-serif;
    }

    .editor-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #f1f5f9;
    }

    .top-bar {
        background: #ffffff;
        padding: 0.75rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 700;
        color: #1e293b;
    }

    .logo-icon {
        color: #3b82f6;
    }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        backdrop-filter: blur(2px);
    }

    .modal-content {
        background: #ffffff;
        width: 100%;
        max-width: 500px;
        border-radius: 0.75rem;
        box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
        display: flex;
        flex-direction: column;
        max-height: 90vh;
    }

    .modal-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: #1e293b;
    }

    .btn-close {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        color: #94a3b8;
    }

    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
    }

    .modal-footer {
        padding: 1.25rem 1.5rem;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        background: #f8fafc;
        border-bottom-left-radius: 0.75rem;
        border-bottom-right-radius: 0.75rem;
    }

    .btn-cancel {
        padding: 0.5rem 1rem;
        background: white;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        color: #64748b;
        font-weight: 500;
        cursor: pointer;
    }

    .btn-primary {
        padding: 0.5rem 1rem;
        background: #3b82f6;
        border: none;
        border-radius: 0.375rem;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-primary:hover {
        background: #2563eb;
    }

    .color-picker-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
    .color-picker-group div {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .color-picker-group label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
    }
    .color-picker-group input[type="color"] {
        width: 100%;
        height: 36px;
        padding: 0.2rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
    }
    .mt-3 {
        margin-top: 0.75rem;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .device-toggles {
        background: #f1f5f9;
        padding: 0.25rem;
        border-radius: 0.5rem;
        display: flex;
        gap: 0.25rem;
    }

    .device-toggles button {
        background: transparent;
        border: none;
        padding: 0.5rem;
        border-radius: 0.375rem;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;
    }

    .device-toggles button.active {
        background: white;
        color: #3b82f6;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .btn-save {
        background: #3b82f6;
        color: white;
        border: 1px solid transparent;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-save:hover:not(:disabled) {
        background: #2563eb;
    }

    .btn-save:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .btn-draft {
        background: rgba(148, 163, 184, 0.1);
        color: #475569;
        border: 1px solid rgba(148, 163, 184, 0.3);
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-draft:hover:not(:disabled) {
        background: rgba(148, 163, 184, 0.2);
        color: #1e293b;
        border-color: rgba(148, 163, 184, 0.5);
    }

    .btn-draft:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .main-content {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .db-status-bar {
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #64748b;
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
    }

    .status-indicator.remote {
        background: #10b981;
    }

    .db-name {
        font-weight: 500;
    }

    .sidebar {
        width: 400px;
        background: white;
        border-right: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
    }

    .sidebar-nav {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        padding: 0.4rem 0.25rem;
        gap: 0.125rem;
        overflow-x: auto;
    }

    .sidebar-nav button {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.4rem 0.05rem;
        gap: 0.2rem;
        background: transparent;
        border: none;
        border-radius: 0.5rem;
        color: #64748b;
        cursor: pointer;
        min-height: 4rem;
        transition: all 0.2s ease;
    }

    .sidebar-nav button.active {
        background: #eff6ff;
        color: #3b82f6;
    }

    .sidebar-nav span {
        font-size: 0.675rem;
        font-weight: 600;
        line-height: 1.15;
        white-space: pre-line;
        text-align: center;
        word-break: keep-all;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem 1rem;
    }

    .config-section h3 {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 1.25rem;
    }

    .bg-settings {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: #f8fafc;
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
    }

    .form-group-mini {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .form-group-mini label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
    }

    .color-picker-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .color-picker-row input[type="color"] {
        padding: 0;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        overflow: hidden;
    }
    .gradient-builder {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: #fff;
        padding: 0.75rem;
        border-radius: 0.375rem;
        border: 1px dashed #cbd5e1;
    }

    .btn-secondary {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: all 0.2s ease;
        box-sizing: border-box;
    }
    .btn-secondary:hover:not(:disabled) {
        background: #e2e8f0;
        color: #1e293b;
        border-color: #cbd5e1;
    }
    .btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-group {
        display: inline-flex;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        overflow: hidden;
    }
    .btn-group button {
        background: white;
        border: none;
        border-right: 1px solid #cbd5e1;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        font-weight: 600;
        color: #475569;
        transition: all 0.2s;
    }
    .btn-group button:last-child {
        border-right: none;
    }
    .btn-group button:hover {
        background: #f1f5f9;
        color: #1e293b;
    }

    .col-widths {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .width-input {
        flex: 1;
    }

    .width-input label {
        display: block;
        font-size: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .width-input input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
    }

    .widgets-list {
        display: grid;
        gap: 0.75rem;
    }

    .widget-item {
        padding: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .add-to-cols {
        display: flex;
        gap: 0.25rem;
    }

    .add-to-cols button {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        cursor: pointer;
    }

    .css-editor {
        width: 100%;
        height: 400px;
        font-family: monospace;
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        resize: none;
    }

    /* Preview Area Styling moved to ThemePreview.svelte */

    .form-group {
        margin-bottom: 1.25rem;
    }

    .form-group label {
        display: block;
        font-size: 0.875rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }

    .form-group input {
        width: 100%;
        padding: 0.625rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
    }

    .dragging {
        opacity: 0.4;
        border-style: dashed !important;
        background-color: #f8fafc !important;
    }

    .hint {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 1rem;
    }
    .width-input-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed #f1f5f9;
        padding-bottom: 0.5rem;
    }

    .width-input-container label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
    }

    .width-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .width-controls input {
        width: 100%;
        min-width: 50px;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        text-align: center;
        font-size: 0.875rem;
    }

    .step-btn {
        width: 32px;
        height: 32px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-weight: bold;
        color: #64748b;
    }

    .step-btn:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
    }

    .master-widgets-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 2rem;
    }

    .master-widget-item {
        padding: 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;
        transition: all 0.2s ease;
    }

    .master-widget-item.is-editing {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
    }

    .widget-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
        margin-right: 1rem;
    }

    .w-name {
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .w-type {
        font-size: 0.75rem;
        color: #64748b;
    }

    .widget-actions {
        display: flex;
        gap: 0.5rem;
    }

    .icon-btn {
        padding: 0.5rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        color: #64748b;
        cursor: pointer;
        display: flex;
        align-items: center;
    }

    .icon-btn:hover {
        background: #f1f5f9;
        color: #3b82f6;
    }

    .icon-btn.delete:hover {
        background: #fee2e2;
        color: #ef4444;
        border-color: #fecaca;
    }

    .widget-edit-form {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .widget-edit-form input {
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        font-size: 0.875rem;
    }

    .edit-actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn-save-mini,
    .btn-cancel-mini {
        flex: 1;
        padding: 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-save-mini {
        background: #3b82f6;
        color: white;
        border: none;
    }

    .btn-cancel-mini {
        background: white;
        border: 1px solid #e2e8f0;
        color: #64748b;
    }
    .widget-title-edit {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
    }

    .custom-title-input {
        width: 100%;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        background: #f8fafc;
        color: #64748b;
    }

    .custom-title-input:focus {
        outline: none;
        border-color: #3b82f6;
        background: white;
    }

    .post-content-placeholder {
        background: rgba(59, 130, 246, 0.05);
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 0.875rem;
    }

    .widget-form select,
    .widget-form textarea {
        width: 100%;
        padding: 0.625rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        background: white;
        font-size: 0.875rem;
    }
    .form-group-mini {
        margin-bottom: 0.5rem;
    }

    .form-group-mini label {
        display: block;
        font-size: 0.65rem;
        font-weight: 700;
        color: #94a3b8;
        margin-bottom: 0.125rem;
    }

    .form-group-mini select,
    .form-group-mini input {
        width: 100%;
        padding: 0.4rem;
        font-size: 0.8rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
    }

    /* Backup/Restore Section Styles */
    .section-backup-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .section-backup-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
    }

    .section-label {
        font-weight: 600;
        color: #1e293b;
        font-size: 0.875rem;
    }

    .section-actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn-mini {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.375rem 0.75rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        color: #475569;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.15s ease;
    }

    .btn-mini:hover {
        background: #e2e8f0;
        color: #1e293b;
    }

    .restore-label {
        cursor: pointer;
    }

    .restore-label:hover {
        background: #dbeafe;
        color: #1d4ed8;
        border-color: #93c5fd;
    }

    /* Settings Form UI (Ported from Media/Backup Page) */
    .settings-form {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        max-width: 800px; /* 추가: 시선 집중을 위해 폼 넓이 축소 */
        margin: 0 auto; /* 추가: 가운데 정렬 */
    }

    .form-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
    }

    .form-header h3 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 0.5rem;
    }

    .form-header p {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
    }

    .setting-group {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .setting-row {
        display: flex;
        flex-direction: column; /* 데스크톱 및 모바일 항상 세로 배치 유지 */
        gap: 1rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #e2e8f0;
    }

    .setting-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .setting-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .setting-info label {
        font-size: 0.95rem;
        font-weight: 600;
        color: #374151;
    }

    .field-hint {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 400;
        line-height: 1.4;
    }

    .setting-control {
        flex: 1;
        width: 100%;
        display: flex;
        justify-content: flex-start; /* 버튼 등을 좌측에 배치 */
    }

    .setting-control > *,
    .setting-control .btn-primary {
        width: auto !important; /* 액션 버튼 및 폼이 본래 너비만 차지하게 변경 */
        min-width: 140px;
    }

    /* Modern Buttons */
    .btn-primary {
        padding: 0.625rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
        text-decoration: none;
    }
    .btn-primary:hover:not(:disabled) {
        background: #2563eb;
    }
    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* File Input Styling */
    .file-input {
        display: block;
        width: 100%;
        font-size: 0.875rem;
        color: #64748b;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.5rem;
        padding: 0.5rem;
        cursor: pointer;
    }
    .file-input::file-selector-button {
        margin-right: 1rem;
        padding: 0.5rem 1rem;
        border-radius: 9999px;
        border: none;
        font-size: 0.875rem;
        font-weight: 600;
        background: #e2e8f0;
        color: #475569;
        cursor: pointer;
        transition: background 0.15s;
    }
    .file-input::file-selector-button:hover {
        background: #cbd5e1;
    }

    /* Depth Typography Hierarchy (Scoped to Editor) */
    .depth-1-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #1e293b;
        margin-bottom: 1.25rem;
        letter-spacing: -0.025em;
    }

    .depth-2-subtitle {
        font-size: 1.05rem;
        font-weight: 700;
        color: #334155;
        margin-bottom: 1rem;
    }

    .depth-3-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
    }

    .depth-4-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.05em;
    }

    .depth-4-hint {
        font-size: 0.75rem;
        font-weight: 400;
        color: #64748b;
        margin-top: 0.25rem;
        line-height: 1.5;
    }

    .btn-action-mini {
        padding: 0.125rem 0.375rem;
        font-size: 0.65rem;
        font-weight: 600;
        border: 1px solid #e2e8f0;
        background-color: #ffffff;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
    }

    .btn-action-mini:hover:not(:disabled) {
        background-color: #f8fafc;
        border-color: #cbd5e1;
        color: #3b82f6;
    }

    .btn-action-mini.delete {
        background-color: #fef2f2;
        color: #ef4444;
        border-color: #fee2e2;
    }

    .btn-action-mini.delete:hover:not(:disabled) {
        background-color: #fee2e2;
        border-color: #fecaca;
    }

    .btn-action-mini:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .help-box {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 0.85rem 1rem;
        margin-bottom: 0.75rem;
        font-size: 0.8rem;
        color: #1e40af;
    }

    .help-box strong {
        display: block;
        margin-bottom: 0.4rem;
    }

    .help-box ul {
        margin: 0;
        padding-left: 1.2rem;
        line-height: 1.8;
    }

    .help-box p {
        margin-top: 0.5rem;
        color: #3b82f6;
    }

    .btn-mini {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        align-items: center;
        padding: 0.4rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 6px;
        transition: all 0.2s;
    }
</style>
