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
    import { slide } from 'svelte/transition';
    import { ChevronDown } from 'lucide-svelte';
    import type { ComponentType } from 'svelte';

    let {
        title,
        icon: Icon,
        isOpen = $bindable(false),
        children
    }: {
        title: string;
        icon?: ComponentType;
        isOpen?: boolean;
        children: import('svelte').Snippet;
    } = $props();

    function toggle() {
        isOpen = !isOpen;
    }
</script>

<div class="accordion-item">
    <button class="accordion-header" type="button" onclick={toggle} aria-expanded={isOpen}>
        <div class="accordion-title-area">
            {#if Icon}
                <Icon size={18} class="accordion-icon" />
            {/if}
            <span class="depth-2-accordion-title">{title}</span>
        </div>
        <ChevronDown size={18} class="chevron {isOpen ? 'open' : ''}" />
    </button>
    {#if isOpen}
        <div class="accordion-content" transition:slide={{ duration: 200 }}>
            <div class="accordion-content-inner">
                {@render children()}
            </div>
        </div>
    {/if}
</div>

<style>
    .accordion-item {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 0.75rem;
        background-color: #ffffff;
        overflow: hidden;
    }
    
    .accordion-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .accordion-header:hover {
        background-color: #f8fafc;
    }
    
    .accordion-title-area {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .accordion-icon {
        color: #64748b;
    }
    
    .depth-2-accordion-title {
        font-size: 1.125rem; /* 18px */
        font-weight: 700;
        color: #334155;
        margin: 0;
    }
    
    .chevron {
        color: #94a3b8;
        transition: transform 0.2s ease-in-out;
    }
    
    .chevron.open {
        transform: rotate(180deg);
    }
    
    .accordion-content {
        border-top: 1px solid #f1f5f9;
        background-color: #fafafa;
    }
    
    .accordion-content-inner {
        padding: 1.25rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
</style>
