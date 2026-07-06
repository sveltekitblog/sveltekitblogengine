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
    import { Send, Loader2, AlertCircle } from "lucide-svelte";
    import { page } from "$app/stores";
    import { t } from "$lib/i18n";
    import { formatDate as formatTime } from "$lib/utils";

    let { currentUser, onSubmit } = $props();

    let content = $state("");
    let isSubmitting = $state(false);

    // 차단 여부 계산
    const isBanned = $derived.by(() => {
        if (!currentUser?.banned) return false;
        if (!currentUser.ban_expires) return true;
        return new Date(currentUser.ban_expires) > new Date();
    });

    const banReasonVisible = $derived(currentUser?.show_ban_reason === true || (currentUser as any)?.show_ban_reason === 1);

    async function handleSubmit() {
        if (!content.trim() || isSubmitting || isBanned) return;

        isSubmitting = true;
        try {
            await onSubmit(content);
            content = "";
        } catch (e: any) {
            // API에서 반환한 상세 메시지가 있다면 표시 (필요 시)
            if (e.message) alert(e.message);
        } finally {
            isSubmitting = false;
        }
    }

    function handleLogin() {
        window.location.href = "/login";
    }

    function formatDate(dstr: string | number | null) {
        if (!dstr) return '';
        return formatTime(dstr, $page.data.settings?.timezone || 'Asia/Seoul');
    }
</script>

<div class="comment-form">
    {#if currentUser}
        {#if isBanned}
            <div class="ban-notice">
                <div class="notice-header">
                    <AlertCircle size={20} />
                    <strong>{$t("blog.comment.banned_user_notice", { default: "차단된 유저는 글을 작성할 수 없습니다." })}</strong>
                </div>
                <div class="notice-body">
                    <p class="expiry">
                        {$t("blog.comment.ban_expires_format", { default: "만료일: {expires}" }).replace("{expires}", currentUser.ban_expires ? formatDate(currentUser.ban_expires) : $t("blog.comment.ban_permanent", { default: "무기한 (영구 차단)" }))}
                    </p>
                    {#if banReasonVisible && currentUser.ban_reason}
                        <p class="reason">{$t("blog.comment.ban_reason_prefix", { default: "사유: {reason}" }).replace("{reason}", currentUser.ban_reason)}</p>
                    {/if}
                </div>
            </div>
        {:else}
            <div class="input-area">
                <textarea
                    placeholder={$t("blog.comment.write_placeholder", { default: "댓글을 작성하세요..." })}
                    bind:value={content}
                    rows="3"
                    disabled={isSubmitting}
                ></textarea>
                <div class="actions">
                    <button
                        class="submit-btn"
                        onclick={handleSubmit}
                        disabled={!content.trim() || isSubmitting}
                    >
                        {#if isSubmitting}
                            <Loader2 class="spin" size={16} />
                            {$t("blog.comment.submitting", { default: "등록 중..." })}
                        {:else}
                            <Send size={16} />
                            {$t("blog.comment.submit", { default: "등록" })}
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    {:else}
        <div class="login-prompt">
            <p>{$t("blog.comment.login_required", { default: "댓글을 작성하려면 로그인이 필요합니다." })}</p>
            <button class="login-btn" onclick={handleLogin}>{$t("blog.comment.login_button", { default: "로그인" })}</button>
        </div>
    {/if}
</div>

<style>
    .comment-form {
        margin-bottom: 2rem;
        background: #f8fafc;
        border-radius: 12px;
        padding: 1rem;
    }

    .input-area {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    textarea {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.8rem;
        font-family: inherit;
        font-size: 0.95rem;
        resize: vertical;
        min-height: 80px;
        outline: none;
        transition: border-color 0.2s;
        background: white;
    }

    textarea:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
    }

    .submit-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.6rem 1.2rem;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .login-prompt {
        text-align: center;
        padding: 1.5rem;
        color: #64748b;
    }

    .login-prompt p {
        margin-bottom: 1rem;
    }

    .login-btn {
        background: white;
        border: 1px solid #e2e8f0;
        color: #334155;
        padding: 0.6rem 1.5rem;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .login-btn:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
    }

    .ban-notice {
        background: #fff1f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 1rem;
        color: #b91c1c;
    }
    .notice-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .notice-body {
        font-size: 0.875rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-left: 1.75rem;
    }
    .notice-body p { margin: 0; }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }
</style>
