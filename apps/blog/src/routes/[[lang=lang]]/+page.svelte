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
    import { t } from "$lib/i18n";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const { seo, settings, lang } = $derived(data);
    import SeoHead from "$lib/components/SeoHead.svelte";

    let siteTitle = $derived(data.settings?.site_title || "My Blog");
    let siteDescription = $derived(
        data.settings?.description || "Welcome to my blog",
    );
</script>


<SeoHead {seo} {settings} />

<h1 class="sr-only">{siteTitle}</h1>

<PostListGrid 
    {data} 
    posts={data.posts} 
    page={data.page} 
    hasNextPage={data.hasNextPage} 
    baseUrl="/" 
    fallbackMessage={$t("blog.common.empty_posts", { default: "아직 작성된 글이 없습니다. 관리자 페이지에서 첫 포스트를 작성해보세요!" })}
/>

<style>
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }
</style>
