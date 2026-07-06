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
    import { formatDate } from "$lib/utils";
    import { Trash2, User, Reply, CornerDownRight } from "lucide-svelte";
    import type { User as AuthUser } from "better-auth";
    import { t } from "$lib/i18n";
    import { page } from "$app/stores";

    let { comment, currentUser, onDelete, onReply, isReply = false } = $props();

    let isDeleting = $state(false);
    let showDeleteModal = $state(false);
    let hoverCancel = $state(false);
    let hoverConfirm = $state(false);

    function handleDelete() {
        showDeleteModal = true;
    }

    async function executeDelete() {
        showDeleteModal = false;
        isDeleting = true;
        await onDelete(comment.id);
        isDeleting = false;
    }

    let isOwner = $derived(currentUser && comment.user?.id === currentUser.id);
    let isAdmin = $derived(currentUser?.role === "admin");
    let canDelete = $derived(isOwner || isAdmin);
</script>

<div class="comment-item" class:is-reply={isReply}>
    {#if isReply}
        <div class="reply-indicator">
            <CornerDownRight size={16} />
        </div>
    {/if}
    <div class="avatar" class:small={isReply}>
        {#if comment.user?.image}
            <img src={comment.user.image} alt={comment.user?.name || $t("blog.common.admin", { default: "관리자" })} />
        {:else}
            <div class="avatar-placeholder">
                <User size={isReply ? 16 : 20} />
            </div>
        {/if}
    </div>
    <div class="content">
        <div class="header">
            <span class="author">{comment.user?.name || $t("blog.common.admin", { default: "관리자" })}</span>
            <span class="date">{formatDate(comment.createdAt, comment.clientTimezone || $page.data.settings?.timezone || 'Asia/Seoul')}</span>
            <div class="actions">
                {#if !comment.isDeleted && currentUser && !isReply}
                    <button
                        class="action-btn reply-btn"
                        onclick={() => onReply(comment.id)}
                        aria-label={$t("blog.comments.submit_reply", { default: "답글 등록" })}
                    >
                        <Reply size={14} />
                        <span>{$t("blog.comments.reply_btn", { default: "답글" })}</span>
                    </button>
                {/if}
                {#if !comment.isDeleted && canDelete}
                    <button
                        class="action-btn delete-btn"
                        onclick={handleDelete}
                        disabled={isDeleting}
                        aria-label={$t("blog.guestbook.delete_btn", { default: "삭제" })}
                    >
                        <Trash2 size={14} />
                    </button>
                {/if}
            </div>
        </div>
        <div class="body" class:deleted={comment.isDeleted}>
            {comment.content}
        </div>
    </div>
</div>

{#if showDeleteModal}
    <div class="custom-modal-backdrop">
        <div class="custom-modal-card">
            <div class="modal-warning-icon">
                <Trash2 size={28} />
            </div>
            <h3>{$t("blog.guestbook.delete_confirm")}</h3>
            <p class="modal-description">{$t("blog.comments.delete_confirm_desc", { default: "정말 이 댓글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다." })}</p>
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
                    {$t("blog.guestbook.delete_btn", { default: "삭제" })}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .comment-item {
        display: flex;
        gap: 1rem;
        padding: 1rem 0;
        border-bottom: 1px solid #f0f0f0;
    }

    .comment-item.is-reply {
        padding: 0.75rem 0;
        border-bottom: none;
        background-color: #f8fafc;
        border-radius: 8px;
        padding-left: 0.75rem;
        padding-right: 0.75rem;
        margin-top: 0.5rem;
    }

    .reply-indicator {
        color: #cbd5e1;
        padding-top: 0.5rem;
    }

    .avatar {
        flex-shrink: 0;
    }

    .avatar img,
    .avatar-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
    }

    .avatar.small img,
    .avatar.small .avatar-placeholder {
        width: 32px;
        height: 32px;
    }

    .avatar-placeholder {
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
    }

    .content {
        flex-grow: 1;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.3rem;
        flex-wrap: wrap;
    }

    .author {
        font-weight: 600;
        font-size: 0.95rem;
        color: #1e293b;
    }

    .date {
        font-size: 0.8rem;
        color: #94a3b8;
    }

    .actions {
        margin-left: auto;
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .action-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 4px;
        transition: all 0.2s;
        font-size: 0.8rem;
    }

    .action-btn:hover {
        background-color: #f1f5f9;
        color: #64748b;
    }

    .delete-btn:hover {
        color: #ef4444;
        background-color: #fef2f2;
    }

    .reply-btn:hover {
        color: var(--primary-color);
        background-color: #eff6ff;
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .body {
        font-size: 0.95rem;
        color: #334155;
        line-height: 1.5;
        white-space: pre-wrap;
    }

    .body.deleted {
        color: #94a3b8;
        font-style: italic;
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
