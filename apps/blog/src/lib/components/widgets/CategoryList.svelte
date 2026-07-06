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
    let { categories }: { categories: any[] } = $props();

    function getLocalizedUrl(path: string) {
        const lang = $page.params.lang;
        return lang ? `/${lang}${path}` : path;
    }
</script>

<ul class="category-list-widget">
    {#each categories as category}
        <li>
            <a href={getLocalizedUrl(`/${category.slug}`)}>
                {category.name}
            </a>
        </li>
    {/each}
</ul>

<style>
    .category-list-widget {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    a {
        text-decoration: none;
        color: var(--widget-item-color, var(--text-color));
        font-weight: var(--widget-item-font-weight, 500);
        font-size: var(--widget-item-font-size, 0.95rem);
        font-family: var(--widget-item-font-family, inherit);
        display: flex;
        justify-content: space-between;
    }
    a:hover {
        color: var(--primary-color);
    }
</style>
