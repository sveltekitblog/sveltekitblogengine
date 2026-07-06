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
    import { t } from "$lib/i18n";
    import { page } from "$app/stores";

    let { comments = [] }: { comments: any[] } = $props();

    const dbDefaultLang = $derived($page.data.dbDefaultLang || "ko");
    const lang = $derived($page.params.lang || $page.data.lang || dbDefaultLang);
</script>

<div class="recent-comments-widget">
    {#if comments.length === 0}
        <div class="widget-empty">{$t("admin.dashboard.recent.empty_comments", { default: "최근 등록된 댓글이 없습니다." })}</div>
    {:else}
        <ul class="widget-list">
            {#each comments as comment}
                {@const langPrefix = lang === dbDefaultLang ? "" : `/${lang}`}
                <li class="widget-item">
                    <a href={`${langPrefix}/${comment.post_category || 'all'}/${comment.post_slug}`} class="widget-link" title={`${comment.user_name} ➔ ${comment.post_title}`}>
                        {$t("blog.widget.recent_comments_format", { author_name: comment.user_name, post_title: comment.post_title })}
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .recent-comments-widget {
        width: 100%;
    }
    .widget-loading, .widget-empty {
        font-size: 0.875rem;
        color: #475569;
        padding: 0.5rem 0;
    }
    .widget-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .widget-item {
        width: 100%;
        display: block;
    }
    .widget-link {
        display: block;
        font-size: var(--widget-item-font-size, 0.95rem);
        color: var(--widget-item-color, #475569);
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.2s ease;
    }
    .widget-link:hover {
        color: var(--primary-color, #3b82f6);
    }
</style>
