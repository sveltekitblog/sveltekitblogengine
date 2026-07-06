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
    import type { Layout, LayoutWidget } from "$lib/types";
    import { t } from "$lib/i18n";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import RecentPostsWidget from "./widgets/RecentPostsWidget.svelte";
    import CategoryList from "./widgets/CategoryList.svelte";
    import PopularPostsWidget from "./widgets/PopularPostsWidget.svelte";
    import TagCloudWidget from "./widgets/TagCloudWidget.svelte";
    import HtmlWidget from "./widgets/HtmlWidget.svelte";
    import RecentCommentsWidget from "./widgets/RecentCommentsWidget.svelte";
    import RecentGuestbooksWidget from "./widgets/RecentGuestbooksWidget.svelte";

    const widgetComponents: Record<string, any> = {
        RecentPosts: RecentPostsWidget,
        CategoryList: CategoryList,
        PopularPosts: PopularPostsWidget,
        TagCloud: TagCloudWidget,
        HtmlWidget: HtmlWidget,
        RecentComments: RecentCommentsWidget,
        RecentGuestbooks: RecentGuestbooksWidget
    };


    let {
        layout,
        layoutWidgets,
        desktopWidgets,
        mobileWidgets,
        mobileLayout,
        categories = [],
        recentPosts = [],
        popularPosts = [],
        tags = [],
        recentComments = [],
        recentGuestbooks = [],
        settings,
        children,
    }: {
        layout: Layout;
        layoutWidgets: LayoutWidget[];
        settings?: any;
        desktopWidgets?: LayoutWidget[];
        mobileWidgets?: LayoutWidget[];
        mobileLayout?: { columnCount: number; columnWidths: string };
        categories: any[];
        recentPosts: any[];
        popularPosts: any[];
        tags: string[];
        recentComments?: any[];
        recentGuestbooks?: any[];
        children: any;
    } = $props();

    onMount(() => {
        // 정적 컴포넌트 임포트 적용 완료로 인한 동적 로더 로직 제거
    });

    // ─── 데이터 처리 ──────────────────────────────────────────────────
    const dbDefaultLang = $derived($page.data.dbDefaultLang || "ko");
    const lang = $derived($page.params.lang || $page.data.lang || dbDefaultLang);
    const dWidgets = $derived(desktopWidgets && desktopWidgets.length > 0 ? desktopWidgets : layoutWidgets);
    const mWidgets = $derived(mobileWidgets && mobileWidgets.length > 0 ? mobileWidgets : []);

    // PostContent widget config parsing to link TagCloud text size to the post card font size
    const defaultPcConfig = {
        cardFontSize: "1rem"
    };

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

    function extractDeviceConfig(parsed: any, device: "desktop" | "mobile"): any {
        if (parsed.desktop || parsed.mobile) {
            return {
                ...defaultPcConfig,
                ...(parsed[device] || parsed.desktop || {}),
            };
        }
        return { ...defaultPcConfig, ...parsed };
    }

    const dWidget = $derived((dWidgets || []).find(w => w.type === 'post_content' || w.type === 'PostContent'));
    const mWidget = $derived((mWidgets || []).find(w => w.type === 'post_content' || w.type === 'PostContent'));

    const dParsed = $derived(parseWidgetConfig(dWidget?.config));
    const mParsed = $derived(parseWidgetConfig(mWidget?.config));

    const desktopPcConfig = $derived(extractDeviceConfig(dParsed, "desktop"));
    const mobilePcConfig = $derived(extractDeviceConfig(mParsed || dParsed, "mobile"));

    const desktopCardFontSize = $derived(desktopPcConfig.cardFontSize || "1rem");
    const mobileCardFontSize = $derived(mobilePcConfig.cardFontSize || "1rem");

    // 레이아웃에 '본문' 위젯이 있는지 확인
    const hasPostContentWidget = $derived(dWidgets.some(w => w.type === 'post_content' || w.type === 'PostContent'));
    
    // 본문이 들어갈 기본 컬럼 (본문 위젯이 없을 경우 대비)
    // 3단이면 1번(중앙), 그 외엔 0번 컬럼
    const defaultMainColIdx = $derived((layout?.columnCount === 3) ? 1 : 0);

    // 컬럼별 위젯 분류
    function getWidgetsByCol(allWidgets: any[], colCount: number) {
        return Array.from({ length: colCount }, (_, i) => {
            return allWidgets
                .filter((w) => w.columnIndex === i)
                .sort((a, b) => a.sortOrder - b.sortOrder);
        });
    }

    const dCols = $derived(getWidgetsByCol(dWidgets, layout?.columnCount || 1));

    function buildGrid(columnWidths: string | undefined | null, colCount: number): string {
        if (!columnWidths) return "repeat(" + (colCount || 1) + ", minmax(0, 1fr))";
        return columnWidths.replace(/-/g, " ").split(" ").filter((w) => w).map((w) => {
            const val = w.endsWith("fr") || w.endsWith("%") || w.endsWith("px") ? w : `${w}fr`;
            // Wrap in minmax(0, val) to prevent grid blowout if the content is too wide
            return `minmax(0, ${val})`;
        }).join(" ");
    }

    const desktopGridTemplate = $derived(buildGrid(layout?.columnWidths, layout?.columnCount || 1));

    // ─── 헬퍼 함수 ────────────────────────────────────────────────────
    function getWidgetTitle(w: any) {
        let title = typeof w.customTitle === 'string' ? w.customTitle.trim() : w.customTitle;
        if (title && title.startsWith("{")) {
            try {
                const parsed = JSON.parse(title);
                title = parsed[lang] || parsed[dbDefaultLang] || Object.values(parsed)[0] || title;
            } catch (e) {}
        }
        if (title && title !== "{}" && !title.includes('{}')) return $t(title, { default: title });
        switch (w.type) {
            case "RecentPosts": return $t("blog.widget.recent_posts", { default: "최신 포스트" });
            case "PopularPosts": return $t("blog.widget.popular_posts", { default: "인기 포스트" });
            case "RecentComments": return $t("admin.theme.widget_type_recent_comments", { default: "최근 댓글" });
            case "RecentGuestbooks": return $t("admin.theme.widget_type_recent_guestbooks", { default: "최근 방명록" });
            case "CategoryList": 
            case "CategoryMenu":
            case "category_link": return $t("blog.widget.categories", { default: "카테고리" });
            case "TagCloud": return $t("blog.widget.tags", { default: "인기 태그" });
            case "PostContent":
            case "post_content": return ""; // 본문 위젯은 제목을 표시하지 않음
            default: return w.name;
        }
    }

    function getWidgetShadowStyle(w: any) {
        const cfg = typeof w.config === 'string' ? JSON.parse(w.config || '{}') : (w.config || {});
        const shadow = cfg.shadow;
        const global = settings?.widget_shadow_global;
        let normal = "none", hover = "none", hoverTranslateY = -2;
        if (shadow && shadow.useGlobal === false) {
            normal = shadow.normal || "none";
            hover = shadow.hover || "none";
            hoverTranslateY = shadow.hoverTranslateY !== undefined ? Number(shadow.hoverTranslateY) : -2;
        } else if (global && global.enabled) {
            normal = global.normal || "none";
            hover = global.hover || "none";
            hoverTranslateY = global.hoverTranslateY !== undefined ? Number(global.hoverTranslateY) : -2;
        }
        return `--widget-normal-shadow: ${normal}; --widget-hover-shadow: ${hover}; --widget-hover-translate-y: ${hoverTranslateY}px;`;
    }

    function getGlobalWidgetStyles() {
        const style = settings?.theme?.widgetItemStyle;
        const titleStyle = settings?.theme?.widgetTitleStyle;
        const globalShadow = settings?.widget_shadow_global;
        let shadowVars = "";

        if (globalShadow?.enabled) {
            shadowVars = `
                --widget-normal-shadow: ${globalShadow.normal || "none"};
                --widget-hover-shadow: ${globalShadow.hover || "none"};
                --widget-hover-translate-y: ${globalShadow.hoverTranslateY ?? -2}px;
            `;
        }

        let vars = `${shadowVars}`;
        if (style) {
            vars += `
                --widget-item-font-family: ${style.fontFamily || "inherit"};
                --widget-item-font-size: ${style.fontSize || "0.95rem"};
                --widget-item-font-weight: ${style.fontWeight || "400"};
                --widget-item-color: ${style.color || "inherit"};
                --widget-item-padding: ${style.padding || "1.5rem"};
            `;
        }
        if (titleStyle) {
            vars += `
                --widget-title-font-family: ${titleStyle.fontFamily || "inherit"};
                --widget-title-font-size: ${titleStyle.fontSize || "1.1rem"};
                --widget-title-font-weight: ${titleStyle.fontWeight || "700"};
                --widget-title-color: ${titleStyle.color || "var(--primary-color)"};
            `;
        }
        return vars;
    }
