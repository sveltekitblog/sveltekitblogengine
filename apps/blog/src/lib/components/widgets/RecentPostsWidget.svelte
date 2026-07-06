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

<!-- RecentPostsWidget.svelte -->
<script lang="ts">
    import type { Post } from "$lib/types";
    import { formatDate } from "$lib/utils";
    import { page } from "$app/stores";
    let { posts }: { posts: Post[] } = $props();

    function getLocalizedUrl(path: string) {
        const lang = $page.params.lang;
        return lang ? `/${lang}${path}` : path;
    }
</script>

<ul class="recent-posts-widget">
    {#each posts as post}
        <li>
            <a href={getLocalizedUrl(`/${post.categorySlug || 'all'}/${post.slug}`)}>
                {post.title}
            </a>
            <span class="date"
                >{formatDate(post.displayDate || post.createdAt, $page.data.settings?.timezone || 'Asia/Seoul')}</span
            >
        </li>
    {/each}
</ul>

<style>
    .recent-posts-widget {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    a {
        text-decoration: none;
        color: var(--widget-item-color, var(--text-color));
        font-weight: var(--widget-item-font-weight, 500);
        font-size: var(--widget-item-font-size, 0.95rem);
        font-family: var(--widget-item-font-family, inherit);
        display: block;
        line-height: 1.4;
    }
    a:hover {
        color: var(--primary-color);
    }
    .date {
        font-size: 0.8rem;
        color: #767676;
    }
</style>
