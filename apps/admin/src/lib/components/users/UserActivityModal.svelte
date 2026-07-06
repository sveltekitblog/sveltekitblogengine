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
    import { t } from "$lib/i18n.svelte";
    import { X, MessageSquare, BookOpen } from "lucide-svelte";
    import { onMount } from "svelte";

    let { userId, userName, onClose }: { userId: string, userName: string, onClose: () => void } = $props();

    let entries = $state<any[]>([]);
    let loading = $state(true);
    let error = $state("");

    onMount(async () => {
        try {
            const res = await fetch(`/api/users/${userId}/activity`);
            if (res.ok) {
                const data = await res.json();
                entries = data.entries;
            } else {
                error = "Failed to load activity";
            }
        } catch (e) {
            error = "An error occurred";
        } finally {
            loading = false;
        }
    });

    function formatDate(dstr: string | null) {
        if (!dstr) return '';
        try { return new Date(dstr).toLocaleString(); } catch { return dstr; }
    }
</script>

<div class="modal-backdrop" onclick={onClose}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
            <h3>{t('admin.users.modal_activity_title', { name: userName })}</h3>
            <button class="close-btn" onclick={onClose}><X size={20}/></button>
        </div>

        <div class="modal-body">
            {#if loading}
                <div class="loader">{t('admin.common.loading', { default: '로딩 중...' })}</div>
            {:else if error}
                <div class="error">{error}</div>
            {:else if entries.length === 0}
                <div class="empty">{t('admin.users.activity_empty')}</div>
            {:else}
                <ul class="activity-list">
                    {#each entries as entry}
                        <li class="activity-item">
                            <div class="icon">
                                {#if entry.type === 'comment'}
                                    <MessageSquare size={16} title="Comment"/>
                                {:else}
                                    <BookOpen size={16} title="Guestbook"/>
                                {/if}
                            </div>
                            <div class="details">
                                <p class="entry-content">{entry.content}</p>
                                <span class="entry-date">
                                    {t('admin.users.activity_at', { date: formatDate(entry.createdAt || entry.created_at) })}
                                    {#if entry.target_id || entry.targetId}
                                        | ID: {entry.target_id || entry.targetId}
                                    {/if}
                                </span>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
    }
    .modal-content {
        background: white;
        width: 100%;
        max-width: 600px;
        max-height: 80vh;
        border-radius: 0.75rem;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .modal-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        color: #111827;
    }
    .close-btn {
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 0.25rem;
        display: flex;
    }
    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
        flex: 1;
    }
    .activity-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .activity-item {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid #f3f4f6;
    }
    .activity-item:last-child { border-bottom: none; }
    .icon {
        color: #3b82f6;
        margin-top: 0.1rem;
    }
    .entry-content {
        margin: 0 0 0.4rem 0;
        color: #374151;
        line-height: 1.5;
        white-space: pre-wrap;
    }
    .entry-date {
        font-size: 0.8rem;
        color: #9ca3af;
    }
    .loader, .empty, .error {
        text-align: center;
        padding: 3rem 0;
        color: #6b7280;
    }
    .error { color: #ef4444; }
</style>
