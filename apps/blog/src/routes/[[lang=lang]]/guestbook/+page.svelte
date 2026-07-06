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
    import { onMount } from "svelte";
    import {
        MessageSquare,
        Send,
        Trash2,
        Lock,
        Reply,
        CornerDownRight,
        AlertCircle,
    } from "lucide-svelte";
    import { formatDate as formatTime } from "$lib/utils";
    import { page } from "$app/stores";
    import { t } from "$lib/i18n";
    import SeoHead from "$lib/components/SeoHead.svelte";

    let { data } = $props();
    const { seo, settings, lang } = $derived(data);
    let currentUser = $derived(data.user);
    const anyUser = $derived(currentUser as any);

    // 차단 여부 계산
    const isBanned = $derived.by(() => {
        if (!anyUser?.banned) return false;
        if (!anyUser.ban_expires) return true;
        return new Date(anyUser.ban_expires) > new Date();
    });

    const banReasonVisible = $derived(
        anyUser?.show_ban_reason === true || anyUser?.show_ban_reason === 1,
    );

    function formatDate(dstr: string | number | null, customTimezone?: string) {
        if (!dstr) return "";
        return formatTime(dstr, customTimezone || data.settings?.timezone || 'Asia/Seoul');
    }

    let entries = $state<any[]>([]);
    let isLoading = $state(true);
    let content = $state("");
    let isPrivate = $state(false);
    let isSubmitting = $state(false);

    // Reply state
    let replyingTo = $state<string | null>(null);
    let replyContent = $state("");
    let isReplySubmitting = $state(false);

    // Build nested structure with recursive filtering (Zombie Cleanup)
    let nestedEntries = $derived.by(() => {
        const topLevel = entries.filter((e) => !e.parentId);
        const replies = entries.filter((e) => e.parentId);

        const getDescendants = (parentId: string): any[] => {
            const children = replies
                .filter((r) => r.parentId === parentId)
                .sort(
                    (a, b) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime(),
                );

            let all: any[] = [];
            for (const child of children) {
                const subChildren = getDescendants(child.id);
                // Pruning logic for descendants
                if (!child.isDeleted || subChildren.length > 0) {
                    all.push(child);
                    all.push(...subChildren);
                }
            }
            return all;
        };

        const result = topLevel
            .map((entry) => {
                const descendants = getDescendants(entry.id);
                // Prune top-level zombie if no children
                if (entry.isDeleted && descendants.length === 0) return null;
                return {
                    ...entry,
                    replies: descendants,
                };
            })
            .filter((e) => e !== null);

        // Sort top-level by newest first
        return result.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );
    });

    async function fetchEntries() {
        try {
            const res = await fetch("/api/entries?type=guestbook");
            if (res.ok) {
                entries = await res.json();
            } else {
                const err = await res.json();
                console.error("Failed to load guestbook:", err);
            }
        } catch (e) {
            console.error(e);
        } finally {
            isLoading = false;
        }
    }

    async function handleSubmit() {
        if (!content.trim() || isSubmitting) return;

        isSubmitting = true;
        try {
            const res = await fetch("/api/entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "guestbook",
                    content: content.trim(),
                    isPrivate,
                    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (res.ok) {
                const newEntry = await res.json();
                entries = [newEntry, ...entries];
                content = "";
                isPrivate = false;
            } else {
                const err = await res.json();
                alert($t("blog.guestbook.fail") + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
            alert($t("blog.guestbook.error"));
        } finally {
            isSubmitting = false;
        }
    }

    async function handleReplySubmit(parentId: string) {
        if (!replyContent.trim() || isReplySubmitting) return;

        isReplySubmitting = true;
        try {
            const res = await fetch("/api/entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "guestbook",
                    content: replyContent.trim(),
                    parentId,
                    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (res.ok) {
                const newReply = await res.json();
                entries = [...entries, newReply];
                replyContent = "";
                replyingTo = null;
            } else {
                const err = await res.json();
                alert($t("blog.guestbook.reply_fail") + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
            alert($t("blog.guestbook.error"));
        } finally {
            isReplySubmitting = false;
        }
    }

    let showDeleteModal = $state(false);
    let pendingDeleteId = $state<string | null>(null);
    let hoverCancel = $state(false);
    let hoverConfirm = $state(false);

    function handleDelete(id: string) {
        pendingDeleteId = id;
        showDeleteModal = true;
    }

    async function executeDelete() {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        showDeleteModal = false;
        pendingDeleteId = null;

        try {
            const res = await fetch("/api/entries", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                // Soft delete locally to trigger derived store update
                entries = entries.map((e: any) =>
                    e.id === id
                        ? {
                              ...e,
                              isDeleted: true,
                              content: $t("blog.guestbook.deleted"),
                          }
                        : e,
                );
            } else {
                const err = await res.json();
                alert($t("blog.guestbook.delete_fail") + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
        }
    }

    function startReply(entryId: string) {
        replyingTo = entryId;
        replyContent = "";
    }

    function cancelReply() {
        replyingTo = null;
        replyContent = "";
    }

    onMount(() => {
        fetchEntries();
    });
</script>


<div class="guestbook-page">
    <div class="page-header">
        <MessageSquare size={28} />
        <h1>{$t("blog.guestbook.title", { default: "방명록" })}</h1>
    </div>

    <p class="description">
        {$t("blog.guestbook.desc")}
    </p>

    <!-- Write Form -->
    <div class="write-section">
        {#if currentUser}
            {#if isBanned}
                <div class="ban-notice">
                    <div class="notice-header">
                        <AlertCircle size={22} />
                        <strong>{$t("blog.guestbook.ban_notice")}</strong>
                    </div>
                    <div class="notice-body">
                        <p>
                            {$t("blog.guestbook.ban_expires")}: {anyUser.ban_expires ? formatDate(anyUser.ban_expires) : $t("blog.guestbook.ban_permanent")}
                        </p>
                        {#if banReasonVisible && anyUser.ban_reason}
                            <p>{$t("blog.guestbook.ban_reason")}: {anyUser.ban_reason}</p>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="write-form">
                    <div class="user-info">
                        {#if currentUser.image}
                            <img
                                src={currentUser.image}
                                alt={currentUser.name}
                                class="avatar"
                            />
                        {:else}
                            <div class="avatar-placeholder">
                                {currentUser.name?.[0] || "?"}
                            </div>
                        {/if}
                        <span class="username">{currentUser.name}</span>
                    </div>
                    <textarea
                        bind:value={content}
                        placeholder={$t("blog.guestbook.placeholder")}
                        rows="3"
                        disabled={isSubmitting}
                    ></textarea>
                    <div class="form-actions">
                        <label class="private-toggle">
                            <input type="checkbox" bind:checked={isPrivate} />
                            <Lock size={14} />
                            <span>{$t("blog.guestbook.private")}</span>
                        </label>
                        <button
                            class="submit-btn"
                            onclick={handleSubmit}
                            disabled={!content.trim() || isSubmitting}
                        >
                            <Send size={16} />
                            <span>{isSubmitting ? $t("blog.guestbook.submitting") : $t("blog.guestbook.submit")}</span>
                        </button>
                    </div>
                </div>
            {/if}
        {:else}
            <div class="login-prompt">
                {$t("blog.guestbook.login_required_prefix")}<a href="/login">{$t("blog.nav.login")}</a>{$t("blog.guestbook.login_required_suffix")}
            </div>
        {/if}
    </div>

    <!-- Entries List -->
    <div class="entries-list">
        {#if isLoading}
            <div class="loading">{$t("blog.guestbook.loading")}</div>
        {:else if nestedEntries.length === 0}
            <div class="empty-state">
                {$t("blog.guestbook.empty")}
            </div>
        {:else}
            {#each nestedEntries as entry (entry.id)}
                <div class="entry-item" class:private={entry.isPrivate}>
                    <div class="entry-header">
                        {#if entry.user?.image}
                            <img
                                src={entry.user.image}
                                alt={entry.user?.name || $t("blog.guestbook.admin")}
                                class="avatar"
                            />
                        {:else}
                            <div class="avatar-placeholder">
                                {entry.user?.name?.[0] || "?"}
                            </div>
                        {/if}
                        <div class="meta">
                            <span class="name"
                                >{entry.user?.name || $t("blog.guestbook.admin")}</span
                            >
                            <span class="date"
                                >{formatDate(entry.createdAt, entry.clientTimezone)}</span
                            >
                        </div>
                        {#if entry.isPrivate}
                            <Lock size={14} class="private-icon" />
                        {/if}
                        {#if !entry.isDeleted && currentUser}
                            <button
                                class="reply-btn"
                                onclick={() => startReply(entry.id)}
                                title={$t("blog.guestbook.reply")}
                            >
                                <Reply size={14} />
                            </button>
                        {/if}
                        {#if !entry.isDeleted && currentUser && (entry.user?.id === currentUser.id || (currentUser as any).role === "admin")}
                            <button
                                class="delete-btn"
                                onclick={() => handleDelete(entry.id)}
                            >
                                <Trash2 size={14} />
                            </button>
                        {/if}
                    </div>
                    <div class="entry-content" class:deleted={entry.isDeleted}>
                        {entry.isDeleted ? $t("blog.guestbook.deleted") : entry.content}
                    </div>

                    <!-- Reply Form -->
                    {#if replyingTo === entry.id}
                        <div class="reply-form">
                            <textarea
                                bind:value={replyContent}
                                placeholder={$t("blog.guestbook.reply_placeholder")}
                                rows="2"
                                disabled={isReplySubmitting}
                            ></textarea>
                            <div class="reply-actions">
                                <button class="cancel-btn" onclick={cancelReply}
                                    >{$t("blog.common.cancel")}</button
                                >
                                <button
                                    class="submit-btn small"
                                    onclick={() => handleReplySubmit(entry.id)}
                                    disabled={!replyContent.trim() ||
                                        isReplySubmitting}
                                >
                                    {isReplySubmitting
                                        ? $t("blog.guestbook.submitting")
                                        : $t("blog.guestbook.reply_submit")}
                                </button>
                            </div>
                        </div>
                    {/if}

                    <!-- Replies -->
                    {#if entry.replies && entry.replies.length > 0}
                        <div class="replies">
                            {#each entry.replies as reply (reply.id)}
                                <div
                                    class="reply-item"
                                    class:private={reply.isPrivate}
                                >
                                    <CornerDownRight
                                        size={14}
                                        class="reply-arrow"
                                    />
                                    <div class="reply-content-wrapper">
                                        <div class="reply-header">
                                            {#if reply.user?.image}
                                                <img
                                                    src={reply.user.image}
                                                    alt={reply.user?.name ||
                                                        $t("blog.guestbook.admin")}
                                                    class="avatar small"
                                                />
                                            {:else}
                                                <div
                                                    class="avatar-placeholder small"
                                                >
                                                    {reply.user?.name?.[0] ||
                                                        "?"}
                                                </div>
                                            {/if}
                                            <span class="name"
                                                >{reply.user?.name ||
                                                    $t("blog.guestbook.admin")}</span
                                            >
                                            <span class="date"
                                                >{formatDate(
                                                    reply.createdAt,
                                                    reply.clientTimezone,
                                                )}</span
                                            >
                                            {#if reply.isPrivate}
                                                <Lock
                                                    size={12}
                                                    class="private-icon"
                                                />
                                            {/if}
                                            {#if currentUser && (reply.user?.id === currentUser.id || (currentUser as any).role === "admin")}
                                                <button
                                                    class="delete-btn small"
                                                    onclick={() =>
                                                        handleDelete(reply.id)}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            {/if}
                                        </div>
                                        <div
                                            class="reply-text"
                                            class:deleted={reply.isDeleted}
                                        >
                                            {reply.isDeleted ? $t("blog.guestbook.deleted") : reply.content}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>

{#if showDeleteModal}
    <div class="custom-modal-backdrop">
        <div class="custom-modal-card">
            <div class="modal-warning-icon">
                <Trash2 size={28} />
            </div>
            <h3>{$t("blog.guestbook.delete_confirm")}</h3>
            <p class="modal-description">정말 이 메시지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div class="modal-actions">
                <button 
                    class="modal-btn modal-cancel" 
                    onclick={() => showDeleteModal = false}
                    onmouseenter={() => hoverCancel = true}
                    onmouseleave={() => hoverCancel = false}
                    style={hoverCancel ? "background-color: #f1f5f9; color: #0f172a;" : ""}
                >
                    {$t("blog.common.cancel")}
                </button>
                <button 
                    class="modal-btn modal-confirm" 
                    onclick={executeDelete}
                    onmouseenter={() => hoverConfirm = true}
                    onmouseleave={() => hoverConfirm = false}
                    style={hoverConfirm ? "background-color: #dc2626; color: #ffffff;" : ""}
                >
                    삭제
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .guestbook-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0;
    }

    .description {
        color: #64748b;
        margin-bottom: 2rem;
    }

    .write-section {
        margin-bottom: 2rem;
    }

    .ban-notice {
        background: #fff1f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        padding: 1.5rem;
        color: #b91c1c;
        margin-bottom: 2rem;
    }
    .notice-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }
    .notice-body {
        font-size: 0.95rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding-left: 2.1rem;
    }
    .notice-body p {
        margin: 0;
    }

    .write-form {
        background: #f8fafc;
        border-radius: 12px;
        padding: 1.25rem;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
    }

    .avatar.small {
        width: 24px;
        height: 24px;
    }

    .avatar-placeholder {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.875rem;
    }

    .avatar-placeholder.small {
        width: 24px;
        height: 24px;
        font-size: 0.7rem;
    }

    .username {
        font-weight: 600;
        color: #334155;
    }

    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95rem;
        resize: vertical;
        font-family: inherit;
    }

    textarea:focus {
        outline: none;
        border-color: var(--primary-color, #6366f1);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .form-actions,
    .reply-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.75rem;
    }

    .reply-actions {
        justify-content: flex-end;
        gap: 0.5rem;
    }

    .private-toggle {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: #64748b;
        font-size: 0.875rem;
        cursor: pointer;
    }

    .private-toggle input {
        margin: 0;
    }

    .submit-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1.25rem;
        background: var(--primary-color, #6366f1);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .submit-btn.small {
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .cancel-btn {
        padding: 0.4rem 0.8rem;
        background: #e2e8f0;
        color: #64748b;
        border: none;
        border-radius: 6px;
        font-size: 0.85rem;
        cursor: pointer;
    }

    .login-prompt {
        text-align: center;
        padding: 1.5rem;
        background: #f8fafc;
        border-radius: 12px;
        color: #64748b;
    }

    .login-prompt a {
        color: var(--primary-color, #6366f1);
        font-weight: 600;
    }

    .entries-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .entry-item {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1rem;
    }

    .entry-item.private {
        background: #fffbeb;
        border-color: #fcd34d;
    }

    .entry-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .meta {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .meta .name,
    .reply-header .name {
        font-weight: 600;
        color: #334155;
        font-size: 0.95rem;
    }

    .meta .date,
    .reply-header .date {
        font-size: 0.75rem;
        color: #94a3b8;
    }

    .reply-btn,
    .delete-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition:
            color 0.2s,
            background 0.2s;
    }

    .reply-btn:hover {
        color: var(--primary-color, #6366f1);
        background: #f1f5f9;
    }

    .delete-btn:hover {
        color: #ef4444;
        background: #fef2f2;
    }

    .delete-btn.small {
        padding: 0.15rem;
    }

    .entry-content,
    .reply-text {
        color: #475569;
        line-height: 1.6;
        white-space: pre-wrap;
    }

    .entry-content.deleted,
    .reply-text.deleted {
        color: #94a3b8;
        font-style: italic;
    }

    .reply-form {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
    }

    .replies {
        margin-top: 1rem;
        padding-left: 0.5rem;
        border-left: 2px solid #e2e8f0;
    }

    .reply-item {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: #f8fafc;
        border-radius: 8px;
    }

    .reply-item.private {
        background: #fffbeb;
    }

    :global(.reply-arrow) {
        color: #cbd5e1;
        flex-shrink: 0;
        margin-top: 0.25rem;
    }

    .reply-content-wrapper {
        flex: 1;
    }

    .reply-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.35rem;
        flex-wrap: wrap;
    }

    .loading,
    .empty-state {
        text-align: center;
        padding: 3rem;
        color: #94a3b8;
    }

    :global(.private-icon) {
        color: #f59e0b;
    }

    /* Premium Custom Modal */
    .custom-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .custom-modal-card {
        background-color: #ffffff;
        border-radius: 16px;
        padding: 2rem;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid #f1f5f9;
        text-align: center;
        animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-warning-icon {
        width: 56px;
        height: 56px;
        background-color: #fef2f2;
        color: #ef4444;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem auto;
    }

    .custom-modal-card h3 {
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.5rem 0;
    }

    .modal-description {
        font-size: 0.9rem;
        color: #64748b;
        margin: 0 0 1.5rem 0;
        line-height: 1.5;
    }

    .modal-actions {
        display: flex;
        gap: 0.75rem;
    }

    .modal-btn {
        flex: 1;
        padding: 0.75rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        border: none;
    }

    .modal-cancel {
        background-color: #f8fafc;
        color: #475569;
        border: 1px solid #e2e8f0;
    }

    .modal-confirm {
        background-color: #ef4444;
        color: #ffffff;
    }

    @keyframes modalFadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
