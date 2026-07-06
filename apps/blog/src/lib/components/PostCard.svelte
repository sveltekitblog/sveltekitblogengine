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
    import type { Post } from "$lib/types";
    import { formatDate } from "$lib/utils";
    import { page } from "$app/stores";
    import { t } from "$lib/i18n";

    let { post, pcConfig = {}, index = 0 }: { post: Post; pcConfig?: any; index?: number } = $props();
    const dbDefaultLang = $derived($page.data.dbDefaultLang || "ko");
    let category = $derived(post.categorySlug || "all");
    let otherTranslations = $derived(
        (post.translations || []).filter(
            (tr) => tr.lang !== (post.lang || dbDefaultLang),
        ),
    );

    let cardHoverEffect = $derived.by(() => {
        const hover = pcConfig.hoverEffect || "default";
        if (hover === "lift") return "hover-lift";
        if (hover === "zoom") return "hover-zoom group";
        if (hover === "glow") return "hover-glow";
        return "hover-default";
    });

    let isHorizontal = $derived(pcConfig.layout === "horizontal");
    let imageRatio = $derived(pcConfig.imageRatio || (isHorizontal ? 40 : 50));
    let cardHeightStyle = $derived.by(() => {
        if (pcConfig.cardHeight && pcConfig.cardHeight.trim() !== "") {
            return `height: ${pcConfig.cardHeight};`;
        }
        return "height: 100%;";
    });

    let mobileVars = $derived.by(() => {
        if (pcConfig.cardHeight && pcConfig.cardHeight.trim() !== "") {
            return `
                --pc-mobile-card-height: ${pcConfig.cardHeight};
                --pc-mobile-image-height: ${imageRatio}%;
                --pc-mobile-content-height: unset;
                --pc-mobile-content-overflow: hidden;
            `;
        }
        return "";
    });

    // 레이아웃에 따른 최적화된 이미지 URL 단일 매핑 (캐시 성능 극대화 및 CLS 예방)
    let optimalSrc = $derived.by(() => {
        if (!post.featuredImage) return "";
        const img = post.featuredImage.replace("maxresdefault.jpg", "hqdefault.jpg");
        const desktopUrl = img.replace("/mobile/", "/desktop/").replace("/thumbnail/", "/desktop/");
        
        if (isHorizontal) {
            return desktopUrl.replace("/desktop/", "/thumbnail/"); // 240px
        } else {
            return desktopUrl.replace("/desktop/", "/mobile/"); // 480px
        }
    });

    // 레이아웃에 따른 동적 크기 힌트 (Lighthouse 경고 방지 및 CLS 예방)
    let optimalWidth = $derived(isHorizontal ? 240 : 480);
    let optimalHeight = $derived(isHorizontal ? 135 : 270);

    function getLocalizedUrl(path: string) {
        const lang = $page.params.lang;
        return lang ? `/${lang}${path}` : path;
    }

    // Svelte 5 룬(derived)으로 LCP 대상 여부를 스크립트 단에서 안전하게 연산
    const columns = $derived(Number(pcConfig.columns) || 3);
    const isLcpTarget = $derived(
        index < 4 ||
        (isHorizontal 
            ? false 
            : (pcConfig.layout === "horizontal" ? false : index < columns))
    );
</script>

