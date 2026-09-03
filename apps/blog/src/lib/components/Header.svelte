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
        Menu,
        X,
        User,
        LogIn,
        ChevronRight,
        ChevronDown,
        Hash,
        FolderTree,
        Globe,
    } from "lucide-svelte";
    import { fade, slide, fly } from "svelte/transition";
    import DynamicBgRenderer from "./DynamicBgRenderer.svelte";
    import { page } from "$app/stores";
    import { t } from "$lib/i18n";
    import {
        normalizeBackground,
        getBgValue,
        getBgStyle,
    } from "$lib/utils/background";
    import { onMount, untrack } from "svelte";

    let {
        settings,
        user,
        categories = [],
        navIconSvgs = {},
        isMobile: initialIsMobile = false,
    }: {
        settings: any;
        user: any;
        categories?: any[];
        navIconSvgs?: Record<string, string>;
        isMobile?: boolean;
    } = $props();

    let baseHeader = $derived(settings?.header || {});
    let theme = $derived(settings?.theme || {});
    // 레이아웃 설정은 항상 데스크탑 기준값(baseHeader)을 사용합니다.
    // 모바일 전용 값들은 <header style=""> 에 선언된 CSS 커스텀 프로퍼티와
    // @media (max-width: 768px) 쿼리로 처리하여 CLS 및 CDN 캐싱 안정성을 확보합니다.
    let header = $derived(baseHeader);
    const dbDefaultLang = $derived($page.data.dbDefaultLang || "ko");
    let lang = $derived($page.data.lang || dbDefaultLang);
    let logoTextRaw = $derived(
        header.logoText || settings.site_title || "Blog",
    );
    let logoText = $derived(
        typeof logoTextRaw === "object" && logoTextRaw !== null
            ? logoTextRaw[lang] ||
                  logoTextRaw[dbDefaultLang] ||
                  Object.values(logoTextRaw)[0] ||
                  "Blog"
            : logoTextRaw,
    );

    let isScrolled = $state(false);
    // 레이아웃에 직접적인 영향을 주는 isMobile 상태 제거 (CSS 미디어 쿼리가 대체)
    let sensorEl = $state<HTMLDivElement | null>(null);

    onMount(() => {
        // 정적 HTML과 동적 Auth 영역의 DOM 구조를 일치시킵니다.
        const authGroup = document.getElementById("auth-group-portal");
        const navContainer = document.querySelector(".header-inner .header-nav");
        if (authGroup && navContainer) {
            navContainer.appendChild(authGroup);
        }

        if (!sensorEl) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                isScrolled = !entry.isIntersecting;
            },
            { root: null, threshold: 0 },
        );

        observer.observe(sensorEl);
        return () => observer.disconnect();
    });

    // 화면 크기 반응형 감지 제거

    let isMenuOpen = $state(false);
    let openDropdownId = $state<number | string | null>(null);
    let dropdownX = $state(0);
    let dropdownY = $state(0);
    let drawerMode = $state<"full" | "categories-only">("full");
    let isLangMenuOpen = $state(false);

    function toggleMenu(mode: "full" | "categories-only" = "full") {
        drawerMode = mode;
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }

    function closeMenu() {
        isMenuOpen = false;
        document.body.style.overflow = "";
    }

    function toggleCategoryDropdown(e: MouseEvent, id: number | string) {
        e.stopPropagation();
        openDropdownId = openDropdownId === id ? null : id;
    }

    // Close dropdown on outside click & handle static HTML click delegation
    $effect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const toggleBtn = target.closest(".category-toggle");
            
            if (toggleBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = toggleBtn.getAttribute("data-dropdown-id");
                if (id) {
                    if (openDropdownId === id) {
                        openDropdownId = null;
                    } else {
                        openDropdownId = id;
                        const rect = toggleBtn.getBoundingClientRect();
                        const headerInner = document.querySelector(".header-inner");
                        if (headerInner) {
                            const headerRect = headerInner.getBoundingClientRect();
                            dropdownX = rect.left - headerRect.left;
                            dropdownY = rect.bottom - headerRect.top;
                        } else {
                            dropdownX = rect.left;
                            dropdownY = rect.bottom;
                        }
                    }
                }
            } else {
                openDropdownId = null;
                isLangMenuOpen = false;
            }
        };
        if (typeof window !== "undefined") {
            window.addEventListener("click", handleOutsideClick);
            return () =>
                window.removeEventListener("click", handleOutsideClick);
        }
    });

    let langPrefix = $derived($page.params.lang ? `/${$page.params.lang}` : "");

    function processUrl(url: string) {
        if (!url || url === "#") return url;
        if (url.startsWith("http") || url.startsWith("mailto:")) return url;
        if (url === "/") return langPrefix || "/";
        return url.startsWith("/")
            ? `${langPrefix}${url}`
            : `${langPrefix}/${url}`;
    }

    function ensureMenuItemStructure(items: any) {
        if (typeof items === "string") {
            try {
                items = JSON.parse(items);
            } catch {
                // ignore error, will fall through to array check
            }
        }

        if (!items || !Array.isArray(items)) {
            return [
                {
                    id: 1,
                    type: "link",
                    label: "blog.nav.home",
                    url: processUrl("/"),
                    icon: "Home",
                },
                {
                    id: "legacy-cats",
                    type: "category_drawer",
                    label: "blog.nav.category",
                    url: "#",
                    icon: "FolderTree",
                },
                {
                    id: 3,
                    type: "link",
                    label: "blog.nav.guestbook",
                    url: processUrl("/guestbook"),
                    icon: "MessageSquare",
                },
            ];
        }

        return items
            .map((item, index) => {
                if (typeof item === "string") {
                    return {
                        id: Date.now() + index,
                        type: "link",
                        label: $t(item, { default: item }),
                        url: processUrl("/"),
                        icon: "Link",
                    };
                }
                if (typeof item !== "object" || !item) return null;

                let resolvedLabel = "Untitled";
                if (typeof item.label === "object" && item.label !== null) {
                    resolvedLabel =
                        item.label[lang] ||
                        item.label["ko"] ||
                        Object.values(item.label)[0] ||
                        "Untitled";
                } else if (typeof item.label === "string") {
                    resolvedLabel = $t(item.label, { default: item.label });
                }

                return {
                    id: item.id || Date.now() + index,
                    type: item.type || "link",
                    label: resolvedLabel,
                    url: processUrl(item.url || "/"),
                    icon:
                        item.icon ||
                        (item.type === "category_drawer" ? "Menu" : "Link"),
                };
            })
            .filter(Boolean);
    }

    // 데스크탑 전용 메뉴 데이터
    let desktopNav = $derived(ensureMenuItemStructure(header.menuItems) as any[]);
    // 모바일 전용 메뉴 데이터 (어드민에 모바일 메뉴가 지정되었으면 모바일용 사용, 없으면 데스크탑용 메뉴 사용)
    let mobileNav = $derived(
        ensureMenuItemStructure(
            baseHeader.mobile?.menuItems && baseHeader.mobile.menuItems.length > 0
                ? baseHeader.mobile.menuItems
                : baseHeader.menuItems
        ) as any[]
    );

    // 스크롤 여부에 따른 로고 정렬 및 패딩 가변 상태 derived 정의
    // isMobile 의존 제거: 모바일 전환은 CSS @media 쿼리로 처리
    let isMobileDevice = $derived(initialIsMobile);

    let currentLogoAlignment = $derived(
        (isScrolled || isMobileDevice)
            ? header.scrolledLogoAlignment || "left"
            : header.logoAlignment || "left",
    );

    let currentLogoVAlign = $derived(
        (isScrolled || isMobileDevice)
            ? header.scrolledLogoVerticalAlignment || "middle"
            : header.logoVerticalAlignment || "middle",
    );

    let logoVAlign = $derived(
        currentLogoVAlign === "top"
            ? "flex-start"
            : currentLogoVAlign === "bottom"
              ? "flex-end"
              : "center",
    );
    let currentNavAlignment = $derived(
        (isScrolled || isMobileDevice)
            ? header.scrolledNavAlignment || "right"
            : header.navAlignment || "right",
    );

    let currentNavVAlign = $derived(
        (isScrolled || isMobileDevice)
            ? header.scrolledNavVerticalAlignment || "middle"
            : header.navVerticalAlignment || "middle",
    );

    // 한 줄 모드에서 로고와 내비게이션 정렬 설정이 겹치는지 감지
    let isAlignmentConflict = $derived(
        header.headerLayout === "single-line" &&
        currentLogoAlignment === currentNavAlignment
    );

    let navAlign = $derived(
        isAlignmentConflict
            ? (currentLogoAlignment === "right" ? "flex-start" : "flex-end")
            : (currentNavAlignment === "left"
                ? "flex-start"
                : currentNavAlignment === "center"
                  ? "center"
                  : "flex-end")
    );

    let navVAlign = $derived(
        currentNavVAlign === "top"
            ? "flex-start"
            : currentNavVAlign === "bottom"
              ? "flex-end"
              : "center",
    );

    // 스크롤 및 모바일 상태에 따른 로고 패딩 연산 (모바일은 항상 scrolled 패딩으로 폴백 제공)
    let currentLogoPadding = $derived(
        (isScrolled || isMobileDevice)
            ? {
                  top: header.scrolledLogoPadding?.top ?? header.logoPadding?.top ?? 0,
                  right: header.scrolledLogoPadding?.right ?? header.logoPadding?.right ?? 0,
                  bottom: header.scrolledLogoPadding?.bottom ?? header.logoPadding?.bottom ?? 0,
                  left: header.scrolledLogoPadding?.left ?? header.logoPadding?.left ?? 0
              }
            : {
                  top: header.logoPadding?.top ?? 0,
                  right: header.logoPadding?.right ?? 0,
                  bottom: header.logoPadding?.bottom ?? 0,
                  left: header.logoPadding?.left ?? 0
              }
    );

    // 스크롤 및 모바일 상태에 따른 네비게이션 패딩/간격 연산
    let currentNavPadding = $derived(
        (isScrolled || isMobileDevice)
            ? {
                  top: header.scrolledNavPadding?.top ?? header.navPadding?.top ?? 0,
                  right: header.scrolledNavPadding?.right ?? header.navPadding?.right ?? 0,
                  bottom: header.scrolledNavPadding?.bottom ?? header.navPadding?.bottom ?? 0,
                  left: header.scrolledNavPadding?.left ?? header.navPadding?.left ?? 0
              }
            : {
                  top: header.navPadding?.top ?? 0,
                  right: header.navPadding?.right ?? 0,
                  bottom: header.navPadding?.bottom ?? 0,
                  left: header.navPadding?.left ?? 0
              }
    );

    let currentNavSpacing = $derived(
        (isScrolled || isMobileDevice)
            ? header.scrolledNavSpacing || header.navSpacing || "1.5rem"
            : header.navSpacing || "1.5rem"
    );

    let logoStyle = $derived(
        (() => {
            let styles = [
                `font-family: ${header.logoFont || "inherit"}`,
                `font-size: ${header.logoFontSize || "1.5rem"}`,
                `font-weight: ${header.logoFontWeight || "700"}`,
                `letter-spacing: ${header.logoLetterSpacing || "0px"}`,
            ];

            const color = header.logoColor || { type: "solid", value: "" };
            if (color.type === "gradient") {
                styles.push(`display: inline-block !important`);
            } else if (color.value) {
                styles.push(`color: ${color.value}`);
            }

            if (header.useTextShadow) {
                styles.push(`text-shadow: 0 2px 4px rgba(0,0,0,0.15)`);
            }

            return styles.join("; ");
        })(),
    );

    let logoGradientStyle = $derived(
        (() => {
            const color = header.logoColor || { type: "solid", value: "" };
            if (color.type === "gradient") {
                return [
                    `background: ${color.value}`,
                    `-webkit-background-clip: text`,
                    `-webkit-text-fill-color: transparent`,
                    `background-clip: text`,
                    `color: transparent`,
                    `display: inline-block`,
                    `padding-bottom: 0.2em`,
                    `margin-bottom: -0.2em`,
                ].join("; ");
            }
            return "";
        })(),
    );

    let navStyle = $derived(
        (() => {
            let styles = [];
            styles.push(`align-items: ${navVAlign}`);
            return styles.join("; ");
        })(),
    );

    // 로고 수평 정중앙 정렬 시에도 수직 정렬(상단, 중앙, 하단)이 연동되도록 absolute 배치 변수 연산
    let logoCenterTop = $derived(
        currentLogoVAlign === "top"
            ? "auto"
            : currentLogoVAlign === "bottom"
              ? "0px"
              : "50%",
    );
    let logoCenterBottom = $derived(
        currentLogoVAlign === "top"
            ? "0px"
            : currentLogoVAlign === "bottom"
              ? "auto"
              : "auto",
    );
    let logoCenterYTrans = $derived(
        currentLogoVAlign === "top"
            ? "0%"
            : currentLogoVAlign === "bottom"
              ? "0%"
              : "-50%",
    );

    // 로고 패딩을 고려한 최소 헤더 높이 계산 (isMobile 의존 제거)
    let activeLogoPaddingTop = $derived(
        isMobileDevice
            ? (header.mobile?.logoPadding?.top ?? header.logoPadding?.top ?? 0)
            : isScrolled
              ? (header.scrolledLogoPadding?.top ?? header.logoPadding?.top ?? 0)
              : (header.logoPadding?.top ?? 0),
    );
    let activeLogoPaddingBottom = $derived(
        isMobileDevice
            ? (header.mobile?.logoPadding?.bottom ?? header.logoPadding?.bottom ?? 0)
            : isScrolled
              ? (header.scrolledLogoPadding?.bottom ?? header.logoPadding?.bottom ?? 0)
              : (header.logoPadding?.bottom ?? 0),
    );
    let minHeaderHeight = $derived(
        `calc(var(--logo-font-size) + ${activeLogoPaddingTop + activeLogoPaddingBottom + 16}px)`,
    );

    // isMobile 의존 제거: 모바일 설정은 CSS 커스텀 프로퍼티와 미디어 쿼리로 분기
    let normalizedHeaderBg = $derived.by(() => {
        const normalized = normalizeBackground(
            header.headerBackground,
            header.headerBackgroundOpacity,
            header.headerBackgroundBlur,
        );
        if (isMobileDevice) {
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

    let headerBlur = $derived(normalizedHeaderBg.blur);
    let headerLayerBlur = $derived(normalizedHeaderBg.layerBlur);
    let headerOpacity = $derived(normalizedHeaderBg.opacity);
    let headerBgStyle = $derived(getBgStyle(header.headerBackground));
    const rawHeaderStaticHtml = $derived(settings.headerStaticHtml || "");

    const headerStaticHtml = $derived.by(() => {
        if (!rawHeaderStaticHtml) return "";
        const logoColor = header.logoColor || { type: "solid", value: "" };
        const freshLogoHtml = logoColor.type === "gradient"
            ? `<span style="background: ${logoColor.value}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent; display: inline-block; padding-bottom: 0.2em; margin-bottom: -0.2em;">${logoText}</span>`
            : logoText;
        // DB 캐시 HTML 내부의 <a> 태그 속성(class 및 style)을 동적으로 안전 치환하여 효과 주입
        return rawHeaderStaticHtml.replace(
            /(<a\s+href="\/[^"]*"\s+class=")(logo)([^"]*"\s+style=")([^"]*)(")/i,
            (match, p1, p2, p3, p4, p5) => {
                let hoverTransform = 'none';
                let hoverColor = 'currentcolor';
                let hoverShadow = 'none';

                if (header.logoColor?.type === 'gradient') {
                    hoverColor = header.logoColor.value || 'linear-gradient(90deg, #3b82f6, #06b6d4)';
                } else if (header.logoColor?.value) {
                    hoverColor = header.logoColor.value;
                }

                if (header.logoHoverEffect === 'scale') {
                    hoverTransform = `scale(${header.logoHoverScale || 1.02})`;
                } else if (header.logoHoverEffect === 'float') {
                    hoverTransform = `translateY(-${header.logoHoverFloatOffset ?? 2}px)`;
                } else if (header.logoHoverEffect === 'color') {
                    hoverColor = header.logoHoverColor?.value || 'var(--accent-color, var(--primary-color))';
                }

                if (header.logoHoverShadowEnabled) {
                    hoverShadow = `0 2px 8px ${header.logoHoverShadowColor?.value || 'rgba(0, 0, 0, 0.15)'}`;
                }

                const hoverStyleVars = [
                    `--logo-hover-transform: ${hoverTransform};`,
                    `--logo-hover-color: ${hoverColor};`,
                    `--logo-hover-shadow: ${hoverShadow};`
                ].join(' ');

                const safeP4 = p4.trim().endsWith(';') ? p4.trim() : p4.trim() + ';';

                return `${p1}logo${p3}${safeP4} ${hoverStyleVars}${p5}`;
            }
        ).replace(
            // 로고 내부 알맹이 스팬 컨텐츠도 Gradient 설정에 맞추어 최신화 교체
            /(<a\s+href="\/[^"]*"\s+class="[^"]*"\s+style="[^"]*">)([\s\S]*?)(<\/a>)/i,
            `$1${freshLogoHtml}$3`
        );
    });

    let logoHoverTransform = $derived(
        header.logoHoverEffect === "scale"
            ? `scale(${header.logoHoverScale || 1.02})`
            : header.logoHoverEffect === "float"
              ? `translateY(-${header.logoHoverFloatOffset ?? 2}px)`
              : "none"
    );
    let logoHoverColorVal = $derived(
        header.logoHoverEffect === "color"
            ? (header.logoHoverColor?.value || "var(--accent-color, var(--primary-color))")
            : "currentcolor"
    );
    let logoHoverShadowVal = $derived(
        header.logoHoverShadowEnabled
            ? `0 2px 8px ${header.logoHoverShadowColor?.value || "rgba(0, 0, 0, 0.15)"}`
            : "none"
    );

    let useBottomFade = $derived(header.useBottomFade ?? false);
    let fadeStrength = $derived(header.bottomFadeStrength ?? 20);
    let useTextShadow = $derived(header.useTextShadow ?? false);

    // 두 줄 모드: 스크롤 및 모바일 뷰일 때 자동으로 한 줄로 축소
    let isTwoLine = $derived(
        header.headerLayout === "two-line" && !isScrolled && !isMobileDevice,
    );

    // 두 줄 모드에서 로고 수평 정렬을 text-align으로 변환
    let twoLineLogoTextAlign = $derived(
        currentLogoAlignment === "center"
            ? "center"
            : currentLogoAlignment === "right"
              ? "right"
              : "left",
    );


</script>

<div
    bind:this={sensorEl}
    class="scroll-sensor"
    style="position: absolute; top: 60px; left: 0; width: 1px; height: 1px; pointer-events: none; visibility: hidden; z-index: -9999;"
></div>

<header
    class="blog-header"
    class:scrolled={isScrolled}
    class:mobile-open={isMenuOpen}
    class:header-two-line={isTwoLine}
    style="
        --header-height: {header.height || '64px'};
        --header-bg: {getBgValue(header.headerBackground) === 'transparent'
        ? 'var(--surface-color, #ffffff)'
        : getBgValue(header.headerBackground)};
        --header-blur: {headerBlur}px;
        --header-layer-blur: {headerLayerBlur}px;
        --header-opacity: {headerOpacity};
        --header-overlay-color: {normalizedHeaderBg.overlayColor};
        --header-overlay-opacity: {normalizedHeaderBg.overlayOpacity};
        --logo-v-align: {logoVAlign};
        --nav-v-align: {navVAlign};
        --fade-strength: {fadeStrength}px;
        --logo-font-size: {header.logoFontSize || '1.5rem'};
        --scrolled-height: {header.scrolledHeight ||
        'max(50px, calc(var(--logo-font-size) + 16px))'};
        --scrolled-max-width: {header.scrolledMaxWidth};
        --scrolled-nav-spacing: {header.scrolledNavSpacing ||
        header.navSpacing ||
        '1.5rem'};
        --logo-center-top: {logoCenterTop};
        --logo-center-bottom: {logoCenterBottom};
        --logo-center-y-trans: {logoCenterYTrans};
        --min-header-height: {minHeaderHeight};
        --nav-align: {navAlign};
        --nav-v-align: {navVAlign};
        --nav-gap: {currentNavSpacing};
        --nav-text-color: {header.navTextColor || 'inherit'};
        --nav-hover-text: {header.navHoverTextColor || 'var(--primary-color)'};
        --nav-hover-bg: {getBgValue(header.navHoverBackground) || 'rgba(0,0,0,0.05)'};
        --mobile-header-height: {baseHeader.mobile?.height || baseHeader.height || '64px'};
        --mobile-logo-font-size: {baseHeader.mobile?.logoFontSize || baseHeader.logoFontSize || '1.5rem'};
        --mobile-bg-opacity: {normalizedHeaderBg.mobile?.opacity ?? normalizedHeaderBg.opacity};
        --mobile-bg-layer-blur: {normalizedHeaderBg.mobile?.layerBlur ?? normalizedHeaderBg.layerBlur}px;
        --mobile-header-overlay-color: {normalizedHeaderBg.mobile?.overlayColor || normalizedHeaderBg.overlayColor};
        --mobile-header-overlay-opacity: {normalizedHeaderBg.mobile?.overlayOpacity ?? normalizedHeaderBg.overlayOpacity};

        /* 데스크탑 및 가변 디자인 패딩/간격 */
        --logo-padding-top: {currentLogoPadding.top}px;
        --logo-padding-right: {currentLogoPadding.right}px;
        --logo-padding-bottom: {currentLogoPadding.bottom}px;
        --logo-padding-left: {currentLogoPadding.left}px;
        --nav-padding-top: {currentNavPadding.top}px;
        --nav-padding-right: {currentNavPadding.right}px;
        --nav-padding-bottom: {currentNavPadding.bottom}px;
        --nav-padding-left: {currentNavPadding.left}px;

        /* 모바일 디자인 패딩/간격 */
        --mobile-logo-padding-top: {baseHeader.mobile?.logoPadding?.top ?? baseHeader.logoPadding?.top ?? 0}px;
        --mobile-logo-padding-right: {baseHeader.mobile?.logoPadding?.right ?? baseHeader.logoPadding?.right ?? 0}px;
        --mobile-logo-padding-bottom: {baseHeader.mobile?.logoPadding?.bottom ?? baseHeader.logoPadding?.bottom ?? 0}px;
        --mobile-logo-padding-left: {baseHeader.mobile?.logoPadding?.left ?? baseHeader.logoPadding?.left ?? 0}px;
        --mobile-nav-padding-top: {baseHeader.mobile?.navPadding?.top ?? baseHeader.navPadding?.top ?? 0}px;
        --mobile-nav-padding-right: {baseHeader.mobile?.navPadding?.right ?? baseHeader.navPadding?.right ?? 0}px;
        --mobile-nav-padding-bottom: {baseHeader.mobile?.navPadding?.bottom ?? baseHeader.navPadding?.bottom ?? 0}px;
        --mobile-nav-padding-left: {baseHeader.mobile?.navPadding?.left ?? baseHeader.navPadding?.left ?? 0}px;
        --mobile-nav-gap: {baseHeader.mobile?.navSpacing || baseHeader.navSpacing || '1.5rem'};
    "
>
    <div
        class="header-inner"
        class:logo-centered={currentLogoAlignment === "center" && !isTwoLine}
        class:logo-right={currentLogoAlignment === "right" && !isTwoLine}
        class:header-two-line={isTwoLine}
        style="
            --header-side-margin: {header.sideMargin || '0px'};
            --logo-align-self: {currentLogoAlignment === 'left' ? 'flex-start' : currentLogoAlignment === 'right' ? 'flex-end' : 'center'};
        "
    >
        <!-- Background Layer -->
        <div class="header-bg-wrapper" class:fade-bottom={useBottomFade}>
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
        <!-- A. DB에서 받아온 정적 뼈대 (HTML 유실 시를 대비한 하이브리드 폴백 탑재) -->
        {#if headerStaticHtml}
            {@html headerStaticHtml}
        {:else}
            <a
                href={processUrl("/")}
                class="logo"
                onclick={closeMenu}
                style="{logoStyle}; --logo-hover-transform: {logoHoverTransform}; --logo-hover-color: {logoHoverColorVal}; --logo-hover-shadow: {logoHoverShadowVal};"
            >
            {#if header.logoColor?.type === "gradient"}
                <span style={logoGradientStyle}>{logoText}</span>
            {:else}
                {logoText}
            {/if}
        </a>

        <!-- Right side: Nav, Category, Auth -->
        <div
            class="header-right desktop-only"
            style="
            "
        >
            <nav class="header-nav" style={navStyle}>
                {#each desktopNav as item}
                    {#if item.type === "category_drawer"}
                        <div class="category-dropdown-wrapper">
                            <button
                                class="nav-link category-toggle"
                                onclick={(e) =>
                                    toggleCategoryDropdown(e, item.id)}
                                class:active={openDropdownId === item.id}
                                style="color: {header.navTextColor ||
                                    'inherit'}"
                            >
                                {#if item.icon && navIconSvgs[item.id]}
                                    <span class="nav-icon-wrapper flex items-center">
                                        {@html navIconSvgs[item.id]}
                                    </span>
                                {:else}
                                    <FolderTree size={18} />
                                {/if}
                                <span
                                    >{$t(
                                        item.label || "blog.nav.category",
                                    )}</span
                                >
                                <div
                                    class="arrow"
                                    class:rotate={openDropdownId === item.id}
                                >
                                    <ChevronDown size={14} />
                                </div>
                            </button>

                            {#if openDropdownId === item.id}
                                <div
                                    class="category-dropdown-panel"
                                    transition:slide={{
                                        duration: 200,
                                        axis: "y",
                                    }}
                                    onclick={(e) => e.stopPropagation()}
                                >
                                    <div class="dropdown-inner">
                                        {#each categories as category}
                                            <a
                                                href={processUrl(
                                                    `/${category.slug}`,
                                                )}
                                                class="dropdown-item"
                                                onclick={() =>
                                                    (openDropdownId = null)}
                                            >
                                                <span class="cat-name"
                                                    >{category.name}</span
                                                >
                                                <span class="cat-count"
                                                    >{category.postCount}</span
                                                >
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <a
                            href={item.url}
                            class="nav-link"
                            style="color: {header.navTextColor ||
                                'inherit'}; {useTextShadow
                                ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.15);'
                                : ''}; align-self: var(--nav-v-align, center);"
                        >
                            {#if item.icon && navIconSvgs[item.id]}
                                <span class="nav-icon-wrapper flex items-center">
                                    {@html navIconSvgs[item.id]}
                                </span>
                            {/if}
                            <span>{item.label}</span>
                        </a>
                    {/if}
                {/each}

                <!-- Integrated System Items -->
                {#if header.showLanguageSwitcher !== false && $page.data.languages && $page.data.languages.length > 1}
                    <div
                        class="lang-dropdown-wrapper"
                        style="position: relative;"
                    >
                        <button
                            class="nav-link lang-toggle"
                            onclick={(e) => {
                                e.stopPropagation();
                                isLangMenuOpen = !isLangMenuOpen;
                            }}
                            style="color: {header.navTextColor ||
                                'inherit'}; {useTextShadow
                                ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.15);'
                                : ''}"
                        >
                            <Globe size={18} />
                            <span
                                >{$page.data.languages.find(
                                    (l: any) => l.code === $page.data.lang,
                                )?.name || "Language"}</span
                            >
                            <div class="arrow" class:rotate={isLangMenuOpen}>
                                <ChevronDown size={14} />
                            </div>
                        </button>
                        {#if isLangMenuOpen}
                            <div
                                class="lang-dropdown-panel"
                                transition:slide={{ duration: 200, axis: "y" }}
                                onclick={(e) => e.stopPropagation()}
                            >
                                <div class="dropdown-inner">
                                    {#each $page.data.languages as lang}
                                        {@const isDefault =
                                            lang.is_default === 1}
                                        {@const prefix = isDefault
                                            ? ""
                                            : "/" + lang.code}
                                        {@const langCodes = $page.data.languages
                                            .map((l: any) => l.code)
                                            .join("|")}
                                        {@const cleanedPath =
                                            $page.url.pathname.replace(
                                                new RegExp(
                                                    `^/(${langCodes})(?=/|$)`,
                                                ),
                                                "",
                                            )}
                                        {@const finalUrl =
                                            prefix + cleanedPath || "/"}
                                        <a
                                            href={finalUrl}
                                            data-sveltekit-reload
                                            class="dropdown-item"
                                            class:active={$page.data.lang ===
                                                lang.code}
                                            onclick={() =>
                                                (isLangMenuOpen = false)}
                                        >
                                            <span class="cat-name"
                                                >{lang.name}</span
                                            >
                                            {#if $page.data.lang === lang.code}
                                                <span class="check">✓</span>
                                            {/if}
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- B. 클라이언트 사이드 로그인 상태 바인딩 영역 (Portal용) -->
                <div id="auth-group-portal" class="auth-group desktop-only">
                    {#if user}
                        <span
                            class="user-name"
                            style={useTextShadow
                                ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                                : ""}>{user.name}</span
                        >
                        <a
                            href={processUrl("/profile")}
                            class="login-link"
                            style={useTextShadow
                                ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                                : ""}
                        >
                            <span>
                                {typeof header.profileLabel === "object"
                                    ? header.profileLabel[lang] ||
                                      header.profileLabel["ko"] ||
                                      "Profile"
                                    : $t("blog.nav.profile", {
                                          default: "내 정보",
                                      })}
                            </span>
                        </a>
                    {:else}
                        <a
                            href={processUrl("/login")}
                            class="login-link"
                            style={useTextShadow
                                ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                                : ""}
                        >
                            <span>
                                {typeof header.loginLabel === "object"
                                    ? header.loginLabel[lang] ||
                                      header.loginLabel["ko"] ||
                                      "Login"
                                    : $t("blog.nav.login", {
                                          default: "로그인",
                                      })}
                            </span>
                        </a>
                    {/if}
                </div>
            </nav>
        </div>
        {/if}

        <!-- Dynamic Auth Group (Desktop Only) - Sibling for static HTML mode -->
        {#if headerStaticHtml}
            <div id="auth-group-portal" class="auth-group desktop-only">
                <!-- 다국어 선택기 복구 -->
                {#if header.showLanguageSwitcher !== false && $page.data.languages && $page.data.languages.length > 1}
                    <div
                        class="lang-dropdown-wrapper"
                        style="position: relative;"
                    >
                        <button
                            class="nav-link lang-toggle"
                            onclick={(e) => {
                                e.stopPropagation();
                                isLangMenuOpen = !isLangMenuOpen;
                            }}
                            style="color: {header.navTextColor ||
                                'inherit'}; {useTextShadow
                                ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.15);'
                                : ''}"
                        >
                            <Globe size={18} />
                            <span
                                >{$page.data.languages.find(
                                    (l: any) => l.code === $page.data.lang,
                                )?.name || "Language"}</span
                            >
                            <div class="arrow" class:rotate={isLangMenuOpen}>
                                <ChevronDown size={14} />
                            </div>
                        </button>
                        {#if isLangMenuOpen}
                            <div
                                class="lang-dropdown-panel"
                                transition:slide={{ duration: 200, axis: "y" }}
                                onclick={(e) => e.stopPropagation()}
                            >
                                <div class="dropdown-inner">
                                    {#each $page.data.languages as lang}
                                        {@const isDefault =
                                            lang.is_default === 1}
                                        {@const prefix = isDefault
                                            ? ""
                                            : "/" + lang.code}
                                        {@const langCodes = $page.data.languages
                                            .map((l: any) => l.code)
                                            .join("|")}
                                        {@const cleanedPath =
                                            $page.url.pathname.replace(
                                                new RegExp(
                                                    `^/(${langCodes})(?=/|$)`,
                                                ),
                                                "",
                                            )}
                                        {@const finalUrl =
                                            prefix + cleanedPath || "/"}
                                        <a
                                            href={finalUrl}
                                            data-sveltekit-reload
                                            class="dropdown-item"
                                            class:active={$page.data.lang ===
                                                lang.code}
                                            onclick={() =>
                                                (isLangMenuOpen = false)}
                                        >
                                            <span class="cat-name"
                                                >{lang.name}</span
                                            >
                                            {#if $page.data.lang === lang.code}
                                                <span class="check">✓</span>
                                            {/if}
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if user}
                    <span
                        class="user-name"
                        style={useTextShadow
                            ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                            : ""}>{user.name}</span
                    >
                    <a
                        href={processUrl("/profile")}
                        class="login-link"
                        style={useTextShadow
                            ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                            : ""}
                    >
                        <span>
                            {typeof header.profileLabel === "object"
                                ? header.profileLabel[lang] ||
                                  header.profileLabel["ko"] ||
                                  "Profile"
                                : $t("blog.nav.profile", {
                                      default: "내 정보",
                                  })}
                        </span>
                    </a>
                {:else}
                    <a
                        href={processUrl("/login")}
                        class="login-link"
                        style={useTextShadow
                            ? "text-shadow: 0 1px 3px rgba(0,0,0,0.15);"
                            : ""}
                    >
                        <span>
                            {typeof header.loginLabel === "object"
                                ? header.loginLabel[lang] ||
                                  header.loginLabel["ko"] ||
                                  "Login"
                                : $t("blog.nav.login", {
                                      default: "로그인",
                                  })}
                        </span>
                    </a>
                {/if}
            </div>
        {/if}

        <!-- Global Dropdown Panel (Used for static HTML dropdown click) -->
        {#if headerStaticHtml && openDropdownId !== null}
            <div
                class="category-dropdown-panel"
                style="position: absolute; left: {dropdownX}px; top: {dropdownY}px; transform: none;"
                transition:slide={{ duration: 200, axis: "y" }}
                onclick={(e) => e.stopPropagation()}
            >
                <div class="dropdown-inner">
                    {#each categories as category}
                        <a
                            href={processUrl(`/${category.slug}`)}
                            class="dropdown-item"
                            onclick={() => (openDropdownId = null)}
                        >
                            <span class="cat-name">{category.name}</span>
                            <span class="cat-count">{category.postCount}</span>
                        </a>
                    {/each}
                </div>
            </div>
        {/if}

        <button
            class="mobile-menu-btn"
            aria-label="Toggle Menu"
            onclick={() => toggleMenu("full")}
            style={navStyle}
        >
            {#if isMenuOpen}
                <X size={24} />
            {:else}
                <Menu size={24} />
            {/if}
        </button>
    </div>
</header>

<!-- Mobile Navigation Overlay -->
{#if isMenuOpen}
    <div
        class="mobile-nav-overlay"
        transition:fade={{ duration: 200 }}
        onclick={closeMenu}
        aria-hidden="true"
    ></div>
    <div class="mobile-nav-drawer" transition:fly={{ x: 300, duration: 300 }}>
        <div class="drawer-header">
            <div class="logo-mini">{logoText}</div>
            <button onclick={closeMenu} class="close-btn"
                ><X size={24} /></button
            >
        </div>

        <div class="drawer-content">
            {#if drawerMode === "full"}
                <div class="user-section">
                    {#if user}
                        <div class="user-info">
                            <div class="user-avatar">
                                <User size={20} />
                            </div>
                            <div class="user-details">
                                <span class="u-name">{user.name}</span>
                                <span class="u-role"
                                    >{$t("blog.common.welcome")}</span
                                >
                            </div>
                        </div>
                    {:else}
                        <a
                            href={processUrl("/login")}
                            class="login-promo"
                            onclick={closeMenu}
                        >
                            <div class="promo-icon"><LogIn size={20} /></div>
                            <span>{$t("blog.common.login_promo")}</span>
                            <ChevronRight size={16} />
                        </a>
                    {/if}
                </div>

                <nav class="mobile-items">
                    {#each mobileNav as item}
                        {#if item.type === "category_drawer"}
                            <div class="mobile-category-wrapper">
                                <div class="mobile-category-title-bar">
                                    {#if item.icon && navIconSvgs[item.id]}
                                        <span class="nav-icon-wrapper flex items-center">
                                            {@html navIconSvgs[item.id]}
                                        </span>
                                    {:else}
                                        <FolderTree size={16} />
                                    {/if}
                                    <span>{$t(item.label || "blog.nav.category")}</span>
                                </div>
                                <div class="mobile-category-list">
                                    {#each categories as category}
                                        <a
                                            href={processUrl(`/${category.slug}`)}
                                            onclick={closeMenu}
                                            class="mobile-category-item"
                                        >
                                            <span class="cat-name">{category.name}</span>
                                            <span class="cat-count">{category.postCount}</span>
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <a href={item.url} onclick={closeMenu}>
                                <div class="flex items-center gap-3">
                                    {#if item.icon && navIconSvgs[item.id]}
                                        <span class="nav-icon-wrapper flex items-center">
                                            {@html navIconSvgs[item.id]}
                                        </span>
                                    {/if}
                                    <span>{$t(item.label)}</span>
                                </div>
                                <ChevronRight size={16} />
                            </a>
                        {/if}
                    {/each}
                </nav>
            {/if}

            {#if header.showLanguageSwitcher !== false && $page.data.languages && $page.data.languages.length > 1}
                <div class="drawer-section">
                    <div class="section-title">
                        <Globe size={16} />
                        <span>{$t("blog.common.select_lang")}</span>
                    </div>
                    <div class="category-chips">
                        {#each $page.data.languages as lang}
                            {@const isDefault = lang.is_default === 1}
                            {@const prefix = isDefault ? "" : "/" + lang.code}
                            {@const langCodes = $page.data.languages
                                .map((l: any) => l.code)
                                .join("|")}
                            {@const cleanedPath = $page.url.pathname.replace(
                                new RegExp(`^/(${langCodes})(?=/|$)`),
                                "",
                            )}
                            {@const finalUrl = prefix + cleanedPath || "/"}
                            <a
                                href={finalUrl}
                                data-sveltekit-reload
                                onclick={closeMenu}
                                class="chip"
                                class:active={$page.data.lang === lang.code}
                            >
                                {lang.name}
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="drawer-footer">
                {#if drawerMode === "full"}
                    {#if user}
                        <a
                            href={processUrl("/profile")}
                            class="btn-full"
                            onclick={closeMenu}
                            >{$t("blog.nav.profile_manage")}</a
                        >
                    {:else}
                        <a
                            href={processUrl("/login")}
                            class="btn-full primary"
                            onclick={closeMenu}>{$t("blog.nav.login")}</a
                        >
                    {/if}
                {:else}
                    <button class="btn-full" onclick={closeMenu}
                        >{$t("blog.common.close")}</button
                    >
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .blog-header {
        height: max(var(--header-height), var(--min-header-height));
        z-index: 1000;
        display: flex;
        align-items: center;
        position: sticky;
        top: 0;
        transition:
            background-color 0.3s ease,
            box-shadow 0.3s ease,
            border-radius 0.3s ease;
        pointer-events: none; /* Let clicks pass through the full-width wrapper */
    }

    .blog-header.header-two-line {
        height: auto !important;
    }

    /* Scrolled State: Handle height shrink dynamically based on logo size */
    .blog-header.scrolled {
        height: max(
            var(--scrolled-height),
            var(--min-header-height)
        ) !important;
    }

    .header-inner {
        pointer-events: auto; /* Re-enable clicks for the actual content */
        max-width: var(--max-width);
        width: calc(100% - 2 * var(--safe-side-margin, 0px)) !important;
        margin: var(--safe-top-margin, 0px) auto 0 !important;
        padding: 0.5rem var(--side-margin);
        box-sizing: border-box;
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        height: 100%;
        position: relative;
        background: transparent;
        transition:
            background-color 0.3s ease,
            box-shadow 0.3s ease,
            border-radius 0.3s ease;
        border-radius: var(--header-radius);
        box-shadow: var(--header-shadow);
    }

    /* 모바일 기기(768px 이하) 성능 최적화: 유체형 레이아웃 변형 제거 */
    @media (max-width: 768px) {
        .blog-header,
        .blog-header.scrolled {
            min-height: max(50px, var(--min-header-height, 50px));
            height: var(--mobile-header-height, var(--header-height, auto)) !important;
            transition: none !important;
            position: sticky !important;
            top: 0 !important;
            --header-overlay-color: var(--mobile-header-overlay-color) !important;
            --header-overlay-opacity: var(--mobile-header-overlay-opacity) !important;
            --header-layer-blur: var(--mobile-bg-layer-blur) !important;
            --header-opacity: var(--mobile-bg-opacity) !important;
        }
        /* DynamicBgRenderer 내부 모바일 스타일 오버라이드 (공통 파일 수정 방지) */
        .blog-header :global(.bg-iframe) {
            filter: blur(var(--mobile-bg-layer-blur)) !important;
        }
        .blog-header :global(.bg-iframe + div),
        .blog-header :global(div[style*="pointer-events:none"]) {
            opacity: var(--mobile-bg-opacity) !important;
        }
        .header-inner,
        header.blog-header.scrolled .header-inner {
            min-height: 50px;
            height: var(--mobile-header-height, var(--header-height, auto)) !important;
            transition: none !important;
            align-items: center !important;
            padding: 8px clamp(12px, var(--side-margin), 24px) !important;
            box-sizing: border-box;
            max-width: 100% !important;
            width: calc(100% - 2 * var(--safe-side-margin-mobile, 0px)) !important;
            margin: var(--safe-top-margin-mobile, 0px) auto 0 !important;
        }
        :global(.logo) {
            padding-top: var(--mobile-logo-padding-top) !important;
            padding-right: var(--mobile-logo-padding-right) !important;
            padding-bottom: var(--mobile-logo-padding-bottom) !important;
            padding-left: var(--mobile-logo-padding-left) !important;
            transition: none !important;
        }
        :global(.header-nav) {
            padding-top: var(--mobile-nav-padding-top) !important;
            padding-right: var(--mobile-nav-padding-right) !important;
            padding-bottom: var(--mobile-nav-padding-bottom) !important;
            padding-left: var(--mobile-nav-padding-left) !important;
            gap: var(--mobile-nav-gap) !important;
            transition: none !important;
        }
        .logo {
            align-self: center !important;
            margin-bottom: 3px !important;
            padding-top: var(--mobile-logo-padding-top) !important;
            padding-right: var(--mobile-logo-padding-right) !important;
            padding-bottom: var(--mobile-logo-padding-bottom) !important;
            padding-left: var(--mobile-logo-padding-left) !important;
        }
        .mobile-menu-btn {
            align-self: center !important;
        }
    }

    .header-bg-wrapper {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        overflow: hidden;
        pointer-events: none;
    }

    .header-overlay-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        background: var(--header-overlay-color);
        opacity: var(--header-overlay-opacity, 0);
        border-radius: inherit;
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    .header-bg-wrapper.fade-bottom {
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
        transition: all 0.3s ease;
        pointer-events: none;
    }

    .blog-header.scrolled .header-inner {
        box-shadow: var(--header-shadow);
        border-radius: var(--header-radius);
    }

    @media (min-width: 769px) {
        .blog-header.scrolled .header-inner {
            max-width: var(--scrolled-max-width) !important;
            width: calc(100% - 2 * var(--safe-side-margin, 0px)) !important;
            margin: var(--safe-top-margin, 0px) auto 0 !important;
        }
    }

    .blog-header.scrolled :global(.header-nav) {
        gap: var(--scrolled-nav-spacing) !important;
    }

    .blog-header.scrolled {
        --header-bg: rgba(255, 255, 255, 0.85);
        --header-opacity: 1;
        --header-blur: 10px;
    }

    /* If global theme says dark/transparent, we might need a smarter rgba.
       For now, assuming light theme or standard transparency usage.
       Ideally, we'd use color-mix or a CSS variable for the glass color. */
    @supports (
        background: color-mix(in srgb, var(--surface-color), transparent 20%)
    ) {
        .blog-header.scrolled .header-bg-layer {
            background: color-mix(
                in srgb,
                var(--surface-color, white) 85%,
                transparent
            );
        }
    }
    /* --- 로고 기본 스타일 --- */
    :global(.logo) {
        font-weight: 800;
        text-decoration: none;
        color: var(--primary-color);
        display: flex;
        align-items: center;
        padding-top: var(--logo-padding-top);
        padding-right: var(--logo-padding-right);
        padding-bottom: var(--logo-padding-bottom);
        padding-left: var(--logo-padding-left);
        position: relative;
        z-index: 1005;
        white-space: nowrap;
        align-self: var(--logo-v-align, center);
        line-height: 1;

        /* GPU 격리 및 스프링 감속 트랜지션 내장 */
        will-change: transform, color, text-shadow;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    color 0.3s ease, 
                    text-shadow 0.3s ease,
                    padding 0.3s ease;
    }

    /* 호버 시 외부(인라인)에서 전달되는 가변 변수값만 적용되도록 연동 */
    :global(.logo:hover) {
        transform: var(--logo-hover-transform, none) !important;
        color: var(--logo-hover-color, inherit) !important;
        filter: drop-shadow(var(--logo-hover-shadow, 0 0 0 transparent)) !important;
    }

    /* 호버 색상이 그라데이션일 때 내부 텍스트 span 클리핑 페이드 연동 */
    :global(.logo:hover span) {
        background: var(--logo-hover-color, inherit) !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
    }

    /* --- 헤더 우측 영역 기본 스타일 --- */
    :global(.header-right) {
        display: flex;
        align-items: var(--nav-v-align, center);
        flex: 1;
        position: relative;
        height: 100%;
    }
    :global(.header-nav) {
        display: flex;
        align-items: var(--nav-v-align, center);
        flex: 1;
        justify-content: var(--nav-align, flex-end);
        height: 100%;
        padding-top: var(--nav-padding-top);
        padding-right: var(--nav-padding-right);
        padding-bottom: var(--nav-padding-bottom);
        padding-left: var(--nav-padding-left);
        gap: var(--nav-gap);
        transition: padding 0.3s ease, gap 0.3s ease;
        flex-wrap: wrap; /* 가로폭이 좁아질 때 우측 밖으로 삐져나가지 않고 자연스럽게 줄바꿈 유도 */
    }

    /* --- 한 줄 모드: 로고 정중앙 정렬 시 --- */
    .header-inner.logo-centered :global(.logo) {
        position: absolute;
        left: 50%;
        top: var(--logo-center-top, 50%);
        bottom: var(--logo-center-bottom, auto);
        transform: translate(-50%, var(--logo-center-y-trans, -50%));
        margin: 0 !important;
    }
    /* 중앙정렬 로고의 호버 오프셋 앵커 축 변형 대입 규칙 1세트 */
    .header-inner.logo-centered :global(.logo:hover) {
        transform: translate(-50%, var(--logo-center-y-trans, -50%)) var(--logo-hover-transform, scale(1)) !important;
        text-shadow: var(--logo-hover-shadow, none) !important;
    }
    /* 사용자가 설정한 nav-align 정렬 변수값을 그대로 상속받아 정렬하되, 로그인 영역만 우측 끝에 띄움 */
    .header-inner.logo-centered :global(.header-right) {
        justify-content: var(--nav-align, flex-end);
    }
    .header-inner.logo-centered :global(.header-right .header-nav) {
        justify-content: var(--nav-align, flex-end);
    }

    /* --- 한 줄 모드: 로고 우측 정렬 시 --- */
    .header-inner.logo-right {
        flex-direction: row-reverse;
    }
    .header-inner.logo-right :global(.header-right) {
        margin-left: 0;
        margin-right: 0;
        flex: 1;
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
    .header-inner.header-two-line :global(.logo) {
        position: static !important;
        align-self: var(--logo-align-self, center) !important;
        margin: 0 !important;
    }
    .header-inner.header-two-line :global(.header-right) {
        width: 100% !important;
        display: flex !important;
        justify-content: var(--nav-align, flex-end) !important;
        flex: none !important;
        position: relative !important;
    }
    /* 두 줄 모드에서도 메뉴가 가운데이고 로그인/다국어가 우측에 있을 때 대응 */
    .header-inner.header-two-line :global(.header-right .header-nav) {
        justify-content: var(--nav-align, flex-end);
        flex: 1;
        height: auto;
    }
    :global(.nav-link) {
        font-family: inherit;
        text-decoration: none;
        color: var(--nav-text-color, var(--text-color));
        font-weight: 600;
        font-size: 0.95rem;
        transition: all 0.2s;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        white-space: nowrap;
        width: auto;
        flex: none;
    }
    .nav-link:hover,
    .nav-link.active {
        color: var(--nav-hover-text);
        border-color: rgba(0, 0, 0, 0.05);
        /* We use the bg variable, but how to handle gradient vs solid? 
           The inline style sets --nav-hover-bg. 
           We just use it. */
        background: var(--nav-hover-bg);
    }

    .category-dropdown-wrapper {
        position: relative;
    }
    /* Removed category-toggle-btn specific styles as they are now .nav-link */
    .arrow {
        transition: transform 0.3s ease;
        opacity: 0.6;
    }
    .arrow.rotate {
        transform: rotate(180deg);
    }

    .category-dropdown-panel,
    .lang-dropdown-panel {
        position: absolute;
        top: calc(100% + 15px);
        right: 0;
        width: 240px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(0, 0, 0, 0.08);
        padding: 0.75rem;
        z-index: 1002;
        display: flex;
        flex-direction: column;
    }
    .lang-dropdown-panel {
        width: 180px;
    }
    .dropdown-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: #94a3b8;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 0.5rem;
    }
    .dropdown-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .dropdown-item {
        padding: 0.6rem 0.75rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        color: #475569;
        text-decoration: none;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .dropdown-item .dot {
        color: #cbd5e1;
        transition: color 0.2s;
    }
    .dropdown-item .count {
        margin-left: auto;
        font-size: 0.75rem;
        color: #94a3b8;
        background: #f8fafc;
        padding: 2px 6px;
        border-radius: 4px;
    }
    .dropdown-item:hover {
        background: #f1f5f9;
        color: var(--primary-color);
    }
    .dropdown-item:hover .dot {
        color: var(--primary-color);
    }
    .dropdown-item:hover .count {
        background: white;
        color: var(--primary-color);
    }
    .dropdown-item.active {
        background: #f1f5f9;
        color: var(--primary-color);
        font-weight: 700;
    }
    .dropdown-item .check {
        margin-left: auto;
        color: var(--primary-color);
        font-weight: bold;
    }

    :global(.desktop-only) {
        display: flex;
        align-items: center;
    }
    @media (max-width: 768px) {
        :global(.desktop-only) {
            display: none !important;
        }
        .header-inner.logo-centered .logo {
            position: static;
            transform: none;
        }
        /* two-line 클래스가 모바일에 적용되더라도 one-line처럼 표시 */
        .header-inner.header-two-line {
            flex-direction: row !important;
            height: var(--mobile-header-height, auto) !important;
            min-height: 50px !important;
            gap: 0 !important;
            align-items: center !important;
        }
        .header-inner.header-two-line :global(.logo) {
            position: static !important;
            align-self: center !important;
        }
        .header-inner.header-two-line :global(.header-right) {
            width: auto !important;
            flex: 1 !important;
        }
    }

    /* --- 동적 로그인 그룹 기본 스타일 --- */
    :global(.auth-group) {
        display: none;
    }
    :global(.header-nav) :global(.auth-group) {
        display: flex;
        align-items: var(--nav-v-align, center);
        gap: 0.75rem;
        flex: none;
    }
    /* 두 줄 모드: 로고 1줄 + [메뉴/다국어/로그인] 묶음 2줄 배치 */
    .header-inner.header-two-line {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: center !important;
        height: auto !important;
        gap: 0.75rem !important;
    }
    .header-inner.header-two-line :global(.logo) {
        position: static !important;
        align-self: var(--logo-align-self, center) !important;
        margin: 0 !important;
    }
    .header-inner.header-two-line :global(.header-right) {
        width: 100% !important;
        display: flex !important;
        justify-content: var(--nav-align, flex-end) !important;
        flex: none !important;
    }
    .user-name {
        font-size: 0.85rem;
        color: #666;
        white-space: nowrap;
        width: auto;
        flex: none;
    }
    .login-link {
        background: var(--primary-color);
        color: white !important;
        padding: 0.5rem 1.25rem;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(var(--primary-color-rgb, 0, 0, 0), 0.2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        width: auto;
        flex: none;
    }

    /* Mobile Menu Button */
    .mobile-menu-btn {
        display: none;
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--text-color);
        z-index: 1001;
        border-radius: 8px;
        transition: background 0.2s;
        align-self: var(--nav-v-align, center);
    }
    .mobile-menu-btn:active {
        background: rgba(0, 0, 0, 0.05);
    }

    /* 태블릿 / 소형 데스크톱 환경 (769px ~ 1024px) 최적화 */
    @media (min-width: 769px) and (max-width: 1024px) {
        :global(.header-nav) {
            gap: max(0.5rem, calc(var(--nav-gap) * 0.6)) !important; /* 메뉴 간격을 원설정의 60% 수준으로 자동 압축 */
        }
        :global(.nav-link) {
            padding: clamp(0.3em, 0.8vw, 0.5em) clamp(0.4em, 1.2vw, 0.75rem) !important; /* 패딩 유기적 스케일 */
            font-size: clamp(calc(var(--base-font-size) * 0.82), 1.1vw, calc(var(--base-font-size) * 0.95)) !important; /* 글로벌 폰트 사이즈 비례 조절 */
        }
    }

    /* Mobile Drawer & Overlay */
    .mobile-nav-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        z-index: 2000;
    }
    .mobile-nav-drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: 85%;
        max-width: 320px;
        height: 100%;
        background: white;
        z-index: 2001;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
    }
    .drawer-header {
        padding: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f0f0f0;
    }
    .logo-mini {
        font-weight: 800;
        font-size: 1.2rem;
        color: var(--primary-color);
    }
    .close-btn {
        background: none;
        border: none;
        padding: 0.5rem;
        color: #666;
    }
    .drawer-content {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    .user-section {
        padding: 1.5rem;
        background: #fafafa;
    }
    .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .user-avatar {
        width: 44px;
        height: 44px;
        background: var(--primary-color);
        color: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .u-name {
        display: block;
        font-weight: 700;
        font-size: 1rem;
    }
    .u-role {
        font-size: 0.75rem;
        color: #888;
    }
    .login-promo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        text-decoration: none;
        color: inherit;
    }
    .promo-icon {
        width: 40px;
        height: 40px;
        background: #eee;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
    }
    .login-promo span {
        flex: 1;
        font-size: 0.9rem;
        font-weight: 500;
    }
    .mobile-items {
        padding: 1rem 0;
    }
    .mobile-items a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        text-decoration: none;
        color: var(--text-color);
        font-weight: 600;
        transition: background 0.2s;
    }
    .mobile-items a:active {
        background: #f5f5f5;
    }

    /* Drawer Sections */
    .drawer-section {
        padding: 1.5rem;
        border-top: 1px solid #f5f5f5;
    }
    .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: #999;
        text-transform: uppercase;
        margin-bottom: 1rem;
        letter-spacing: 0.05em;
    }
    .category-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
    }
    .chip {
        padding: 0.5rem 0.9rem;
        background: #f8f9fa;
        border: 1px solid #edf2f7;
        border-radius: 100px;
        font-size: 0.85rem;
        font-weight: 500;
        color: #4a5568;
        text-decoration: none;
        transition: all 0.2s;
    }
    .chip.active {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
        font-weight: 700;
    }
    .chip:active {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }
    .tag-cloud-mini {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 0.8rem;
    }
    .tag-link {
        font-size: 0.85rem;
        color: #718096;
        text-decoration: none;
        font-weight: 500;
    }
    .tag-link:active {
        color: var(--primary-color);
    }

    .popular-list-mini {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .popular-item-mini {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        text-decoration: none;
        color: inherit;
        padding: 0.5rem;
        border-radius: 10px;
        transition: background 0.2s;
    }
    .popular-item-mini:active {
        background: #f8f9fa;
    }
    .p-img {
        width: 50px;
        height: 50px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        background: #eee;
    }
    .p-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .p-title {
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .drawer-footer {
        padding: 1.5rem;
        border-top: 1px solid #f0f0f0;
    }
    .btn-full {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 1rem;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 700;
        background: #f0f0f0;
        color: #333;
    }
    .btn-full.primary {
        background: var(--primary-color);
        color: white;
    }

    @media (max-width: 768px) {
        .mobile-menu-btn {
            display: block;
        }
    }

    /* 서버 사이드 주입 인라인 SVG 전용 스타일 */
    :global(.nav-icon-wrapper svg) {
        width: 18px;
        height: 18px;
        display: inline-block;
        vertical-align: middle;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
    }
    .mobile-items :global(.nav-icon-wrapper svg) {
        width: 20px;
        height: 20px;
    }

    /* Mobile Category Menu Flat List Styles */
    .mobile-category-wrapper {
        width: 100%;
        display: flex;
        flex-direction: column;
    }
    .mobile-category-title-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1.25rem 1.5rem 0.5rem 1.5rem;
        color: var(--secondary-color, #64748b);
        font-weight: 700;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .mobile-category-list {
        background: transparent;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .mobile-category-item {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 0.875rem 2.5rem !important;
        font-size: 0.95rem !important;
        font-weight: 600 !important;
        color: var(--text-color) !important;
        text-decoration: none !important;
        transition: background 0.2s;
    }
    .mobile-category-item:active {
        background: #f5f5f5;
    }
    .mobile-category-item .cat-count {
        font-size: 0.75rem;
        color: #94a3b8;
        background: #edf2f7;
        padding: 2px 6px;
        border-radius: 4px;
    }
</style>
