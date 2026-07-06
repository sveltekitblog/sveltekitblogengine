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
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import type { ThemeConfig } from "$lib/types";
    import { untrack } from "svelte";

    let { data, form } = $props<{ data: PageData; form: ActionData }>();

    let theme = $state(untrack(() => data.theme));
    let config = $state<ThemeConfig>(untrack(() => data.theme.config));
    let jsonError = $state("");
</script>

<div class="editor-container">
    <div class="sidebar">
        <div class="header">
            <a href="/themes">← Back</a>
            <h2>Edit Theme</h2>
        </div>

        <form method="POST" action="?/save" use:enhance>
            <div class="form-group">
                <label for="name">Name</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    bind:value={theme.name}
                    required
                />
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea
                    id="description"
                    name="description"
                    bind:value={theme.description}
                    rows="2"
                ></textarea>
            </div>

            <hr />

            <h3>Colors</h3>
            <div class="color-grid">
                <div class="color-control">
                    <label>Primary</label>
                    <input type="color" bind:value={config.colors.primary} />
                    <span>{config.colors.primary}</span>
                </div>
                <div class="color-control">
                    <label>Secondary</label>
                    <input type="color" bind:value={config.colors.secondary} />
                    <span>{config.colors.secondary}</span>
                </div>
                <div class="color-control">
                    <label>Background</label>
                    <input type="color" bind:value={config.colors.background} />
                </div>
                <div class="color-control">
                    <label>Text</label>
                    <input type="color" bind:value={config.colors.text} />
                </div>
            </div>

            <hr />

            <h3>Header & Layout</h3>
            <div class="form-group">
                <label>Header Type</label>
                <select bind:value={config.header.type}>
                    <option value="fixed">Fixed</option>
                    <option value="sticky">Sticky</option>
                    <option value="static">Static</option>
                </select>
            </div>

            <div class="form-group">
                <label>Max Width</label>
                <input type="text" bind:value={config.layout.maxWidth} />
            </div>

            <hr />

            <div class="form-group">
                <label>Raw JSON Config</label>
                <textarea
                    name="config"
                    value={JSON.stringify(config, null, 2)}
                    class="code-editor"
                    rows="10"
                ></textarea>
            </div>

            <div class="actions">
                <button type="submit" class="btn-primary">Save Changes</button>
                {#if form?.success}
                    <span class="success">Saved!</span>
                {/if}
            </div>
        </form>
    </div>

    <div
        class="preview-pane"
        style="
        --color-primary: {config.colors.primary};
        --color-secondary: {config.colors.secondary};
        --color-bg: {config.colors.background};
        --color-text: {config.colors.text};
        --font-heading: {config.fonts.heading};
        --max-width: {config.layout.maxWidth};
    "
    >
        <div class="preview-header">Live Preview (Internal Mock)</div>

        <div class="mock-browser">
            <!-- Mock Header -->
            <header
                class="mock-nav"
                style="position: {config.header.type === 'fixed'
                    ? 'absolute'
                    : 'relative'}; height: {config.header.height}"
            >
                <div class="logo">{config.header.logo.content}</div>
                <nav>
                    {#each config.header.nav as item}
                        <a href="#">{item.label}</a>
                    {/each}
                </nav>
            </header>

            <!-- Mock Content -->
            <main class="mock-content">
                <h1>Hello, World!</h1>
                <p>This is a preview of your blog theme.</p>

                <div
                    class="mock-cards"
                    style="grid-template-columns: repeat({config.layout
                        .gridColumns}, 1fr)"
                >
                    {#each [1, 2, 3] as i}
                        <article class="mock-card">
                            <div class="img-placeholder"></div>
                            <h3>Sample Post {i}</h3>
                            <button class="mock-btn">Read More</button>
                        </article>
                    {/each}
                </div>
            </main>
        </div>
    </div>
</div>

<style>
    .editor-container {
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 2rem;
        height: calc(100vh - 4rem);
    }
    .sidebar {
        overflow-y: auto;
        padding-right: 1rem;
        border-right: 1px solid #eee;
    }
    .preview-pane {
        background: #f0f0f0;
        border-radius: 8px;
        padding: 2rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .form-group {
        margin-bottom: 1rem;
    }
    label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
    }
    input[type="text"],
    select,
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    .color-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
    }
    .color-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
    }
    .code-editor {
        font-family: monospace;
        font-size: 0.8rem;
    }
    .btn-primary {
        background: #111827;
        color: white;
        border: none;
        padding: 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
    }

    /* Preview Styles using Variables */
    .mock-browser {
        background: var(--color-bg);
        color: var(--color-text);
        min-height: 500px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        border-radius: 8px;
        overflow: hidden;
        font-family: var(--font-heading), sans-serif;
    }
    .mock-nav {
        background: var(--color-primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1rem;
        width: 100%;
    }
    .mock-nav a {
        color: white;
        text-decoration: none;
        margin-left: 1rem;
        opacity: 0.8;
    }
    .mock-content {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 2rem;
    }
    .mock-cards {
        display: grid;
        gap: 1rem;
        margin-top: 2rem;
    }
    .mock-card {
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 1rem;
    }
    .img-placeholder {
        background: #eee;
        height: 120px;
        margin-bottom: 1rem;
        border-radius: 4px;
    }
    .mock-btn {
        background: var(--color-secondary);
        color: white;
        border: none;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
    }
</style>
