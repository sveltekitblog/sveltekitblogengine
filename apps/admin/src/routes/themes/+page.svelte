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
    import type { PageData } from "./$types";

    let { data } = $props<{ data: PageData }>();
</script>

<div class="header">
    <h1>Themes</h1>
    <a href="/themes/new" class="btn-primary">New Theme</a>
</div>

<div class="grid">
    {#each data.themes as theme}
        <div class="card">
            <div class="card-header">
                <h3>{theme.name}</h3>
                {#if theme.is_system}<span class="badge">System</span>{/if}
            </div>
            <p>{theme.description || "No description"}</p>
            <div class="actions">
                <a href="/themes/{theme.id}" class="btn-text">Edit</a>
                {#if !theme.is_system}
                    <form method="POST" action="?/delete" use:enhance>
                        <input type="hidden" name="id" value={theme.id} />
                        <button type="submit" class="btn-text danger"
                            >Delete</button
                        >
                    </form>
                {/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }
    .card {
        background: white;
        padding: 1.5rem;
        border-radius: 0.75rem;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    }
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 0.5rem;
    }
    h3 {
        margin: 0;
        font-size: 1.125rem;
    }
    p {
        color: #6b7280;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
    }
    .badge {
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .actions {
        display: flex;
        gap: 1rem;
        border-top: 1px solid #f3f4f6;
        padding-top: 1rem;
    }
    .btn-primary {
        background: #111827;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        text-decoration: none;
    }
    .btn-text {
        background: none;
        border: none;
        color: #4b5563;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
        font-size: 0.875rem;
    }
    .btn-text.danger {
        color: #ef4444;
    }
    .btn-text:hover {
        text-decoration: underline;
    }
</style>
