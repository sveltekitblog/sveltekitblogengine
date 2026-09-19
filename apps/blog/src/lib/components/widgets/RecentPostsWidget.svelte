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

<ul class="recent-posts-widget widget-posts-list" data-widget-list="recent-posts">
    {#each posts as post}
        <li class="post-item" data-post-slug={post.slug}>
            <a href={getLocalizedUrl(`/${post.categorySlug || 'all'}/${post.slug}`)} class="post-link" title={post.title} aria-label={post.title}>
                <span class="title post-title">{post.title}</span>
            </a>
            <div class="meta post-meta">
                <time class="date post-date" datetime={post.displayDate || post.createdAt}>{formatDate(post.displayDate || post.createdAt, $page.data.settings?.timezone || 'Asia/Seoul')}</time>
            </div>
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
        gap: 0;
    }
    li {
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 0.5rem;
        padding-top: 0.5rem;
    }
    li:first-child {
        padding-top: 0;
    }
    li:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }
    .title {
        font-weight: var(--widget-item-font-weight, 500);
        font-size: var(--widget-item-font-size, 0.95rem);
        color: var(--widget-item-color, var(--text-color));
        font-family: var(--widget-item-font-family, inherit);
        line-height: 1.4;
    }
    a {
        text-decoration: none;
        display: block;
    }
    a:hover .title {
        color: var(--primary-color);
    }
    .meta {
        font-size: 0.8rem;
        color: #767676;
        margin-top: 0.25rem;
    }
    .date {
        font-size: 0.8rem;
        color: #767676;
    }
</style>