</script>

<div class="layout-wrapper" style="--d-grid: {desktopGridTemplate}; {getGlobalWidgetStyles()}">
    <!-- Desktop Layout (Hidden on Mobile via CSS) -->
    <div class="desktop-only-layout">
        {#each dCols as widgets, colIdx}
            <div class="layout-column">
                {#each widgets as w}
                    {#if w.type === 'post_content' || w.type === 'PostContent'}
                        <div class="main-content-block widget-item" style={getWidgetShadowStyle(w)}>
                            {@render children()}
                        </div>
                    {:else}
                        <div class="widget-item" style={getWidgetShadowStyle(w)}>
                            {#if (w.customTitle || w.name)}
                                <h3 class="widget-title">{getWidgetTitle(w)}</h3>
                            {/if}
                            <div class="widget-body">
                                {#if w.type === "RecentPosts" && widgetComponents["RecentPosts"]}
                                    {@const Component = widgetComponents["RecentPosts"]}
                                    <Component posts={recentPosts.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                                {:else if (w.type === "CategoryList" || w.type === "CategoryMenu" || w.type === "category_link") && widgetComponents["CategoryList"]}
                                    {@const Component = widgetComponents["CategoryList"]}
                                    <Component {categories} />
                                {:else if w.type === "PopularPosts" && widgetComponents["PopularPosts"]}
                                    {@const Component = widgetComponents["PopularPosts"]}
                                    <Component posts={popularPosts.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                                {:else if w.type === "TagCloud" && widgetComponents["TagCloud"]}
                                    {@const rawCfg = w.config && typeof w.config === "string" ? JSON.parse(w.config) : w.config || {}}
                                    {@const Component = widgetComponents["TagCloud"]}
                                    <Component {tags} config={rawCfg.desktop || rawCfg} cardFontSize={desktopCardFontSize} />
                                {:else if w.type === "RecentComments" && widgetComponents["RecentComments"]}
                                    {@const Component = widgetComponents["RecentComments"]}
                                    <Component comments={recentComments.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                                {:else if w.type === "RecentGuestbooks" && widgetComponents["RecentGuestbooks"]}
                                    {@const Component = widgetComponents["RecentGuestbooks"]}
                                    <Component guestbooks={recentGuestbooks.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                                {:else if w.type === "HtmlWidget" && widgetComponents["HtmlWidget"]}
                                    {@const Component = widgetComponents["HtmlWidget"]}
                                    {@const cfg = typeof w.config === 'string' ? JSON.parse(w.config || '{}') : (w.config || {})}
                                    <Component html={cfg.html || ""} useShadowDom={cfg.useShadowDom ?? true} />
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/each}

                {#if !hasPostContentWidget && colIdx === defaultMainColIdx}
                    <div class="main-content-block widget-item">
                        {@render children()}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Mobile Layout (Hidden on Desktop via CSS) -->
    <div class="mobile-only-layout">
        {#if mWidgets && mWidgets.length > 0}
            <!-- Use explicit mobile widgets if configured -->
            {#each mWidgets as w}
                {#if w.type === 'post_content' || w.type === 'PostContent'}
                    <div class="main-content-block widget-item" style={getWidgetShadowStyle(w)}>
                        {@render children()}
                    </div>
                {:else}
                    <div class="widget-item" style={getWidgetShadowStyle(w)}>
                        {#if (w.customTitle || w.name)}
                            <h3 class="widget-title">{getWidgetTitle(w)}</h3>
                        {/if}
                        <div class="widget-body">
                            {#if w.type === "RecentPosts" && widgetComponents["RecentPosts"]}
                                {@const Component = widgetComponents["RecentPosts"]}
                                <Component posts={recentPosts.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                            {:else if (w.type === "CategoryList" || w.type === "CategoryMenu" || w.type === "category_link") && widgetComponents["CategoryList"]}
                                {@const Component = widgetComponents["CategoryList"]}
                                <Component {categories} />
                            {:else if w.type === "PopularPosts" && widgetComponents["PopularPosts"]}
                                {@const Component = widgetComponents["PopularPosts"]}
                                <Component posts={popularPosts.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                            {:else if w.type === "TagCloud" && widgetComponents["TagCloud"]}
                                {@const rawCfg = w.config && typeof w.config === "string" ? JSON.parse(w.config) : w.config || {}}
                                {@const Component = widgetComponents["TagCloud"]}
                                <Component {tags} config={rawCfg.mobile || rawCfg} cardFontSize={mobileCardFontSize} />
                            {:else if w.type === "RecentComments" && widgetComponents["RecentComments"]}
                                {@const Component = widgetComponents["RecentComments"]}
                                <Component comments={recentComments.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                            {:else if w.type === "RecentGuestbooks" && widgetComponents["RecentGuestbooks"]}
                                {@const Component = widgetComponents["RecentGuestbooks"]}
                                <Component guestbooks={recentGuestbooks.slice(0, w.config?.limit ? parseInt(w.config.limit, 10) : undefined)} />
                            {:else if w.type === "HtmlWidget" && widgetComponents["HtmlWidget"]}
                                {@const Component = widgetComponents["HtmlWidget"]}
                                <Component html={w.config?.html || ""} />
                            {/if}
                        </div>
                    </div>
                {/if}
            {/each}
            
            <!-- Mobile Fallback for PostContent if not in mWidgets -->
            {#if !mWidgets.some(w => w.type === 'post_content' || w.type === 'PostContent')}
                <div class="main-content-block widget-item">
                    {@render children()}
                </div>
            {/if}
        {:else}
            <!-- Fallback: Render dWidgets but flattened (Old behavior but cleaner) -->
            {#each dWidgets as w}
                 {#if w.type === 'post_content' || w.type === 'PostContent'}
                    <div class="main-content-block widget-item" style={getWidgetShadowStyle(w)}>
                        {@render children()}
                    </div>
                 {:else}
                    <div class="widget-item" style={getWidgetShadowStyle(w)}>
                        {#if (w.customTitle || w.name)}
                            <h3 class="widget-title">{getWidgetTitle(w)}</h3>
                        {/if}
                        <div class="widget-body">
                            {#if w.type === "RecentPosts" && widgetComponents["RecentPosts"]}
                                {@const Component = widgetComponents["RecentPosts"]}
                                <Component posts={recentPosts} />
                            {:else if (w.type === "CategoryList" || w.type === "CategoryMenu" || w.type === "category_link") && widgetComponents["CategoryList"]}
                                {@const Component = widgetComponents["CategoryList"]}
                                <Component {categories} />
                            {:else if w.type === "PopularPosts" && widgetComponents["PopularPosts"]}
                                {@const Component = widgetComponents["PopularPosts"]}
                                <Component posts={popularPosts} />
                            {:else if w.type === "TagCloud" && widgetComponents["TagCloud"]}
                                {@const rawCfg = w.config && typeof w.config === "string" ? JSON.parse(w.config) : w.config || {}}
                                {@const Component = widgetComponents["TagCloud"]}
                                <Component {tags} config={rawCfg.mobile || rawCfg} cardFontSize={mobileCardFontSize} />
                            {:else if w.type === "RecentComments" && widgetComponents["RecentComments"]}
                                {@const Component = widgetComponents["RecentComments"]}
                                <Component comments={recentComments} />
                            {:else if w.type === "RecentGuestbooks" && widgetComponents["RecentGuestbooks"]}
                                {@const Component = widgetComponents["RecentGuestbooks"]}
                                <Component guestbooks={recentGuestbooks} />
                            {:else if w.type === "HtmlWidget" && widgetComponents["HtmlWidget"]}
                                {@const Component = widgetComponents["HtmlWidget"]}
                                <Component html={w.config?.html || ""} />
                            {/if}
                        </div>
                    </div>
                 {/if}
            {/each}
        {/if}
    </div>
</div>

<style>
    .layout-wrapper {
        display: grid;
        grid-template-columns: var(--d-grid);
        gap: 2rem;
        width: 100%;
        padding: 0;
        align-items: start;
    }

    .layout-column {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        min-width: 0; /* 중요: 컬럼 내부 콘텐츠가 넘치지 않게 함 */
    }

    .main-content-block {
        width: 100%;
        background-color: var(--surface-color);
        border-radius: 12px;
        min-height: 200px;
    }

    .widget-item {
        background-color: var(--surface-color);
        border-radius: 12px;
        padding: var(--widget-item-padding, 1.5rem);
        box-shadow: var(--widget-normal-shadow, none);
        transition: all 0.3s ease;
        min-width: 0;
        width: 100%;
    }

    .widget-item:hover {
        box-shadow: var(--widget-hover-shadow, var(--widget-normal-shadow, none));
        transform: translateY(var(--widget-hover-translate-y, -2px));
    }

    .widget-title {
        font-family: var(--widget-title-font-family, inherit);
        font-size: var(--widget-title-font-size, 1.1rem);
        font-weight: var(--widget-title-font-weight, 700);
        color: var(--widget-title-color, var(--primary-color));
        border-left: 4px solid var(--primary-color);
        padding-left: 0.75rem;
        margin-bottom: 1.25rem;
    }

    .widget-body {
        font-family: var(--widget-item-font-family);
        font-size: var(--widget-item-font-size);
        font-weight: var(--widget-item-font-weight);
        color: var(--widget-item-color);
    }

    .main-content-block.widget-item {
        /* 본문 위젯 내부 여백을 일반 위젯과 다르게 독립적으로 조절하고 싶을 경우 아래 주석을 해제하여 조절할 수 있습니다. */
        /* padding: 2rem; */
    }

    .desktop-only-layout {
        display: contents;
    }

    .mobile-only-layout {
        display: none;
    }

    @media (max-width: 768px) {
        .layout-wrapper {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            padding: 0;
            align-items: stretch;
        }

        .desktop-only-layout {
            display: none;
        }

        .mobile-only-layout {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .layout-column {
            display: contents; /* 모바일에서는 컬럼 구조를 해체하여 평면화 */
        }
        
        /* 모바일에서는 본문 블록을 최상단으로 올림 */
        .main-content-block {
            order: -1;
        }
    }
</style>
