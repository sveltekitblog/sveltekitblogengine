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
</script>

<SeoHead {seo} {settings} {lang} />


<div class="tag-page">
    <header class="tag-header">
        <h1>{$t("blog.tags.title_label", { default: "태그: #" })}{data.tag}</h1>
    </header>

    <PostListGrid 
        {data} 
        posts={data.posts} 
        page={data.page} 
        hasNextPage={data.hasNextPage} 
        baseUrl="/tags/{data.tag}" 
        fallbackMessage={$t("blog.search.no_posts_found", { default: "검색 결과가 없습니다." })}
    />
</div>

<style>
    .tag-page {
        max-width: var(--max-width, 1200px);
        margin: 0 auto;
        padding: 0 1rem;
    }
    .tag-header {
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--primary-color);
    }
    .tag-header h1 {
        font-size: 2rem;
        margin: 0;
        color: var(--text-color);
    }
</style>