<article
    class="post-card {cardHoverEffect} {isHorizontal
        ? 'horizontal'
        : 'vertical'}"
    style="
    background: var(--pc-card-bg, #ffffff);
    color: var(--pc-card-text, #333);
    font-size: var(--pc-card-font-size, 1rem);
    --pc-date-color: {pcConfig.dateColor || '#767676'};
    --pc-glow-color: {pcConfig.glowColor || 'rgba(59, 130, 246, 0.5)'};
    {cardHeightStyle}
    {mobileVars}
"
>
    <div class="card-inner">
        <a 
            href={getLocalizedUrl(`/${category}/${post.slug}`)} 
            class="image-link"
            style="
                {isHorizontal
                    ? `width: ${imageRatio}%`
                    : pcConfig.cardHeight && pcConfig.cardHeight.trim() !== ""
                      ? `height: ${imageRatio}%`
                      : `aspect-ratio: ${isHorizontal ? 'auto' : '16/9'}; height: auto;`}
            "
        >
            <div
                class="image-wrapper {post.thumbnailFit === 'contain' ? 'fit-contain' : 'fit-cover'}"
                style="width: 100%; height: 100%;"
            >
                {#if post.featuredImage}
                    <img
                        src={optimalSrc}
                        alt={post.title}
                        loading={isLcpTarget ? "eager" : "lazy"}
                        fetchpriority={isLcpTarget ? "high" : "auto"}
                        width={optimalWidth}
                        height={optimalHeight}
                        onerror={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/no_image_placeholder.webp"; }}
                    />
                {:else}
                    <img
                        src="/images/no_image_placeholder.webp"
                        alt="이미지 없음"
                        loading={isLcpTarget ? "eager" : "lazy"}
                        fetchpriority={isLcpTarget ? "high" : "auto"}
                        width={optimalWidth}
                        height={optimalHeight}
                    />
                {/if}
            </div>
        </a>
        <div
            class="content"
            style={isHorizontal ? `width: ${100 - imageRatio}%` : undefined}
        >
            <a href={getLocalizedUrl(`/${category}/${post.slug}`)} class="title-link">
                <h2 class="title">{post.title}</h2>
            </a>
            <div class="excerpt">{post.excerpt || ""}</div>
            <div class="meta">
                <div class="meta-row1">
                    {#if category !== "all"}
                        <a
                            href={getLocalizedUrl(`/${category}`)}
                            class="category-tag {pcConfig.badgeOpacity
                                ? 'with-opacity'
                                : ''}"
                            style="background: var(--pc-badge-bg, var(--primary-color)); color: var(--pc-badge-color, white);"
                        >
                            {post.categoryName || category}
                        </a>
                    {/if}
                    {#if otherTranslations.length > 0}
                        <div class="lang-badges">
                            {#each otherTranslations as tr}
                                <span class="lang-badge">
                                    {$t(`common.lang.${tr.lang}`, { default: tr.lang.toUpperCase() })}
                                </span>
                            {/each}
                        </div>
                    {/if}
                    <div class="stats" style="color: var(--pc-date-color);">
                        <span class="stat-item" title={$t("blog.post.views_tooltip", { default: "조회수" })}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-eye"
                                ><path
                                    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
                                /><circle cx="12" cy="12" r="3" /></svg
                            >
                            {post.view_count || 0}
                        </span>
                        <span class="stat-item" title={$t("blog.post.likes_tooltip", { default: "좋아요" })}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-heart"
                                ><path
                                    d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                                /></svg
                            >
                            {post.like_count || 0}
                        </span>
                    </div>
                    <time
                        class="post-date desktop-only {pcConfig.metaOpacity === false
                            ? ''
                            : 'with-opacity'}"
                        style="color: var(--pc-date-color);"
                        >{formatDate(post.displayDate || post.createdAt, $page.data.settings?.timezone || 'Asia/Seoul')}</time
                    >
                    <time
                        class="post-date mobile-only {pcConfig.metaOpacity === false
                            ? ''
                            : 'with-opacity'}"
                        style="color: var(--pc-date-color);"
                        >{formatDate(post.displayDate || post.createdAt, $page.data.settings?.timezone || 'Asia/Seoul', false)}</time
                    >
                </div>
            </div>
        </div>
    </div>
</article>

<style>
    .mobile-only {
        display: none !important;
    }
    /* Dynamic layout styles */
    .post-card {
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        position: relative;
    }

    /* Layout orientation & Link reset */
    .post-card a {
        text-decoration: none;
        color: inherit;
    }
    .card-inner {
        display: flex;
        height: 100%;
        width: 100%;
    }
    .post-card.vertical .card-inner {
        flex-direction: column;
    }
    .post-card.horizontal .card-inner {
        flex-direction: row;
        align-items: stretch;
    }
    .image-link {
        display: block;
        flex-shrink: 0;
        overflow: hidden;
    }
    .title-link {
        display: inline-block;
    }
    .title-link:hover .title {
        opacity: 0.8;
    }

    /* Hover Effects */
    .hover-default:hover {
        opacity: 0.9;
    }
    .hover-lift:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 25px rgba(0, 0, 0, 0.1);
    }
    .hover-glow:hover {
        box-shadow: 0 0 15px var(--pc-glow-color);
    }
    .hover-zoom img {
        transition: transform 0.3s ease;
    }
    .post-card.hover-zoom:hover img {
        transform: scale(1.1);
    }

    .image-wrapper {
        aspect-ratio: 16/9;
        overflow: hidden;
        background: #f0f0f0;
        flex-shrink: 0;
    }

    .image-wrapper.fit-contain {
        background: #f8fafc; /* 부드러운 중성 회색 배경 */
    }

    .image-wrapper.fit-contain img {
        object-fit: contain;
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #aaa;
        font-weight: 500;
        background: #f5f5f5;
    }
    .content {
        padding: 1.5rem;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .post-card.horizontal .content {
        justify-content: center;
        gap: 0.75rem;
    }
    .title {
        margin: 0 0 0.75rem 0;
        font-size: 1.25em;
        font-weight: 700;
        line-height: 1.3;
        color: inherit;
    }
    .excerpt {
        font-size: 0.8em;
        color: #767676;
        line-height: 1.6;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex-shrink: 1;
    }
    .meta {
        margin-top: auto;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .post-card.horizontal .meta {
        margin-top: 0;
    }
    .meta-row1 {
        display: contents; /* transparent wrapper: children go into .meta flex */
    }
    /* stats: push date to right by eating remaining space */
    .stats {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .post-date {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 0;
        margin-left: auto; /* date pushed to far right on desktop */
    }
    .post-date.with-opacity {
        opacity: 0.8;
    }

    .stats.with-opacity {
        opacity: 0.8;
    }
    .stat-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    .category-tag {
        padding: 0.15rem 0.4rem; /* 다국어 배지와 크기 완벽 통일 */
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.8em;        /* 메타 영역 기본 폰트 크기로 축소 및 통일 */
        line-height: 1.2;        /* 높이 정렬 통일 */
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
        display: inline-block;
        transition: all 0.2s ease;
    }
    .category-tag.with-opacity {
        opacity: 0.8;
    }
    .category-tag:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    time.post-date {
        font-weight: 500;
    }
    time.post-date.with-opacity {
        opacity: 0.8;
    }

    /* Language badges */
    .lang-badges {
        display: flex;
        gap: 0.25rem; /* 배지 간 조밀한 일관성 부여 */
        align-items: center;
    }
    .lang-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.15rem 0.4rem;  /* 카테고리 태그와 패딩 통일 */
        border-radius: 4px;
        font-size: 0.8em;         /* 카테고리 태그와 글자 크기 완벽 통일 */
        font-weight: 700;
        font-family: inherit;
        background: #e0e7ff;
        color: #3730a3;
        letter-spacing: 0.03em;
        line-height: 1.2;         /* 카테고리 태그와 line-height 통일 */
    }

    @media (max-width: 768px) {
        /* Mobile horizontal: keep horizontal but adapt sizing */
        .post-card.horizontal .image-wrapper {
            max-height: 180px;
        }
        .post-card.horizontal .content {
            padding: 0.8rem;
        }

        /* Prevent cardHeight from clipping text on mobile */
        .post-card {
            height: var(--pc-mobile-card-height, auto) !important;
        }
        .card-inner {
            height: var(--pc-mobile-card-height, auto) !important;
        }

        /* Image: fixed height so text always has space below */
        .post-card.vertical .image-wrapper {
            height: var(--pc-mobile-image-height, 200px) !important;
            flex-shrink: 0;
            /* aspect-ratio를 강제 해제(unset)하지 않고 HTML 변수를 보존하여 사전 공간 레이아웃 예약을 정상 수행시킴 */
        }

        /* Content: full padding, no clipping */
        .content {
            height: var(--pc-mobile-content-height, auto) !important;
            overflow: var(--pc-mobile-content-overflow, visible);
            padding: 1rem;
        }
        .title {
            font-size: 1.05em;
            margin-bottom: 0.5rem;
            word-break: break-word;
            overflow-wrap: break-word;
        }
        .excerpt {
            margin-bottom: 0.75rem;
            font-size: 0.85em;
        }

        /* Mobile meta: 2-row layout */
        .meta {
            flex-direction: column;
            align-items: stretch;
            gap: 0.25rem;
        }
        .lang-badges {
            display: none !important;
        }
        /* Row1: badge left, stats pushed right via margin-left:auto */
        .meta-row1 {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            /* NO space-between: avoids overflow past card edge */
        }
        .meta-row1 .stats {
            margin-left: auto; /* push stats to right within safe bounds */
            flex-shrink: 0;
        }
        /* Row2: date left-aligned, truncated */
        .post-date {
            display: block;
            text-align: left;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-left: 0; /* reset desktop margin-left:auto */
        }
        .desktop-only {
            display: none !important;
        }
        .mobile-only {
            display: block !important;
        }
    }
</style>
