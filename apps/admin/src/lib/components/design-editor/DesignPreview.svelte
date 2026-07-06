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
    import {
        Trash2,
        FolderTree,
        Globe,
        ChevronDown,
        X,
        LogIn,
        User,
        ChevronRight,
    } from "lucide-svelte";
    import HtmlWidget from "../widgets/HtmlWidget.svelte";
    import DynamicBgRenderer from "$lib/components/DynamicBgRenderer.svelte";
    import { t } from "$lib/i18n.svelte";
    import { onMount } from "svelte";

    let {
        themeConfig,
        headerConfig: rawHeaderConfig,
        footerConfig: rawFooterConfig,
        categories = [],
        currentLayout,
        columnWidgets,
        mobileColumnCount = 1,
        mobileColumnWidths = ["1fr"],
        mobileColumnWidgets = [],
        previewMode,
        activeLang = $bindable(),
        languages = [],
        getBgStyle,
        getBgValue,
        getTextStyle,
        removeWidgetFromLayout,
        removeMobileWidgetFromLayout = () => {},
        openWidgetSettings = () => {},
        widgetShadowGlobal,
    } = $props<{
        themeConfig: any;
        headerConfig: any;
        footerConfig: any;
        widgetShadowGlobal: any;
        currentLayout: any;
        columnWidgets: any[][];
        mobileColumnCount?: number;
        mobileColumnWidths?: string[];
        mobileColumnWidgets?: any[][];
        previewMode: string;
        activeLang: string;
        languages?: any[];
        getBgStyle: (config: any) => string;
        removeWidgetFromLayout: (id: string | number) => void;
        removeMobileWidgetFromLayout?: (id: string | number) => void;
        openWidgetSettings?: (
            widget: any,
            device?: "desktop" | "mobile",
        ) => void;
        getTextStyle: (config: any) => string;
        getBgValue: (config: any) => string;
    }>();

    // 스크롤 및 모바일 드로어 가상 상태 정의
    let isScrolled = $state(false);
    let showMobileDrawer = $state(false);

    let previewAreaEl = $state<HTMLElement | null>(null);

    function handleScroll(e: Event) {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        isScrolled = target.scrollTop > 5;
    }

    $effect(() => {
        // 프리뷰 모드가 전환되면 스크롤 위치와 상태를 리셋하여 오동작 차단
        if (previewMode) {
            isScrolled = false;
            if (previewAreaEl) {
                previewAreaEl.scrollTop = 0;
            }
        }
    });

    // Computed values based on previewMode
    const activeColumnCount = $derived(
        previewMode === "mobile"
            ? mobileColumnCount
            : currentLayout.columnCount,
    );
    const activeColumnWidths = $derived(
        previewMode === "mobile"
            ? mobileColumnWidths.join(" ")
            : currentLayout.columnWidths.join(" "),
    );

    let logoHoverTransform = $derived(
        headerConfig.logoHoverEffect === "scale"
            ? `scale(${headerConfig.logoHoverScale || 1.02})`
            : headerConfig.logoHoverEffect === "float"
              ? `translateY(-${headerConfig.logoHoverFloatOffset ?? 2}px)`
              : "none",
    );
    let logoHoverColorVal = $derived(
        headerConfig.logoHoverEffect === "color"
            ? headerConfig.logoHoverColor?.value ||
                  "var(--accent-color, var(--primary-color))"
            : headerConfig.logoColor?.type === "gradient"
              ? headerConfig.logoColor?.value ||
                "linear-gradient(90deg, #3b82f6, #06b6d4)"
              : headerConfig.logoColor?.value || "var(--primary-color)",
    );
    let logoHoverShadowVal = $derived(
        headerConfig.logoHoverShadowEnabled
            ? `0 2px 8px ${headerConfig.logoHoverShadowColor?.value || "rgba(0, 0, 0, 0.15)"}`
            : "none",
    );
    const activeColumnWidgets = $derived(
        previewMode === "mobile" ? mobileColumnWidgets : columnWidgets,
    );

    function getWidgetShadowStyle(widget: any) {
        const cfg =
            typeof widget.config === "string"
                ? JSON.parse(widget.config || "{}")
                : widget.config || {};
        const shadow = cfg.shadow;
        const global = widgetShadowGlobal;

        let normal = "none";
        let hover = "none";
        let hoverTranslateY = -2;

        if (shadow && shadow.useGlobal === false) {
            // Individual override
            normal = shadow.normal || "none";
            hover = shadow.hover || "none";
            hoverTranslateY = shadow.hoverTranslateY ?? -2;
        } else if (global && global.enabled) {
            // Global setting
            normal = global.normal || "none";
            hover = global.hover || "none";
            hoverTranslateY = global.hoverTranslateY ?? -2;
        }

        return `--widget-normal-shadow: ${normal}; --widget-hover-shadow: ${hover}; --widget-hover-translate-y: ${hoverTranslateY}px;`;
    }
    const activeRemoveFn = $derived(
        previewMode === "mobile"
            ? removeMobileWidgetFromLayout
            : removeWidgetFromLayout,
    );

    function getI18nText(textObj: any, lang: string = "ko") {
        if (!textObj) return "";
        if (typeof textObj === "string") return textObj;
        return (
            textObj[lang] || textObj["ko"] || Object.values(textObj)[0] || ""
        );
    }
    function getRadiusStyle(radius: any) {
        if (!radius) return "0px";
        const { topLeft, topRight, bottomLeft, bottomRight } = radius;
        const f = (v: any) => (typeof v === "number" ? `${v}px` : v || "0px");
        return `${f(topLeft)} ${f(topRight)} ${f(bottomRight)} ${f(bottomLeft)}`;
    }

    const headerConfig = $derived(
        previewMode === "mobile"
            ? {
                  ...rawHeaderConfig,
                  height:
                      rawHeaderConfig.mobile?.height || rawHeaderConfig.height,
                  logoFontSize:
                      rawHeaderConfig.mobile?.logoFontSize ||
                      rawHeaderConfig.logoFontSize,
                  logoPadding:
                      rawHeaderConfig.mobile?.logoPadding ||
                      rawHeaderConfig.logoPadding,
                  navPadding:
                      rawHeaderConfig.mobile?.navPadding ||
                      rawHeaderConfig.navPadding,
                  navSpacing:
                      rawHeaderConfig.mobile?.navSpacing ||
                      rawHeaderConfig.navSpacing,
                  logoAlignment:
                      rawHeaderConfig.mobile?.logoAlignment ||
                      rawHeaderConfig.logoAlignment,
                  logoVerticalAlignment: "middle",
                  navAlignment:
                      rawHeaderConfig.mobile?.navAlignment ||
                      rawHeaderConfig.navAlignment,
                  navVerticalAlignment: "middle",
                  showLanguageSwitcher:
                      rawHeaderConfig.mobile?.showLanguageSwitcher !== false,
                  menuItems:
                      rawHeaderConfig.mobile?.menuItems &&
                      rawHeaderConfig.mobile.menuItems.length > 0
                          ? rawHeaderConfig.mobile.menuItems
                          : rawHeaderConfig.menuItems,
              }
            : rawHeaderConfig,
    );

    // 실시간 안전 여백(Safe Margins) 계산
    const safeMargins = $derived.by(() => {
        const defaultResult = {
            top: "0px",
            side: "0px",
            topMobile: "0px",
            sideMobile: "0px",
        };
        const header = headerConfig;
        const theme = themeConfig;
        if (!header) return defaultResult;
        let hasTopRadius = false;
        let hasBottomRadius = false;
        let hasAnyRadius = false;
        let hasShadow = false;

        if (header.borderRadius) {
            const r = header.borderRadius;
            const parseRadius = (v: any) => {
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

        const divideMargin = (val: any) => {
            if (!val) return "0px";
            const num = parseFloat(val);
            if (isNaN(num)) return val;
            const unit = String(val)
                .replace(/[0-9.]/g, "")
                .trim();
            return `${num / 2}${unit || "px"}`;
        };

        const convertToPx = (val: any) => {
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
    });

    const footerConfig = $derived(
        previewMode === "mobile"
            ? {
                  ...rawFooterConfig,
                  copyright:
                      rawFooterConfig.mobile?.copyright ||
                      rawFooterConfig.copyright,
                  navLinks:
                      rawFooterConfig.mobile?.navLinks &&
                      rawFooterConfig.mobile.navLinks.length > 0
                          ? rawFooterConfig.mobile.navLinks
                          : rawFooterConfig.navLinks,
                  navFontSize:
                      rawFooterConfig.mobile?.navFontSize ||
                      rawFooterConfig.navFontSize,
                  navColor:
                      rawFooterConfig.mobile?.navColor ||
                      rawFooterConfig.navColor,
                  navHoverColor:
                      rawFooterConfig.mobile?.navHoverColor ||
                      rawFooterConfig.navHoverColor,
                  text: {
                      color:
                          rawFooterConfig.mobile?.text?.color ||
                          rawFooterConfig.text?.color,
                      fontSize:
                          rawFooterConfig.mobile?.text?.fontSize ||
                          rawFooterConfig.text?.fontSize,
                  },
                  borderRadius:
                      rawFooterConfig.mobile?.borderRadius ||
                      rawFooterConfig.borderRadius,
                  boxShadow:
                      rawFooterConfig.mobile?.boxShadow ||
                      rawFooterConfig.boxShadow,
              }
            : rawFooterConfig,
    );

    let useBottomFade = $derived(headerConfig.useBottomFade ?? false);
    let fadeStrength = $derived(headerConfig.bottomFadeStrength ?? 20);
    let useTextShadow = $derived(headerConfig.useTextShadow ?? false);

    // 스크롤 여부에 따른 로고 정렬 및 패딩 가변 상태 derived 정의
    let currentLogoAlignment = $derived(
        isScrolled
            ? headerConfig.scrolledLogoAlignment || "left"
            : headerConfig.logoAlignment || "left",
    );

    let currentLogoVAlign = $derived(
        isScrolled
            ? headerConfig.scrolledLogoVerticalAlignment || "middle"
            : headerConfig.logoVerticalAlignment || "middle",
    );

    let currentLogoPadding = $derived(
        isScrolled
            ? {
                  top:
                      headerConfig.scrolledLogoPadding?.top ??
                      headerConfig.logoPadding?.top ??
                      0,
                  right:
                      headerConfig.scrolledLogoPadding?.right ??
                      headerConfig.logoPadding?.right ??
                      0,
                  bottom:
                      headerConfig.scrolledLogoPadding?.bottom ??
                      headerConfig.logoPadding?.bottom ??
                      0,
                  left:
                      headerConfig.scrolledLogoPadding?.left ??
                      headerConfig.logoPadding?.left ??
                      0,
              }
            : {
                  top: headerConfig.logoPadding?.top ?? 0,
                  right: headerConfig.logoPadding?.right ?? 0,
                  bottom: headerConfig.logoPadding?.bottom ?? 0,
                  left: headerConfig.logoPadding?.left ?? 0,
              },
    );

    // 두 줄 모드: 모바일이 아닌 경우에만 활성화 (스크롤 시에는 한 줄로 축소)
    let isTwoLine = $derived(
        headerConfig.headerLayout === "two-line" &&
            previewMode !== "mobile" &&
            !isScrolled,
    );

    // 두 줄 모드에서 로고 수평 정렬을 text-align으로 변환
    let twoLineLogoTextAlign = $derived(
        currentLogoAlignment === "center"
            ? "center"
            : currentLogoAlignment === "right"
              ? "right"
              : "left",
    );

    // 로고 수평 정중앙 정렬 시에도 수직 정렬(상단, 중앙, 하단)이 연동되도록 absolute 배치 변수 연산
    let logoVAlignVal = $derived(currentLogoVAlign);
    let logoCenterTop = $derived(
        logoVAlignVal === "top"
            ? "0px"
            : logoVAlignVal === "bottom"
              ? "auto"
              : "50%",
    );
    let logoCenterBottom = $derived(
        logoVAlignVal === "top"
            ? "auto"
            : logoVAlignVal === "bottom"
              ? "0px"
              : "auto",
    );
    let logoCenterYTrans = $derived(
        logoVAlignVal === "top"
            ? "0%"
            : logoVAlignVal === "bottom"
              ? "0%"
              : "-50%",
    );

    // 데스크탑 모드에서 로고 패딩 및 폰트크기를 고려하여 헤더가 잘리지 않도록 최소 높이 계산
    let logoPaddingTop = $derived(currentLogoPadding.top);
    let logoPaddingBottom = $derived(currentLogoPadding.bottom);
    let minHeaderHeight = $derived(
        `calc(${headerConfig.logoFontSize || "1.5rem"} + ${logoPaddingTop + logoPaddingBottom + 16}px)`,
    );

    function normalizeBackground(
        bg: any,
        legacyOpacity?: number,
        legacyBlur?: number,
        legacyLayerBlur?: number,
    ) {
        let result: any = { type: "solid", value: "transparent" };
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

        if (result.mobile !== undefined && result.mobile !== null) {
            result.mobile = normalizeBackground(result.mobile);
        }

        return result;
    }

    // Sync logic with Header.svelte
    const normalizedHeaderBg = $derived.by(() => {
        const rawBg = headerConfig?.headerBackground;
        const normalized = normalizeBackground(
            rawBg,
            headerConfig?.headerBackgroundOpacity,
            headerConfig?.headerBackgroundBlur,
        );
        if (previewMode === "mobile") {
            if (normalized.mobile) {
                const isJs = normalized.mobile.type === "js";
                const actualJsCode =
                    isJs && normalized.mobile.inheritJs
                        ? normalized.jsCode || ""
                        : normalized.mobile.jsCode || "";
                return {
                    ...normalized.mobile,
                    jsCode: actualJsCode,
                    allowMobile: isJs,
                };
            } else {
                return {
                    ...normalized,
                    allowMobile: false,
                };
            }
        }
        return { ...normalized, allowMobile: true };
    });
    const headerBlur = $derived(normalizedHeaderBg.blur ?? 0);
    const headerLayerBlur = $derived(normalizedHeaderBg.layerBlur ?? 0);
    const headerOpacity = $derived(normalizedHeaderBg.opacity ?? 1);

    // Sync logic for Body
    const normalizedBodyBg = $derived.by(() => {
        const rawBg = themeConfig?.bodyBackground || themeConfig?.background;
        const normalized = normalizeBackground(
            rawBg,
            themeConfig?.bodyBackgroundOpacity,
            themeConfig?.bodyBackgroundBlur,
        );
        if (previewMode === "mobile") {
            if (normalized.mobile) {
                const isJs = normalized.mobile.type === "js";
                const actualJsCode =
                    isJs && normalized.mobile.inheritJs
                        ? normalized.jsCode || ""
                        : normalized.mobile.jsCode || "";
                return {
                    ...normalized.mobile,
                    jsCode: actualJsCode,
                    allowMobile: isJs,
                };
            } else {
                return {
                    ...normalized,
                    allowMobile: false,
                };
            }
        }
        return { ...normalized, allowMobile: true };
    });
    const bodyBlur = $derived(normalizedBodyBg.blur ?? 0);
    const bodyLayerBlur = $derived(normalizedBodyBg.layerBlur ?? 0);
    const bodyOpacity = $derived(normalizedBodyBg.opacity ?? 1);

    // Sync logic for Footer
    const normalizedFooterBg = $derived.by(() => {
        const rawBg = footerConfig?.footerBackground;
        const normalized = normalizeBackground(
            rawBg,
            footerConfig?.footerBackgroundOpacity,
            footerConfig?.footerBackgroundBlur,
        );
        if (previewMode === "mobile") {
            if (normalized.mobile) {
                const isJs = normalized.mobile.type === "js";
                const actualJsCode =
                    isJs && normalized.mobile.inheritJs
                        ? normalized.jsCode || ""
                        : normalized.mobile.jsCode || "";
                return {
                    ...normalized.mobile,
                    jsCode: actualJsCode,
                    allowMobile: isJs,
                };
            } else {
                return {
                    ...normalized,
                    allowMobile: false,
                };
            }
        }
        return { ...normalized, allowMobile: true };
    });
    const footerBlur = $derived(normalizedFooterBg.blur ?? 0);
    const footerLayerBlur = $derived(normalizedFooterBg.layerBlur ?? 0);
    const footerOpacity = $derived(normalizedFooterBg.opacity ?? 1);

    const defaultNavLabels: Record<string, Record<string, string>> = {
        category_drawer: { ko: "카테고리", en: "Categories", ja: "カテゴリー" },
        guestbook: { ko: "방명록", en: "Guestbook", ja: "ゲストブック" },
        login: { ko: "로그인", en: "Login", ja: "ログイン" },
        home: { ko: "홈", en: "Home", ja: "홈" },
        posts: { ko: "포스트", en: "Posts", ja: "ポスト" },
    };

    const defaultWidgetLabels: Record<string, Record<string, string>> = {
        recentposts: {
            ko: "최신 포스트",
            en: "Recent Posts",
            ja: "最新ポスト",
        },
        categorymenu: { ko: "카테고리", en: "Categories", ja: "カテゴリー" },
        popularposts: {
            ko: "인기 포스트",
            en: "Popular Posts",
            ja: "人気ポスト",
        },
        tagcloud: { ko: "태그", en: "Tags", ja: "タグ" },
        postcontent: { ko: "본문", en: "Post Content", ja: "本文" },
        htmlwidget: {
            ko: "HTML 위젯",
            en: "HTML Widget",
            ja: "HTMLウィジェット",
        },
        category_link: {
            ko: "카테고리 링크",
            en: "Category Link",
            ja: "カテゴリーリンク",
        },
        recentcomments: {
            ko: "최근 댓글",
            en: "Recent Comments",
            ja: "最近のコメント",
        },
        recentguestbooks: {
            ko: "최근 방명록",
            en: "Recent Guestbooks",
            ja: "最新のゲストブック",
        },
    };

    $effect(() => {
        // 1. 헤더 내비게이션 메뉴 자동 완성
        if (headerConfig && headerConfig.menuItems) {
            headerConfig.menuItems.forEach((item: any) => {
                if (!item.label) item.label = {};
                const val = item.label[activeLang];
                const isEmptyOrFallback =
                    val === undefined ||
                    val === null ||
                    val === "" ||
                    val === "Untitled" ||
                    val === "Link";
                if (isEmptyOrFallback) {
                    if (item.type === "category_drawer") {
                        item.label[activeLang] =
                            defaultNavLabels.category_drawer[activeLang] ||
                            "Categories";
                    } else if (
                        item.url === "/guestbook" ||
                        item.url === "guestbook"
                    ) {
                        item.label[activeLang] =
                            defaultNavLabels.guestbook[activeLang] ||
                            "Guestbook";
                    } else if (item.url === "/" || item.url === "") {
                        item.label[activeLang] =
                            defaultNavLabels.home[activeLang] || "Home";
                    } else if (item.url === "/posts" || item.url === "posts") {
                        item.label[activeLang] =
                            defaultNavLabels.posts[activeLang] || "Posts";
                    }
                }
            });
        }

        // 2. 로그인 라벨 자동 완성
        if (headerConfig && headerConfig.loginLabel) {
            const val = headerConfig.loginLabel[activeLang];
            const isEmptyOrFallback =
                val === undefined ||
                val === null ||
                val === "" ||
                val === "Untitled" ||
                val === "Login";
            if (isEmptyOrFallback) {
                headerConfig.loginLabel[activeLang] =
                    defaultNavLabels.login[activeLang] || "Login";
            }
        }

        // 3. 위젯 커스텀 타이틀 자동 완성
        if (activeColumnWidgets) {
            activeColumnWidgets.forEach((col: any) => {
                col.forEach((widget: any) => {
                    if (
                        widget.custom_title &&
                        typeof widget.custom_title === "object"
                    ) {
                        const val = widget.custom_title[activeLang];
                        const isEmptyOrFallback =
                            val === undefined ||
                            val === null ||
                            val === "" ||
                            val === "Untitled" ||
                            val === "커스텀 제목";
                        if (isEmptyOrFallback) {
                            const key = widget.type.toLowerCase();
                            widget.custom_title[activeLang] =
                                defaultWidgetLabels[key]?.[activeLang] ||
                                widget.name;
                        }
                    }
                });
            });
        }
    });

    let showLangDropdown = $state(false);

    // 한 줄 모드에서 로고와 내비게이션 정렬이 겹치는지 감지
    let isAlignmentConflict = $derived(
        headerConfig.headerLayout === "single-line" &&
            headerConfig.logoAlignment === headerConfig.navAlignment,
    );

    let navAlignVal = $derived(
        isAlignmentConflict
            ? headerConfig.logoAlignment === "right"
                ? "flex-start"
                : "flex-end"
            : headerConfig.navAlignment,
    );

    let navAlign = $derived(
        navAlignVal === "left"
            ? "flex-start"
            : navAlignVal === "center"
              ? "center"
              : "flex-end",
    );

    function toggleLangDropdown(e: MouseEvent) {
        e.stopPropagation();
        showLangDropdown = !showLangDropdown;
    }
</script>

<svelte:window
    onclick={() => {
        showLangDropdown = false;
    }}
/>

<section
    bind:this={previewAreaEl}
    class="preview-area"
    class:mobile={previewMode === "mobile"}
    onscroll={handleScroll}
>
    <div
        class="preview-window"
        style="
            --primary-color: {themeConfig.primary || '#3b82f6'};
            --secondary-color: {themeConfig.secondary || '#64748b'};
            --text-color: {themeConfig.text};
            --accent-color: {themeConfig.accent || '#10b981'};
            --border-color: {themeConfig.border || '#e2e8f0'};
            --surface-color: {themeConfig.cardBg};
            --max-width: {themeConfig.maxWidth};
            --side-margin: {themeConfig.sideMargin || '1.5rem'};
            --header-bottom-margin: {themeConfig.headerBodySpacing || '1rem'};
            --header-bottom-margin-mobile: {themeConfig.headerBodySpacingMobile ||
            '0.5rem'};
            --footer-top-margin: {themeConfig.bodyFooterSpacing || '1rem'};
            --footer-top-margin-mobile: {themeConfig.bodyFooterSpacingMobile ||
            '0.5rem'};
            position: relative;
            font-family: {themeConfig.fontFamily || 'Inter'}, sans-serif;
            font-size: {themeConfig.baseFontSize || '16px'};
            --base-font-size: {themeConfig.baseFontSize || '16px'};
            --mobile-base-font-size: {themeConfig.mobileBaseFontSize ||
            themeConfig.baseFontSize ||
            '16px'};
            color: var(--text-color);
            border: 1px solid var(--border-color);
            --header-radius: {getRadiusStyle(headerConfig.borderRadius)};
            --header-shadow: {headerConfig.boxShadow || 'none'};
            --header-border: {headerConfig.showBorderBottom === true
            ? '1px solid var(--border-color)'
            : 'none'};
            --footer-radius: {getRadiusStyle(footerConfig.borderRadius)};
            --footer-shadow: {footerConfig.boxShadow || 'none'};
            --widget-item-font-family: {themeConfig.widgetItemStyle
            .fontFamily || 'inherit'};
            --widget-item-padding: {themeConfig.widgetItemStyle.padding ||
            '1.5rem'};
            --widget-item-font-size: {themeConfig.widgetItemStyle.fontSize ||
            '0.95rem'};
            --widget-item-font-weight: {themeConfig.widgetItemStyle
            .fontWeight || '400'};
            --widget-item-color: {themeConfig.widgetItemStyle.color ||
            'inherit'};
            --widget-title-font-family: {themeConfig.widgetTitleStyle
            ?.fontFamily || 'inherit'};
            --widget-title-font-size: {themeConfig.widgetTitleStyle?.fontSize ||
            '1.1rem'};
            --widget-title-font-weight: {themeConfig.widgetTitleStyle
            ?.fontWeight || '700'};
            --widget-title-color: {themeConfig.widgetTitleStyle?.color ||
            'inherit'};
            --body-bg: {getBgValue(normalizedBodyBg)};
            --body-blur: {bodyBlur}px;
            --body-layer-blur: {bodyLayerBlur}px;
            --body-opacity: {bodyOpacity};
            --body-overlay-color: {normalizedBodyBg.overlayColor};
            --body-overlay-opacity: {normalizedBodyBg.overlayOpacity};
            --footer-bg: {getBgValue(normalizedFooterBg)};
            --footer-blur: {footerBlur}px;
            --footer-layer-blur: {footerLayerBlur}px;
            --footer-opacity: {footerOpacity};
            --footer-overlay-color: {normalizedFooterBg.overlayColor ||
            '#000000'};
            --footer-overlay-opacity: {normalizedFooterBg.overlayOpacity ?? 0};
            --footer-border: {footerConfig.showBorderTop !== false
            ? '1px solid var(--border-color)'
            : 'none'};
            --safe-side-margin: {safeMargins.side};
            --safe-side-margin-mobile: {safeMargins.sideMobile};
            --safe-top-margin: {safeMargins.top};
            --safe-top-margin-mobile: {safeMargins.topMobile};
        "
    >
        <!-- Body Background Layer -->
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
        <header
            class="blog-header"
            class:scrolled={isScrolled}
            style="
                --header-height: {headerConfig.height || '64px'};
                --scrolled-height: {headerConfig.scrolledHeight || '50px'};
                --header-bg: {getBgValue(normalizedHeaderBg)};
                --header-blur: {headerBlur}px;
                --header-layer-blur: {headerLayerBlur}px;
                --header-opacity: {headerOpacity};
                --header-overlay-color: {normalizedHeaderBg.overlayColor ||
                headerConfig.headerBackgroundOverlayColor ||
                '#000000'};
                --header-overlay-opacity: {normalizedHeaderBg.overlayOpacity ??
                headerConfig.headerBackgroundOverlayOpacity ??
                0};
                --logo-v-align: {currentLogoVAlign === 'top'
                ? 'flex-start'
                : currentLogoVAlign === 'bottom'
                  ? 'flex-end'
                  : 'center'};
                --nav-v-align: {headerConfig.navVerticalAlignment === 'top'
                ? 'flex-start'
                : headerConfig.navVerticalAlignment === 'bottom'
                  ? 'flex-end'
                  : 'center'};
                --fade-strength: {fadeStrength}px;
                --logo-center-top: {logoCenterTop};
                --logo-center-bottom: {logoCenterBottom};
                --logo-center-y-trans: {logoCenterYTrans};
                --min-header-height: {minHeaderHeight};
                --nav-align: {navAlign};
                --nav-gap: {headerConfig.navSpacing || '1.5rem'};
                --nav-text-color: {headerConfig.navTextColor || 'inherit'};
                --nav-hover-text: {headerConfig.navHoverTextColor ||
                'var(--primary-color)'};
                --nav-hover-bg: {getBgValue(headerConfig.navHoverBackground) ||
                'rgba(0,0,0,0.05)'};
                /* 스크롤 가변 디자인 패딩/간격 연동 */
                --logo-padding-top: {isScrolled
                ? (headerConfig.scrolledLogoPadding?.top ??
                  headerConfig.logoPadding?.top ??
                  0)
                : (headerConfig.logoPadding?.top ?? 0)}px;
                --logo-padding-bottom: {isScrolled
                ? (headerConfig.scrolledLogoPadding?.bottom ??
                  headerConfig.logoPadding?.bottom ??
                  0)
                : (headerConfig.logoPadding?.bottom ?? 0)}px;
            "
        >
            <div
                class="header-inner"
                class:logo-centered={currentLogoAlignment === "center" &&
                    !isTwoLine}
                class:logo-right={currentLogoAlignment === "right" &&
                    !isTwoLine}
                class:header-two-line={isTwoLine}
                class:fade-bottom={useBottomFade}
                style="
                    --header-side-margin: {headerConfig.sideMargin || '0px'};
                    --logo-align-self: {currentLogoAlignment === 'left'
                    ? 'flex-start'
                    : currentLogoAlignment === 'right'
                      ? 'flex-end'
                      : 'center'};
                "
            >
                <!-- Background Layer Container (Prevents overflow spill without clipping dropdown) -->
                <div class="header-background-wrapper">
                    <div class="header-backdrop-layer"></div>
                    {#if normalizedHeaderBg.type !== "js"}
                        <div class="header-visual-layer"></div>
                    {:else}
                        <DynamicBgRenderer
                            area="header"
                            code={normalizedHeaderBg.jsCode || ""}
                            config={normalizedHeaderBg.jsConfig || {}}
                            zIndex={2}
                            opacity={headerOpacity}
                            layerBlur={headerLayerBlur}
                            allowMobile={normalizedHeaderBg.allowMobile}
                            fallbackColor={normalizedHeaderBg.fallbackColor}
                        />
                    {/if}
                    <div class="header-overlay-layer"></div>
                </div>
                <a
                    href="/"
                    class="logo"
                    style="
                        --logo-hover-transform: {logoHoverTransform};
                        --logo-hover-color: {logoHoverColorVal};
                        --logo-hover-shadow: {logoHoverShadowVal};
                        font-family: {headerConfig.logoFont};
                        font-size: {headerConfig.logoFontSize};
                        padding: {currentLogoPadding.top}px {currentLogoPadding.right}px {currentLogoPadding.bottom}px {currentLogoPadding.left}px;
                        {headerConfig.logoColor?.type !== 'gradient'
                        ? getTextStyle(headerConfig.logoColor)
                        : 'display: inline-block !important;'}
                        {useTextShadow
                        ? 'text-shadow: 0 2px 4px rgba(0,0,0,0.15);'
                        : ''}
                        {isTwoLine
                        ? `; text-align: ${twoLineLogoTextAlign}; width: 100%; display: block;`
                        : ''}
                    "
                >
                    {#if headerConfig.logoColor?.type === "gradient"}
                        <span
                            style="
                            background: {headerConfig.logoColor?.value};
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                            color: transparent;
                            display: inline-block;
                            padding-bottom: 0.15em;
                            margin-bottom: -0.15em;
                        "
                        >
                            {getI18nText(headerConfig.logoText, activeLang) ||
                                "Logo"}
                        </span>
                    {:else}
                        {getI18nText(headerConfig.logoText, activeLang) ||
                            "Logo"}
                    {/if}
                </a>

                <div
                    class="header-right"
                    style="
                        --nav-align: {headerConfig.navAlignment === 'left'
                        ? 'flex-start'
                        : headerConfig.navAlignment === 'center'
                          ? 'center'
                          : 'flex-end'};
                    "
                >
                    {#if previewMode === "mobile"}
                        <!-- Mobile: hamburger menu icon -->
                        <nav
                            class="mobile-nav-preview"
                            style="
                            padding: {headerConfig.navPadding
                                .top}px {headerConfig.navPadding
                                .right}px {headerConfig.navPadding
                                .bottom}px {headerConfig.navPadding.left}px;
                        "
                        >
                            <button
                                class="hamburger-btn"
                                onclick={() =>
                                    (showMobileDrawer = !showMobileDrawer)}
                                aria-label={t("admin.theme.preview_menu_aria", {
                                    default: "메뉴",
                                })}
                            >
                                <span></span><span></span><span></span>
                            </button>
                        </nav>
                    {:else}
                        <!-- Desktop: full nav integrated with auth -->
                        <nav
                            class="desktop-nav"
                            style="
                            padding: {headerConfig.navPadding
                                .top}px {headerConfig.navPadding
                                .right}px {headerConfig.navPadding
                                .bottom}px {headerConfig.navPadding.left}px;
                            gap: {headerConfig.navSpacing || '1.5rem'};
                            align-items: var(--nav-v-align);
                        "
                        >
                            {#each rawHeaderConfig.menuItems || [] as item}
                                {#if item.type === "category_drawer"}
                                    <div
                                        class="category-toggle-btn inline-edit-wrapper"
                                        style="color: {headerConfig.navTextColor ||
                                            'inherit'}; {useTextShadow
                                            ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.15);'
                                            : ''}"
                                    >
                                        <FolderTree size={16} />
                                        <input
                                            type="text"
                                            class="inline-edit-input"
                                            bind:value={item.label[activeLang]}
                                            placeholder="Categories"
                                            style="color: inherit; width: {Math.max(
                                                75,
                                                (
                                                    getI18nText(
                                                        item.label,
                                                        activeLang,
                                                    ) || 'Categories'
                                                ).length *
                                                    9 +
                                                    18,
                                            )}px;"
                                        />
                                        <span
                                            class="arrow"
                                            style={useTextShadow
                                                ? "text-shadow: none;"
                                                : ""}>▼</span
                                        >
                                    </div>
                                {:else}
                                    <div
                                        class="inline-edit-wrapper"
                                        style="color: {headerConfig.navTextColor ||
                                            'inherit'}; {useTextShadow
                                            ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.15);'
                                            : ''}"
                                    >
                                        <input
                                            type="text"
                                            class="inline-edit-input"
                                            bind:value={item.label[activeLang]}
                                            placeholder={item.url ===
                                                "/guestbook" ||
                                            item.url === "guestbook"
                                                ? "Guestbook"
                                                : "Link"}
                                            style="color: inherit; width: {Math.max(
                                                60,
                                                (
                                                    getI18nText(
                                                        item.label,
                                                        activeLang,
                                                    ) || 'Link'
                                                ).length *
                                                    9 +
                                                    18,
                                            )}px;"
                                        />
                                    </div>
                                {/if}
                            {/each}

                            <!-- System Items Integration & Auth Group inside nav -->
                            <div class="auth-group">
                                {#if headerConfig.showLanguageSwitcher !== false}
                                    <div class="lang-switcher-wrapper">
                                        <button
                                            type="button"
                                            class="nav-link lang-preview"
                                            style="color: {headerConfig.navTextColor ||
                                                'inherit'}; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem;"
                                            onclick={toggleLangDropdown}
                                        >
                                            <Globe size={16} />
                                            <span
                                                >{languages.find(
                                                    (l) =>
                                                        l.code === activeLang,
                                                )?.name ||
                                                    activeLang.toUpperCase()}</span
                                            >
                                            <ChevronDown
                                                size={12}
                                                class="arrow-icon {showLangDropdown
                                                    ? 'rotated'
                                                    : ''}"
                                            />
                                        </button>

                                        {#if showLangDropdown && languages.length > 0}
                                            <div class="lang-dropdown-menu">
                                                {#each languages as lang}
                                                    <button
                                                        type="button"
                                                        class="lang-dropdown-item {activeLang ===
                                                        lang.code
                                                            ? 'active'
                                                            : ''}"
                                                        onclick={(e) => {
                                                            e.stopPropagation();
                                                            activeLang =
                                                                lang.code;
                                                            showLangDropdown = false;
                                                        }}
                                                    >
                                                        <span
                                                            class="lang-code-badge"
                                                            >{lang.code.toUpperCase()}</span
                                                        >
                                                        <span
                                                            class="lang-name-text"
                                                            >{lang.name}</span
                                                        >
                                                    </button>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}

                                <div
                                    class="login-link inline-edit-wrapper"
                                    style={useTextShadow
                                        ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                                        : ""}
                                >
                                    <input
                                        type="text"
                                        class="inline-edit-input login-input"
                                        bind:value={
                                            rawHeaderConfig.loginLabel[
                                                activeLang
                                            ]
                                        }
                                        placeholder="Login"
                                        style="width: {Math.max(
                                            50,
                                            (
                                                getI18nText(
                                                    headerConfig.loginLabel,
                                                    activeLang,
                                                ) || 'Login'
                                            ).length *
                                                9 +
                                                18,
                                        )}px;"
                                    />
                                </div>
                            </div>
                        </nav>
                    {/if}
                </div>
            </div>
        </header>

        <div class="blog-container">
            <div
                class="blog-body"
                style="grid-template-columns: {activeColumnWidths};"
            >
                {#each Array(activeColumnCount) as _, i}
                    <div
                        class="preview-column"
                        role="region"
                        aria-label={`Column ${i + 1}`}
                    >
                        <span class="col-label"
                            >{previewMode === "mobile" ? "📱 " : ""}Column {i +
                                1}</span
                        >
                        {#each activeColumnWidgets[i] || [] as widget (widget.id)}
                            <div
                                class="widget-preview"
                                style="background: var(--surface-color); border-color: var(--border-color); transition: box-shadow 0.2s ease; {getWidgetShadowStyle(
                                    widget,
                                )}"
                                data-widget-id={widget.id}
                                role="button"
                                tabindex="0"
                            >
                                <div class="widget-header">
                                    <div class="widget-title-edit">
                                        <h4 style="color: var(--text-color)">
                                            {widget.name}
                                        </h4>
                                        {#if widget.custom_title && typeof widget.custom_title === "object"}
                                            <input
                                                type="text"
                                                class="custom-title-input"
                                                placeholder={widget.name}
                                                bind:value={
                                                    widget.custom_title[
                                                        activeLang
                                                    ]
                                                }
                                            />
                                        {/if}
                                    </div>
                                    <button
                                        onclick={() =>
                                            activeRemoveFn(widget.id)}
                                        aria-label="Remove widget"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div class="widget-content">
                                    {#if widget.type === "RecentPosts" || widget.type === "recent_posts"}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_recent_posts_placeholder",
                                                {
                                                    default:
                                                        "여기에 최근 포스트 목록이 표시됩니다.",
                                                },
                                            )}
                                        </p>
                                    {:else if widget.type === "PostContent"}
                                        <div
                                            class="post-content-placeholder"
                                            style="border: 1px dashed var(--accent-color); padding: 2rem 1rem; color: var(--accent-color); text-align: center; transition: all 0.2s ease; {previewMode ===
                                            'desktop'
                                                ? 'min-height: 800px; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding-top: 5rem;'
                                                : 'min-height: 200px;'}"
                                        >
                                            <div
                                                style="margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem;"
                                            >
                                                {t(
                                                    "admin.theme.preview_post_content_title",
                                                    {
                                                        default:
                                                            "📝 게시글 본문 설정",
                                                    },
                                                )}
                                            </div>
                                            <div
                                                style="display: flex; gap: 0.5rem; justify-content: center;"
                                            >
                                                <button
                                                    class="device-config-btn"
                                                    onclick={() =>
                                                        openWidgetSettings(
                                                            widget,
                                                            previewMode as
                                                                | "desktop"
                                                                | "mobile",
                                                        )}
                                                >
                                                    {previewMode === "desktop"
                                                        ? t(
                                                              "admin.theme.preview_desktop_settings",
                                                              {
                                                                  default:
                                                                      "🖥️ 데스크탑 설정",
                                                              },
                                                          )
                                                        : t(
                                                              "admin.theme.preview_mobile_settings",
                                                              {
                                                                  default:
                                                                      "📱 모바일 설정",
                                                              },
                                                          )}
                                                </button>
                                            </div>
                                        </div>
                                    {:else if widget.type === "CategoryMenu"}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_categories_placeholder",
                                                {
                                                    default:
                                                        "전체 카테고리 목록이 표시됩니다.",
                                                },
                                            )}
                                        </p>
                                    {:else if widget.type === "category_link"}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_category_selected",
                                                {
                                                    category_slug:
                                                        widget.config
                                                            ?.category_slug ||
                                                        t(
                                                            "admin.theme.preview_not_selected",
                                                            {
                                                                default:
                                                                    "선택안됨",
                                                            },
                                                        ),
                                                },
                                            )}
                                        </p>
                                    {:else if widget.type === "HtmlWidget"}
                                        {@const configObj =
                                            typeof widget.config === "string"
                                                ? JSON.parse(widget.config)
                                                : widget.config}
                                        <HtmlWidget
                                            html={configObj?.html || ""}
                                            useShadowDom={configObj?.useShadowDom ??
                                                true}
                                        />
                                    {:else if widget.type === "TagCloud" || widget.type === "tag_cloud"}
                                        <div
                                            class="post-content-placeholder tag-cloud-placeholder"
                                            style="border: 1px dashed var(--accent-color); padding: 1rem; color: var(--accent-color); text-align: center; transition: all 0.2s ease;"
                                        >
                                            <div
                                                style="margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem;"
                                            >
                                                {t(
                                                    "admin.theme.preview_tag_cloud_title",
                                                    {
                                                        default:
                                                            "🏷️ 태그 클라우드 설정",
                                                    },
                                                )}
                                            </div>
                                            <div
                                                style="display: flex; gap: 0.5rem; justify-content: center;"
                                            >
                                                <button
                                                    class="device-config-btn"
                                                    onclick={() =>
                                                        openWidgetSettings(
                                                            widget,
                                                            previewMode as
                                                                | "desktop"
                                                                | "mobile",
                                                        )}
                                                >
                                                    {previewMode === "desktop"
                                                        ? t(
                                                              "admin.theme.preview_desktop_settings",
                                                              {
                                                                  default:
                                                                      "🖥️ 데스크탑 설정",
                                                              },
                                                          )
                                                        : t(
                                                              "admin.theme.preview_mobile_settings",
                                                              {
                                                                  default:
                                                                      "📱 모바일 설정",
                                                              },
                                                          )}
                                                </button>
                                            </div>
                                        </div>
                                    {:else if widget.type === "RecentComments"}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_recent_comments_placeholder",
                                            ) ||
                                                "여기에 최근 댓글 목록이 표시됩니다."}
                                        </p>
                                    {:else if widget.type === "RecentGuestbooks"}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_recent_guestbooks_placeholder",
                                            ) ||
                                                "여기에 최근 방명록 목록이 표시됩니다."}
                                        </p>
                                    {:else}
                                        <p
                                            style="color: var(--secondary-color)"
                                        >
                                            {t(
                                                "admin.theme.preview_widget_type",
                                                { type: widget.type },
                                            )}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>

        <footer class="blog-footer">
            <div
                class="footer-inner"
                style="color: {footerConfig.text?.color || 'inherit'};
                font-size: {footerConfig.text?.fontSize || 'inherit'};
                border-radius: var(--footer-radius);
                box-shadow: var(--footer-shadow);
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
                <p>{@html getI18nText(footerConfig.copyright, activeLang)}</p>
            </div>
        </footer>

        <!-- 가상 모바일 드로어 오버레이 -->
        {#if showMobileDrawer && previewMode === "mobile"}
            <div
                class="mobile-drawer-overlay"
                onclick={() => (showMobileDrawer = false)}
            >
                <div
                    class="mobile-drawer-content"
                    onclick={(e) => e.stopPropagation()}
                >
                    <div class="drawer-header">
                        <span class="drawer-title"
                            >{getI18nText(headerConfig.logoText, activeLang) ||
                                "Menu"}</span
                        >
                        <button
                            type="button"
                            class="close-btn"
                            onclick={() => (showMobileDrawer = false)}
                            aria-label="Close menu"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div class="drawer-body">
                        <!-- 가상 로그인/프로필 섹션 -->
                        <div class="user-section">
                            <div class="login-promo">
                                <div class="promo-icon">
                                    <LogIn size={20} />
                                </div>
                                <span
                                    >{getI18nText(
                                        headerConfig.loginLabel,
                                        activeLang,
                                    ) || "Login"}</span
                                >
                                <ChevronRight size={16} />
                            </div>
                        </div>

                        <div class="drawer-section">
                            <h5 class="section-title">
                                {t("admin.theme.menu", { default: "Menu" })}
                            </h5>
                            <div class="drawer-menu-list">
                                {#each headerConfig.menuItems || [] as item}
                                    {#if item.type === "category_drawer" && categories.length > 0}
                                        <div class="drawer-category-wrapper">
                                            <div
                                                class="drawer-category-title-bar"
                                            >
                                                <FolderTree size={16} />
                                                <span
                                                    >{getI18nText(
                                                        item.label,
                                                        activeLang,
                                                    ) || "Categories"}</span
                                                >
                                            </div>
                                            <div
                                                class="drawer-categories-sublist"
                                            >
                                                {#each categories.filter((c) => c.lang === activeLang) as category}
                                                    <div
                                                        class="drawer-category-item"
                                                    >
                                                        <span class="cat-name"
                                                            >{category.name ||
                                                                category.slug}</span
                                                        >
                                                        <span
                                                            class="count-badge"
                                                            >{category.postCount ||
                                                                0}</span
                                                        >
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {:else if item.type !== "category_drawer"}
                                        <div class="drawer-menu-link">
                                            <span
                                                >{getI18nText(
                                                    item.label,
                                                    activeLang,
                                                ) || "Link"}</span
                                            >
                                            <ChevronRight size={16} />
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        </div>

                        <!-- 다국어 칩 링커 섹션 -->
                        {#if headerConfig.showLanguageSwitcher !== false && languages.length > 1}
                            <div class="drawer-section">
                                <h5 class="section-title">
                                    <Globe
                                        size={16}
                                        style="margin-right: 4px; vertical-align: middle;"
                                    />
                                    <span
                                        >{t("admin.theme.select_lang", {
                                            default: "언어 선택",
                                        })}</span
                                    >
                                </h5>
                                <div class="drawer-lang-chips">
                                    {#each languages as lang}
                                        <button
                                            type="button"
                                            class="lang-chip-btn"
                                            class:active={activeLang ===
                                                lang.code}
                                            onclick={() =>
                                                (activeLang = lang.code)}
                                        >
                                            {lang.name}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                    <!-- 가상 드로어 푸터 -->
                    <div class="drawer-footer">
                        <button
                            class="btn-full"
                            onclick={() => (showMobileDrawer = false)}
                        >
                            {t("admin.theme.close", { default: "닫기" })}
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</section>

<style>
    /* Copied Styles from +page.svelte for Preview Area */
    .preview-area {
        flex: 1;
        background: #cbd5e1;
        padding: 3rem;
        overflow-y: auto;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        transition: padding 0.3s;
    }

    .preview-window {
        background: white;
        isolation: isolate;
        width: 100%;
        max-width: 1200px;
        min-height: 800px;
        height: auto;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        transition: all 0.3s;
        transform-origin: top center;
    }

    .preview-area.dragging .preview-window,
    .preview-area.dragging {
        transition: none !important;
    }

    .preview-area.mobile .preview-window {
        width: 375px;
        min-height: 667px;
        --base-font-size: var(--mobile-base-font-size, 16px) !important;
        font-size: var(--mobile-base-font-size, 16px) !important;
    }

    /* 모바일 미리보기 환경에서 헤더가 로고 폰트크기 + 3px 마진 + 패딩만큼 알아서 유연하게 늘어나도록 설정 */
    .preview-area.mobile .blog-header {
        min-height: 50px;
        height: var(--header-height, auto);
    }
    .preview-area.mobile .header-inner {
        min-height: 50px;
        height: 100%;
        padding: 8px var(--side-margin);
        box-sizing: border-box;
        max-width: 100% !important;
        width: calc(100% - 2 * var(--safe-side-margin-mobile, 0px)) !important;
        margin: var(--safe-top-margin-mobile, 0px) auto 0 !important;
    }
    .preview-area.mobile .logo {
        align-self: center !important;
        margin-bottom: 3px !important;
    }

    .blog-header {
        width: 100%;
        height: max(var(--header-height), var(--min-header-height));
        background: transparent;
        z-index: 1000;
        display: flex;
        align-items: center;
        position: sticky;
        top: 0;
    }

    .blog-header.scrolled {
        height: max(
            var(--scrolled-height),
            var(--min-header-height)
        ) !important;
    }

    .header-inner {
        max-width: var(--max-width);
        width: calc(100% - 2 * var(--safe-side-margin, 0px)) !important;
        margin: var(--safe-top-margin, 0px) auto 0 !important;
        padding: 0.5rem var(--side-margin);
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: stretch; /* Stretch for align-self */
        height: 100%;
        position: relative;
        border-radius: var(--header-radius);
        box-shadow: var(--header-shadow);
        border-bottom: var(--header-border, none);
    }

    .header-background-wrapper {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: var(--header-radius);
        overflow: hidden;
        pointer-events: none;
    }

    .footer-background-wrapper {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: var(--footer-radius);
        overflow: hidden;
        pointer-events: none;
    }

    .header-backdrop-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        backdrop-filter: blur(var(--header-blur, 0px));
        -webkit-backdrop-filter: blur(var(--header-blur, 0px));
        pointer-events: none;
    }

    .header-visual-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        background: var(--header-bg, transparent);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: var(--header-opacity, 1);
        filter: blur(var(--header-layer-blur, 0px));
        transform: scale(calc(1 + var(--header-layer-blur, 0) * 0.01));
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    .header-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--header-overlay-color);
        opacity: var(--header-overlay-opacity, 0);
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    .body-backdrop-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        backdrop-filter: blur(var(--body-blur, 0px));
        -webkit-backdrop-filter: blur(var(--body-blur, 0px));
        pointer-events: none;
    }

    .body-visual-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        background: var(--body-bg, transparent);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: var(--body-opacity, 1);
        filter: blur(var(--body-layer-blur, 0px));
        transform: scale(calc(1 + var(--body-layer-blur, 0) * 0.01));
        pointer-events: none;
    }

    .body-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--body-overlay-color);
        opacity: var(--body-overlay-opacity, 0);
        pointer-events: none;
        transition: opacity 0.3s ease;
    }

    .body-background-wrapper {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
        border-radius: inherit;
    }

    .footer-backdrop-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        backdrop-filter: blur(var(--footer-blur, 0px));
        -webkit-backdrop-filter: blur(var(--footer-blur, 0px));
        pointer-events: none;
    }

    .footer-visual-layer {
        position: absolute;
        inset: 0;
        z-index: 2;
        background: var(--footer-bg, transparent);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: var(--footer-opacity, 1);
        filter: blur(var(--footer-layer-blur, 0px));
        transform: scale(calc(1 + var(--footer-layer-blur, 0) * 0.01));
        pointer-events: none;
    }

    .footer-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--footer-overlay-color);
        opacity: var(--footer-overlay-opacity, 0);
        pointer-events: none;
        transition: opacity 0.3s ease;
    }

    .header-inner.fade-bottom {
        mask-image: linear-gradient(
            to bottom,
            black calc(100% - var(--fade-strength, 20px)),
            transparent 100%
        );
        -webkit-mask-image: linear-gradient(
            to bottom,
            black calc(100% - var(--fade-strength, 20px)),
            transparent 100%
        );
    }

    .header-inner.logo-centered .logo {
        position: absolute;
        left: 50%;
        top: var(--logo-center-top, 50%);
        bottom: var(--logo-center-bottom, auto);
        transform: translate(-50%, var(--logo-center-y-trans, -50%));
        margin: 0 !important;
    }

    .header-inner.logo-right {
        flex-direction: row-reverse;
    }

    .header-inner.logo-right .header-right {
        margin-left: 0;
        margin-right: 0;
        flex: 1;
    }

    .header-right {
        display: flex;
        align-items: var(--nav-v-align, center);
        flex: 1;
        height: 100%;
    }

    .logo {
        font-weight: 800;
        text-decoration: none;
        color: var(--primary-color);
        white-space: nowrap;
        display: flex;
        align-items: center;
        align-self: var(--logo-v-align, center);
        position: relative;
        z-index: 1005;
        max-height: 100% !important;
        box-sizing: border-box !important;

        /* GPU 격리 및 스프링 감속 트랜지션 내장 */
        will-change: transform, color, text-shadow;
        transition:
            transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            color 0.3s ease,
            text-shadow 0.3s ease;
    }

    /* 호버 시 외부(인라인)에서 주입되는 변수만 적용되도록 연동 */
    .logo:hover {
        transform: var(--logo-hover-transform, none) !important;
        color: var(--logo-hover-color, inherit) !important;
        filter: drop-shadow(
            var(--logo-hover-shadow, 0 0 0 transparent)
        ) !important;
    }

    /* 호버 색상이 그라데이션일 때 내부 텍스트 span 클리핑 페이드 연동 */
    .logo:hover span {
        background: var(--logo-hover-color, inherit) !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
    }

    /* 중앙정렬 로고의 호버 오프셋 앵커 축 변형 대입 규칙 1세트 */
    .header-inner.logo-centered .logo:hover {
        transform: translate(-50%, var(--logo-center-y-trans, -50%))
            var(--logo-hover-transform, scale(1)) !important;
        filter: drop-shadow(
            var(--logo-hover-shadow, 0 0 0 transparent)
        ) !important;
    }

    /* --- 우측 영역 & 내비게이션 & 로그인 그룹 정렬 --- */
    .header-right {
        display: flex;
        align-items: var(--nav-v-align, center);
        flex: 1;
        height: 100%;
        position: relative;
        justify-content: var(--nav-align, flex-end);
    }
    .desktop-nav {
        display: flex;
        gap: clamp(0.5rem, 1.5vw, 1.5rem);
        align-items: var(--nav-v-align, center);
        height: 100%;
        flex: 1;
        justify-content: var(--nav-align, flex-end);
        flex-wrap: wrap;
    }
    .auth-group {
        display: flex;
        align-items: var(--nav-v-align, center);
        gap: 0.8rem;
    }

    /* --- 한 줄 모드: 로고 정중앙 정렬 시 --- */
    .header-inner.logo-centered .header-right {
        justify-content: var(--nav-align, flex-end);
    }
    .header-inner.logo-centered .desktop-nav {
        justify-content: var(--nav-align, flex-end);
    }

    /* --- 두 줄 모드: 로고 1줄 + 내비/Auth 2줄 배치 --- */
    .header-inner.header-two-line {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: center !important;
        height: auto !important;
        gap: 0.75rem !important;
    }
    .header-inner.header-two-line .logo {
        position: static !important;
        align-self: var(--logo-align-self, center) !important;
        margin: 0 !important;
    }
    .header-inner.header-two-line .header-right {
        width: 100% !important;
        display: flex !important;
        justify-content: var(--nav-align, flex-end) !important;
        flex: none !important;
        position: relative !important;
    }
    .header-inner.header-two-line .desktop-nav {
        justify-content: var(--nav-align, flex-end);
        flex: 1;
        height: auto;
    }

    .desktop-nav a,
    .desktop-nav :global(.nav-link) {
        text-decoration: none;
        color: var(--text-color);
        font-weight: 600;
        font-size: clamp(
            calc(var(--base-font-size) * 0.82),
            1.1vw,
            calc(var(--base-font-size) * 0.95)
        ) !important;
    }

    .category-toggle-btn {
        background: transparent;
        border: none;
        color: var(--text-color);
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    /* Mobile nav preview: hamburger */
    .mobile-nav-preview {
        display: flex;
        align-items: var(--nav-v-align, center);
        height: 100%;
    }
    .hamburger-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        justify-content: center;
    }
    .hamburger-btn span {
        display: block;
        width: 22px;
        height: 2px;
        background: var(--text-color, #1e293b);
        border-radius: 2px;
    }

    .arrow {
        font-size: 0.6rem;
        opacity: 0.5;
    }

    .lang-switcher-wrapper {
        position: relative;
        display: inline-block;
    }

    .lang-preview {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0.4rem 0.6rem;
        border-radius: 6px;
        transition: all 0.2s ease;
    }

    .lang-preview:hover {
        background: rgba(15, 23, 42, 0.05);
    }

    .arrow-icon {
        transition: transform 0.2s ease;
    }

    .arrow-icon.rotated {
        transform: rotate(180deg);
    }

    /* Glassmorphism Premium Dropdown */
    .lang-dropdown-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 12px;
        box-shadow:
            0 10px 25px -5px rgba(0, 0, 0, 0.1),
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 150px;
        z-index: 1100;
        animation: slideDownFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideDownFade {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .lang-dropdown-item {
        background: transparent;
        border: none;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
        color: #334155;
    }

    .lang-dropdown-item:hover {
        background: rgba(15, 23, 42, 0.04);
        color: #0f172a;
    }

    .lang-dropdown-item.active {
        background: var(--primary-color, #3b82f6);
        color: white;
    }

    .lang-dropdown-item.active .lang-code-badge {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-color: rgba(255, 255, 255, 0.3);
    }

    .lang-code-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
        text-align: center;
        min-width: 28px;
    }

    .lang-name-text {
        font-size: 0.85rem;
        font-weight: 500;
    }

    .auth-group {
        display: flex;
        align-items: var(--nav-v-align, center);
        gap: 0.8rem;
    }

    .login-link {
        background: var(--primary-color);
        color: white;
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* Premium Inline Editing Styles */
    .inline-edit-wrapper {
        display: inline-flex;
        align-items: center;
        position: relative;
        gap: 0.25rem;
    }

    .inline-edit-input {
        background: transparent;
        border: 1px dashed transparent;
        border-radius: 4px;
        padding: 0.15rem 0.3rem;
        font-size: inherit;
        font-family: inherit;
        font-weight: inherit;
        color: inherit;
        text-align: center;
        outline: none;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .inline-edit-input:hover {
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.05);
        cursor: text;
    }

    .inline-edit-input:focus {
        border-color: var(--primary-color, #3b82f6);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        color: #0f172a !important;
        text-shadow: none !important;
    }

    .login-link.inline-edit-wrapper {
        padding: 0.25rem 0.5rem;
    }

    .login-input {
        color: white !important;
        font-weight: 600;
    }

    .login-input:focus {
        color: #0f172a !important;
    }

    .blog-container {
        max-width: var(--max-width);
        margin: var(--header-bottom-margin, 1rem) auto
            var(--footer-top-margin, 1rem);
        padding: 0 var(--side-margin);
        width: 100%;
        box-sizing: border-box;
    }

    .preview-area.mobile .blog-container {
        margin-top: var(--header-bottom-margin-mobile, 0.5rem);
        margin-bottom: var(--footer-top-margin-mobile, 0.5rem);
    }

    .header-inner {
        max-width: var(--max-width);
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
    }

    .footer-inner {
        max-width: var(--max-width);
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        padding: 2rem;
        text-align: center;
        border-top: var(--footer-border, 1px solid var(--border-color));
        color: var(--secondary-color);
        font-size: 0.875rem;
    }

    .blog-body {
        flex: 1;
        padding: 2rem 0;
        display: grid;
        gap: 2rem;
    }

    .preview-column {
        border: 2px dashed var(--border-color);
        border-radius: 1rem;
        padding: 1rem;
        min-height: 200px;
        position: relative;
    }

    .col-label {
        position: absolute;
        top: -0.75rem;
        left: 1rem;
        background: var(--surface-color);
        padding: 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--secondary-color);
    }

    .widget-preview {
        padding: 1.25rem;
        border: 1px solid var(--border-color);
        border-radius: 0.75rem;
        margin-bottom: 1.5rem;
        box-shadow: var(
            --widget-normal-shadow,
            0 4px 6px -1px rgba(0, 0, 0, 0.1)
        );
        transition:
            box-shadow 0.3s ease,
            transform 0.3s ease;
    }
    .widget-preview:hover {
        border-color: var(--accent-color);
        box-shadow: var(
            --widget-hover-shadow,
            var(--widget-normal-shadow, none)
        );
        transform: translateY(var(--widget-hover-translate-y, -2px));
    }

    .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .widget-header h4 {
        margin: 0;
        font-family: var(--widget-title-font-family);
        font-size: var(--widget-title-font-size);
        font-weight: var(--widget-title-font-weight);
        color: var(--widget-title-color);
    }

    .widget-content {
        font-family: var(--widget-item-font-family);
        font-size: var(--widget-item-font-size);
        font-weight: var(--widget-item-font-weight);
        color: var(--widget-item-color);
    }

    .widget-header button {
        background: transparent;
        border: none;
        color: var(--secondary-color);
        cursor: pointer;
        padding: 0.25rem;
    }

    .widget-header button:hover {
        color: #ef4444;
    }

    .blog-footer {
        padding: 2rem 0;
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
        font-family: var(--widget-title-font-family, inherit);
        font-size: var(--widget-title-font-size, 1.1rem);
        font-weight: var(--widget-title-font-weight, 700);
        color: var(--widget-title-color, var(--secondary-color));
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        background: var(--surface-color);
        box-sizing: border-box;
    }

    .post-content-placeholder {
        background: rgba(59, 130, 246, 0.05);
        border-radius: 0.5rem;
        font-weight: 600;
        font-size: 0.875rem;
    }
    .post-content-placeholder:hover,
    .tag-cloud-placeholder:hover {
        background: rgba(59, 130, 246, 0.1);
        transform: scale(0.98);
    }
    .hover-underline:hover {
        text-decoration: underline;
    }

    .device-config-btn {
        padding: 0.4rem 0.8rem;
        border: 1px solid var(--accent-color, #10b981);
        background: rgba(16, 185, 129, 0.08);
        color: var(--accent-color, #10b981);
        border-radius: 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }
    .device-config-btn:hover {
        background: var(--accent-color, #10b981);
        color: #fff;
    }

    /* 모바일 가상 드로어 스타일 */
    .mobile-drawer-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        z-index: 2000;
        display: flex;
        justify-content: flex-end;
        flex-direction: row;
        overflow: hidden;
        animation: drawerFadeIn 0.2s ease-out;
    }

    .mobile-drawer-content {
        background: white;
        border-top-left-radius: 1rem;
        border-bottom-left-radius: 1rem;
        border-top-right-radius: 0px;
        padding: 1.5rem;
        height: 100%;
        width: 85%;
        max-width: 320px;
        max-height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        box-shadow: -4px 0 15px rgba(0, 0, 0, 0.15);
        animation: drawerSlideLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .drawer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 0.75rem;
    }

    .drawer-title {
        font-weight: 700;
        font-size: 1.1rem;
        color: #0f172a;
    }

    .close-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .drawer-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .section-title {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin: 0;
        font-weight: 700;
    }

    .drawer-categories-list,
    .drawer-menu-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .dummy-category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        color: #334155;
        font-weight: 500;
    }

    .user-section {
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 1rem;
    }
    .login-promo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: rgba(59, 130, 246, 0.05);
        border: 1px solid rgba(59, 130, 246, 0.1);
        border-radius: 0.75rem;
        text-decoration: none;
        color: var(--primary-color, #3b82f6);
        font-weight: 600;
        font-size: 0.9rem;
    }
    .promo-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.1);
        color: var(--primary-color, #3b82f6);
    }
    .login-promo span {
        flex: 1;
    }

    .drawer-lang-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .lang-chip-btn {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #475569;
        padding: 0.4rem 0.8rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .lang-chip-btn:hover {
        background: #e2e8f0;
    }
    .lang-chip-btn.active {
        background: var(--primary-color, #3b82f6);
        border-color: var(--primary-color, #3b82f6);
        color: white;
    }

    .drawer-menu-link {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        color: #334155;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .drawer-menu-link:hover {
        background: #f1f5f9;
        color: #0f172a;
    }

    .drawer-category-wrapper {
        border: 1px solid #f1f5f9;
        border-radius: 0.5rem;
        overflow: hidden;
    }
    .drawer-category-title-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.9rem;
        font-weight: 600;
        color: #475569;
    }
    .drawer-categories-sublist {
        display: flex;
        flex-direction: column;
        background: white;
    }
    .drawer-category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.6rem 1rem 0.6rem 2.25rem;
        border-bottom: 1px solid #f8fafc;
        font-size: 0.85rem;
        color: #475569;
    }
    .drawer-category-item:last-child {
        border-bottom: none;
    }

    .drawer-footer {
        border-top: 1px solid #f1f5f9;
        padding-top: 1rem;
        margin-top: auto;
    }
    .btn-full {
        width: 100%;
        padding: 0.75rem;
        background: #f1f5f9;
        border: none;
        border-radius: 0.5rem;
        color: #475569;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-full:hover {
        background: #e2e8f0;
    }

    .count-badge {
        font-size: 0.75rem;
        background: #e2e8f0;
        color: #475569;
        padding: 0.1rem 0.4rem;
        border-radius: 9999px;
        font-weight: 700;
    }

    @keyframes drawerFadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes drawerSlideLeft {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(0);
        }
    }
</style>
