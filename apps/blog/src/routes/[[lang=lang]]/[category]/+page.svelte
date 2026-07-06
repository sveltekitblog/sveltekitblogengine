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
    import PostListGrid from "$lib/components/PostListGrid.svelte";
    import SeoHead from "$lib/components/SeoHead.svelte";
    import { t } from "$lib/i18n";
    let { data } = $props();
    const { seo, settings, lang } = $derived(data);
    
    // 카테고리 슬러그에 해당하는 실제 다국어 카테고리명 찾기
    const categoryName = $derived(
        data.categories?.find((c: any) => c.slug === data.category)?.name || data.category
    );
</script>

<SeoHead {seo} {settings} />


{#if data.type === 'category'}
    <div class="category-page">
        <header class="category-header">
            <h1>{$t("blog.categories.title_label", { default: "카테고리: " })}{categoryName}</h1>
        </header>

        <PostListGrid 
            {data} 
            posts={data.posts} 
            page={data.page} 
            hasNextPage={data.hasNextPage} 
            baseUrl="/{data.category}" 
            fallbackMessage={$t("blog.categories.empty_posts", { default: "해당 카테고리에 글이 없습니다." })}
        />
    </div>
{:else if data.type === 'custom_page'}
    <div class="custom-page-container w-full max-w-[var(--max-width,1200px)] mx-auto px-4 py-8">
        {@html data.page.htmlContent}
    </div>
{:else}
    <!-- 정적 페이지 (cms_page) 분기 -->
    <div class="cms-page-container w-full max-w-[var(--max-width,1200px)] mx-auto px-4 py-8">
        <div class="prose max-w-none">
            {@html data.page.content}
        </div>
    </div>
{/if}

<style>
    .category-page {
        max-width: var(--max-width, 1200px);
        margin: 0 auto;
        padding: 0 1rem;
    }
    .category-header {
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--primary-color);
    }
    .category-header h1 {
        font-size: 2rem;
        margin: 0;
        color: var(--text-color);
    }
</style>
