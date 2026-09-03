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
    import { page } from "$app/stores";

    let { tags, config = {}, cardFontSize }: { tags: string[]; config?: any; cardFontSize?: string } = $props();

    function getLocalizedUrl(path: string) {
        const lang = $page.params.lang;
        return lang ? `/${lang}${path}` : path;
    }

    let currentPage = $state(1);

    let displayTags = $derived.by(() => {
        let t = [...tags];
        if (config?.sortOrder === "alphabet") {
            t.sort((a, b) => a.localeCompare(b, "ko-KR"));
        } else if (config?.sortOrder === "latest") {
            t.reverse();
        }

        const perPage = Number(config?.maxTags || config?.tagsPerPage || 0);
        if (perPage > 0) {
            const start = (currentPage - 1) * perPage;
            return t.slice(start, start + perPage);
        }
        return t;
    });

    let totalPages = $derived.by(() => {
        const perPage = Number(config?.maxTags || config?.tagsPerPage || 0);
        if (perPage > 0 && tags.length > 0) {
            return Math.ceil(tags.length / perPage);
        }
        return 1;
    });

    function changePage(delta: number) {
        const newPage = currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
        }
    }
</script>

<div class="tag-cloud-widget">
    <div class="tags-container">
        {#each displayTags as tag}
            <a href={getLocalizedUrl(`/tags/${tag}`)} class="tag" style={cardFontSize ? `--tag-font-size: ${cardFontSize}` : undefined}>
                #{tag}
            </a>
        {/each}
    </div>

    {#if totalPages > 1}
        <div class="tag-pagination">
            <button 
                class="page-btn" 
                onclick={() => changePage(-1)} 
                disabled={currentPage === 1}
                aria-label="Previous Tags"
            >
                &lt;&lt;
            </button>
            <span class="page-info">{currentPage} / {totalPages}</span>
            <button 
                class="page-btn" 
                onclick={() => changePage(1)} 
                disabled={currentPage === totalPages}
                aria-label="Next Tags"
            >
                &gt;&gt;
            </button>
        </div>
    {/if}
</div>

<style>
    .tag-cloud-widget {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
        width: 100%;
    }
    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        min-width: 0;
        width: 100%;
    }
    .tag {
        font-size: var(--tag-font-size, var(--widget-item-font-size, 0.85rem));
        color: var(--widget-item-color, #666);
        font-family: var(--widget-item-font-family, inherit);
        font-weight: var(--widget-item-font-weight, 400);
        background: #f3f4f6;
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        text-decoration: none;
        transition: all 0.2s ease;
        display: inline-block;
        max-width: 100%;
        min-width: 0;
        word-break: break-all;
        overflow-wrap: break-word;
    }
    .tag:hover {
        background: var(--primary-color);
        color: white;
    }
    .tag-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
        font-size: 0.85rem;
        color: #666;
    }
    .page-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--primary-color);
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        transition: opacity 0.2s;
    }
    .page-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .page-info {
        font-family: monospace;
        letter-spacing: 0.5px;
    }
</style>
