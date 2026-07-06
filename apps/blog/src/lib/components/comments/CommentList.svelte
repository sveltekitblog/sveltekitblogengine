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
    import CommentItem from "./CommentItem.svelte";
    import CommentForm from "./CommentForm.svelte";
    import { MessageSquare } from "lucide-svelte";
    import { t } from "$lib/i18n";

    let { postId, currentUser } = $props();

    let comments = $state<any[]>([]);
    let isLoading = $state(true);

    // Reply state
    let replyingTo = $state<string | null>(null);
    let replyContent = $state("");
    let isReplySubmitting = $state(false);

    // Derived nested comments with recursive filtering (Zombie Cleanup)
    let nestedComments = $derived.by(() => {
        const topLevel = comments.filter((c) => !c.parentId);
        const replies = comments.filter((c) => c.parentId);

        const getDescendants = (parentId: string): any[] => {
            const children = replies
                .filter((r) => r.parentId === parentId)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            
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

        const result = topLevel.map(comment => {
            const descendants = getDescendants(comment.id);
            // Prune top-level zombie if no children
            if (comment.isDeleted && descendants.length === 0) return null;
            return {
                ...comment,
                replies: descendants
            };
        }).filter(c => c !== null);

        // Sort top-level by newest first
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    async function fetchComments() {
        if (!postId) return;
        try {
            const res = await fetch(
                `/api/entries?type=comment&targetId=${postId}`,
            );
            if (res.ok) {
                comments = await res.json();
            } else {
                const err = await res.json();
                console.error("Failed to load comments:", err);
            }
        } catch (e) {
            console.error(e);
        } finally {
            isLoading = false;
        }
    }

    async function handleAddComment(content: string) {
        try {
            const res = await fetch("/api/entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "comment",
                    targetId: postId,
                    content,
                    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (res.ok) {
                const newComment = await res.json();
                comments = [newComment, ...comments];
            } else {
                const err = await res.json();
                alert($t("blog.comments.add_comment_failed", { default: "댓글 등록에 실패했습니다." }) + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
            alert($t("blog.profile.network_error", { default: "통신 중 오류가 발생했습니다." }));
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
                    type: "comment",
                    targetId: postId,
                    content: replyContent.trim(),
                    parentId,
                    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (res.ok) {
                const newReply = await res.json();
                comments = [...comments, newReply];
                replyContent = "";
                replyingTo = null;
            } else {
                const err = await res.json();
                alert($t("blog.comments.add_reply_failed", { default: "답글 등록에 실패했습니다." }) + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
            alert($t("blog.profile.network_error", { default: "통신 중 오류가 발생했습니다." }));
        } finally {
            isReplySubmitting = false;
        }
    }

    async function handleDeleteComment(commentId: string) {
        try {
            const res = await fetch("/api/entries", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: commentId }),
            });

            if (res.ok) {
                // Soft delete locally to trigger derived store update
                comments = comments.map((c: any) =>
                    c.id === commentId
                        ? {
                              ...c,
                              isDeleted: true,
                              content: $t("blog.comments.deleted_message", { default: "삭제된 메시지입니다." }),
                          }
                        : c,
                );
            } else {
                const err = await res.json();
                alert($t("blog.guestbook.delete_fail", { default: "삭제 실패" }) + (err.error ? ` (${err.error})` : ""));
            }
        } catch (e) {
            console.error(e);
            alert($t("blog.profile.network_error", { default: "통신 중 오류가 발생했습니다." }));
        }
    }

    function startReply(commentId: string) {
        replyingTo = commentId;
        replyContent = "";
    }

    function cancelReply() {
        replyingTo = null;
        replyContent = "";
    }

    $effect(() => {
        if (postId) {
            fetchComments();
        }
    });
</script>

<div class="comments-section">
    <div class="section-header">
        <MessageSquare size={20} />
        <h2>{@html $t("blog.comments.count_title", { count: `<span class="count">${comments.length}</span>`, default: `댓글 <span class="count">${comments.length}</span>개` })}</h2>
    </div>

    <CommentForm {currentUser} onSubmit={handleAddComment} />

    {#if isLoading}
        <div class="loading">{$t("blog.comments.loading", { default: "댓글을 불러오는 중..." })}</div>
    {:else if comments.length > 0}
        <div class="comment-list">
            {#each nestedComments as comment (comment.id)}
                <div class="comment-thread">
                    <CommentItem
                        {comment}
                        {currentUser}
                        onDelete={handleDeleteComment}
                        onReply={startReply}
                    />

                    <!-- Reply Form -->
                    {#if replyingTo === comment.id}
                        <div class="reply-form">
                            <textarea
                                bind:value={replyContent}
                                placeholder={$t("blog.comments.reply_placeholder", { default: "답글을 입력하세요..." })}
                                rows="2"
                                disabled={isReplySubmitting}
                            ></textarea>
                            <div class="reply-actions">
                                <button class="cancel-btn" onclick={cancelReply}
                                    >{$t("blog.common.cancel", { default: "취소" })}</button
                                >
                                <button
                                    class="submit-btn small"
                                    onclick={() =>
                                        handleReplySubmit(comment.id)}
                                    disabled={!replyContent.trim() ||
                                        isReplySubmitting}
                                >
                                    {isReplySubmitting
                                        ? $t("blog.common.saving", { default: "등록 중..." })
                                        : $t("blog.comments.submit_reply", { default: "답글 등록" })}
                                </button>
                            </div>
                        </div>
                    {/if}

                    <!-- Replies -->
                    {#if comment.replies && comment.replies.length > 0}
                        <div class="replies">
                            {#each comment.replies as reply (reply.id)}
                                <CommentItem
                                    comment={reply}
                                    {currentUser}
                                    onDelete={handleDeleteComment}
                                    onReply={startReply}
                                    isReply={true}
                                />
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty-state">
            {$t("blog.comments.empty", { default: "아직 댓글이 없습니다. 첫 댓글을 남겨보세요!" })}
        </div>
    {/if}
</div>

<style>
    .comments-section {
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 1px solid #eee;
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 1.5rem;
        color: #333;
    }

    .section-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
    }

    .count {
        color: var(--primary-color);
        font-weight: 800;
    }

    .comment-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .replies {
        margin-left: 1.5rem;
        border-left: 2px solid #f0f0f0;
        padding-left: 1rem;
    }

    .reply-form {
        margin: 1rem 0 1rem 1.5rem;
        padding: 1rem;
        background: #f8fafc;
        border-radius: 8px;
    }

    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95rem;
        resize: vertical;
        font-family: inherit;
        margin-bottom: 0.5rem;
    }

    textarea:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }

    .submit-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
        transition: opacity 0.2s;
    }

    .cancel-btn {
        background: #e2e8f0;
        color: #64748b;
        border: none;
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .loading,
    .empty-state {
        text-align: center;
        padding: 2rem;
        color: #94a3b8;
    }
</style>
