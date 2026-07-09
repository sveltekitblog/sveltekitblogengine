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

    let { comment, currentUser, onDelete, onEdit, onReply, isReply = false } = $props();

    let isEditing = $state(false);
    let editContent = $state(comment.content);
    let isEditingSubmitting = $state(false);

    function handleDelete() {
        onDelete(comment.id);
    }

    function startEdit() {
        editContent = comment.content;
        isEditing = true;
    }

    function cancelEdit() {
        isEditing = false;
        editContent = comment.content;
    }

    async function handleEditSave() {
        if (!editContent.trim() || isEditingSubmitting) return;
        isEditingSubmitting = true;
        await onEdit(comment.id, editContent.trim());
        isEditing = false;
        isEditingSubmitting = false;
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
                {#if !comment.isDeleted && canDelete && !isEditing}
                    {#if isOwner}
                        <button
                            class="action-btn edit-btn"
                            onclick={startEdit}
                            aria-label={$t("blog.common.edit", { default: "수정" })}
                        >
                            <span>{$t("blog.common.edit", { default: "수정" })}</span>
                        </button>
                    {/if}
                    <button
                        class="action-btn delete-btn"
                        onclick={handleDelete}
                        aria-label={$t("blog.guestbook.delete_btn", { default: "삭제" })}
                    >
                        <Trash2 size={14} />
                    </button>
                {/if}
            </div>
        </div>
        {#if isEditing}
            <div class="edit-form">
                <textarea
                    bind:value={editContent}
                    rows="2"
                    disabled={isEditingSubmitting}
                ></textarea>
                <div class="edit-actions">
                    <button class="cancel-btn" onclick={cancelEdit} disabled={isEditingSubmitting}
                        >{$t("blog.common.cancel", { default: "취소" })}</button
                    >
                    <button
                        class="submit-btn small"
                        onclick={handleEditSave}
                        disabled={!editContent.trim() || isEditingSubmitting}
                    >
                        {isEditingSubmitting
                            ? $t("blog.common.saving", { default: "저장 중..." })
                            : $t("blog.common.save", { default: "저장" })}
                    </button>
                </div>
            </div>
        {:else}
            <div class="body" class:deleted={comment.isDeleted}>
                {comment.content}
            </div>
        {/if}
    </div>
</div>

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

    /* 수정 에디터 폼 스타일 */
    .edit-form {
        margin-top: 0.5rem;
    }
    .edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }
    .edit-form textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 0.9rem;
        resize: vertical;
        font-family: inherit;
    }
    .edit-form textarea:focus {
        outline: none;
        border-color: var(--primary-color);
    }
    .edit-actions .submit-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.8rem;
    }
    .edit-actions .cancel-btn {
        background: #e2e8f0;
        color: #64748b;
        border: none;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.8rem;
    }
    .action-btn.edit-btn {
        font-size: 0.75rem;
        color: #64748b;
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
    }
    .action-btn.edit-btn:hover {
        color: var(--primary-color);
    }
</style>
