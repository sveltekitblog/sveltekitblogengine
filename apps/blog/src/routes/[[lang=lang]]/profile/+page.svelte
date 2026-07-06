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
    import { authClient } from "$lib/auth-client";
    import { goto, invalidateAll } from "$app/navigation";
    import { User, LogOut, Save, Loader2, UserX } from "lucide-svelte";
    import { t } from "$lib/i18n";

    let { data } = $props();
    let user = $derived(data.user || { name: '', email: '', image: '' });

    let newName = $state('');

    $effect(() => {
        newName = user?.name || '';
    });
    let isUpdating = $state(false);
    let isSigningOut = $state(false);

    // 회원 탈퇴 상태
    let showWithdrawModal = $state(false);
    let isWithdrawing = $state(false);
    let hasAgreedWithdrawal = $state(false);

    // 로그아웃 상태
    let showSignOutModal = $state(false);

    async function handleUpdateName() {
        if (!newName || newName === user.name) return;

        if (newName.trim().length < 2 || newName.trim().length > 20) {
            alert($t("blog.profile.username_invalid", { default: "사용자 이름은 2자 이상 20자 이하로 입력해주세요." }));
            return;
        }

        isUpdating = true;
        try {
            await authClient.updateUser({
                name: newName,
            });
            alert($t("blog.common.save_success", { default: "저장되었습니다." }));
            // Reload to reflect changes if needed, or just update local state
            await invalidateAll();
            user.name = newName;
        } catch (error) {
            console.error(error);
            alert($t("blog.profile.name_update_failed", { default: "이름 변경에 실패했습니다." }));
        } finally {
            isUpdating = false;
        }
    }

    async function handleSignOut() {
        showSignOutModal = false;
        isSigningOut = true;
        try {
            await authClient.signOut({
                fetchOptions: {
                    onSuccess: async () => {
                        window.location.href = "/";
                    },
                },
            });
        } catch (error) {
            console.error(error);
            alert($t("blog.profile.logout_failed", { default: "로그아웃 중 오류가 발생했습니다." }));
            isSigningOut = false;
        }
    }

    async function handleWithdraw() {
        if (!hasAgreedWithdrawal) return;

        isWithdrawing = true;
        try {
            const res = await fetch("/api/withdraw", {
                method: "POST"
            });
            if (res.ok) {
                alert($t("blog.common.withdraw_success", { default: "탈퇴 처리가 완료되었습니다." }));
                showWithdrawModal = false;
                window.location.href = "/";
            } else {
                const errData = await res.json();
                alert($t("blog.profile.withdraw_failed", { default: "탈퇴 처리 중 오류가 발생했습니다." }) + (errData.error ? ` (${errData.error})` : ""));
            }
        } catch (error) {
            console.error(error);
            alert($t("blog.profile.network_error", { default: "통신 중 오류가 발생했습니다." }));
        } finally {
            isWithdrawing = false;
        }
    }
</script>

<div class="profile-container">
    <div class="profile-card">
        <div class="header">
            <h1>{$t("blog.profile.title", { default: "프로필 설정" })}</h1>
            <p>{$t("blog.profile.desc", { default: "회원 정보를 관리하세요." })}</p>
        </div>

        <div class="user-info-section">
            <div class="avatar-large">
                {#if user.image}
                    <img src={user.image} alt={user.name} />
                {:else}
                    <User size={48} />
                {/if}
            </div>
            <div class="email-display">
                <span class="label">{$t("blog.profile.email", { default: "이메일" })}</span>
                <span class="value">{user.email}</span>
            </div>
        </div>

        <div class="form-section">
            <div class="input-group">
                <label for="name">{$t("blog.profile.display_name", { default: "이름 (닉네임)" })}</label>
                <div class="input-wrapper">
                    <input
                        type="text"
                        id="name"
                        bind:value={newName}
                        placeholder={$t("blog.profile.placeholder", { default: "이름을 입력하세요" })}
                    />
                </div>
            </div>

            <button
                class="btn-primary"
                onclick={handleUpdateName}
                disabled={isUpdating || newName === user.name}
            >
                {#if isUpdating}
                    <Loader2 class="spin" size={18} />
                    {$t("blog.common.saving", { default: "저장 중..." })}
                {:else}
                    <Save size={18} />
                    {$t("blog.profile.save", { default: "변경사항 저장" })}
                {/if}
            </button>
        </div>

        <div class="divider"></div>

        <div class="danger-zone" style="margin-top: 1.5rem;">
            <button
                class="btn-secondary-outline"
                onclick={() => showSignOutModal = true}
                disabled={isSigningOut}
                style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; background: white; border-radius: 10px; cursor: pointer; color: #4b5563; font-weight: 500; transition: all 0.2s; margin-bottom: 1rem;"
            >
                {#if isSigningOut}
                    <Loader2 class="spin" size={18} />
                    {$t("blog.profile.logging_out", { default: "로그아웃 중..." })}
                {:else}
                    <LogOut size={18} />
                    {$t("blog.profile.logout", { default: "로그아웃" })}
                {/if}
            </button>

            <div class="withdraw-section" style="border-top: 1px solid #fee2e2; padding-top: 1.5rem; margin-top: 1.5rem; text-align: left;">
                <h3 style="color: #ef4444; font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 0;">{$t("blog.profile.danger_title", { default: "Danger Zone (회원 탈퇴)" })}</h3>
                <p style="color: #6b7280; font-size: 0.8rem; line-height: 1.4; margin-bottom: 1rem; margin-top: 0;">
                    {$t("blog.profile.danger_desc", { default: "탈퇴 시 작성한 댓글과 방명록을 제외한 모든 개인 정보가 즉시 파기되며 복구할 수 없습니다." })}
                </p>
                <button
                    class="btn-danger"
                    onclick={() => showWithdrawModal = true}
                    disabled={isWithdrawing}
                    style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem; background: #ef4444; border: none; border-radius: 10px; cursor: pointer; color: white; font-weight: 500; transition: all 0.2s;"
                >
                    <UserX size={18} />
                    {$t("blog.profile.withdraw_btn", { default: "회원 탈퇴 및 정보 파기" })}
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 회원 탈퇴 경고 및 동의 모달 -->
{#if showWithdrawModal}
    <div class="withdraw-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px);">
        <div class="withdraw-modal-content" style="background: white; width: 100%; max-width: 500px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #fee2e2; padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; margin: 1rem;">
            <div style="text-align: center;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #ef4444; margin-bottom: 1rem;">
                    <UserX size={28} />
                </div>
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700; color: #111827;">{$t("blog.profile.withdraw_confirm_title", { default: "정말 회원 탈퇴를 진행하시겠습니까?" })}</h3>
                <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">{$t("blog.profile.withdraw_confirm_desc", { default: "아래의 중요한 탈퇴 안내 정책을 꼭 읽어주세요." })}</p>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; line-height: 1.5;">
                <strong style="color: #b45309; font-size: 0.9rem; display: flex; align-items: center; gap: 0.25rem;">
                    {$t("blog.profile.withdraw_policy_title", { default: "⚠️ 회원 탈퇴 중요 안내 및 정책" })}
                </strong>
                <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: #78350f; display: flex; flex-direction: column; gap: 0.5rem; list-style-type: disc; text-align: left;">
                    <li>{$t("blog.profile.policy_item1", { default: "회원 탈퇴 진행 시, 모든 계정 정보가 안전하게 영구 파기되며 즉시 로그아웃됩니다." })}</li>
                    <li>{$t("blog.profile.policy_item2", { default: "작성하신 댓글 및 방명록 글은 서비스 무결성을 위해 탈퇴 후에도 보존됩니다." })}</li>
                    <li>{$t("blog.profile.policy_item3", { default: "작성하신 게시물 중 삭제를 원하는 내용이 있으시다면 반드시 탈퇴 전에 직접 삭제해 주시기 바랍니다." })}</li>
                </ul>
            </div>

            <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; padding: 0.5rem 0; text-align: left;">
                <input type="checkbox" bind:checked={hasAgreedWithdrawal} style="margin-top: 0.25rem; width: 1.1rem; height: 1.1rem; accent-color: #ef4444;" />
                <span style="font-size: 0.85rem; color: #374151; font-weight: 500; line-height: 1.4;">
                    {$t("blog.profile.withdraw_agree", { default: "위 안내 사항 및 댓글 보존 정책을 모두 숙지하였으며, 탈퇴 진행에 확실히 동의합니다." })}
                </span>
            </label>

            <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
                <button 
                    onclick={() => { showWithdrawModal = false; hasAgreedWithdrawal = false; }} 
                    style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; background: white; border-radius: 10px; font-weight: 600; color: #4b5563; cursor: pointer; transition: all 0.2s;"
                    onmouseenter={(e) => e.currentTarget.style.backgroundColor='#f9fafb'}
                    onmouseleave={(e) => e.currentTarget.style.backgroundColor='white'}
                >
                    {$t("blog.common.cancel", { default: "취소" })}
                </button>
                <button 
                    onclick={handleWithdraw} 
                    disabled={!hasAgreedWithdrawal || isWithdrawing} 
                    style="flex: 1; padding: 0.75rem; background: #ef4444; border: none; border-radius: 10px; font-weight: 600; color: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                >
                    {#if isWithdrawing}
                        <Loader2 class="spin" size={18} />
                        {$t("blog.profile.withdrawing", { default: "탈퇴 처리 중..." })}
                    {:else}
                        {$t("blog.profile.withdraw_complete", { default: "탈퇴 완료" })}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showSignOutModal}
    <!-- 극도로 아름다운 커스텀 로그아웃 확인 모달 -->
    <div class="withdraw-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px);">
        <div class="withdraw-modal-content" style="background: white; width: 100%; max-width: 400px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #e5e7eb; padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; margin: 1rem; text-align: center;">
            <div style="text-align: center;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #eff6ff; color: #3b82f6; margin-bottom: 1rem;">
                    <LogOut size={28} />
                </div>
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700; color: #111827;">{$t("blog.profile.logout_confirm_title", { default: "로그아웃 하시겠습니까?" })}</h3>
                <p style="margin: 0; font-size: 0.875rem; color: #6b7280; line-height: 1.5;">{$t("blog.profile.logout_confirm_desc", { default: "안전하게 로그인 세션을 종료하고 메인 페이지로 이동합니다." })}</p>
            </div>

            <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
                <button 
                    onclick={() => showSignOutModal = false} 
                    style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; background: white; border-radius: 10px; font-weight: 600; color: #4b5563; cursor: pointer; transition: all 0.2s;"
                    onmouseenter={(e) => e.currentTarget.style.backgroundColor='#f9fafb'}
                    onmouseleave={(e) => e.currentTarget.style.backgroundColor='white'}
                >
                    {$t("blog.common.cancel", { default: "취소" })}
                </button>
                <button 
                    onclick={handleSignOut} 
                    style="flex: 1; padding: 0.75rem; background: #3b82f6; border: none; border-radius: 10px; font-weight: 600; color: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                    onmouseenter={(e) => e.currentTarget.style.backgroundColor='#2563eb'}
                    onmouseleave={(e) => e.currentTarget.style.backgroundColor='#3b82f6'}
                >
                    {$t("blog.profile.logout", { default: "로그아웃" })}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .profile-container {
        max-width: 600px;
        margin: 4rem auto;
        padding: 0 1.5rem;
    }

    .profile-card {
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
        padding: 2.5rem;
        border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .header {
        text-align: center;
        margin-bottom: 3rem;
    }

    .header h1 {
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--text-color);
        margin-bottom: 0.5rem;
    }

    .header p {
        color: #666;
        font-size: 0.95rem;
    }

    .user-info-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 2.5rem;
        gap: 1.5rem;
    }

    .avatar-large {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        overflow: hidden;
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .avatar-large img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .email-display {
        background: #f8fafc;
        padding: 0.6rem 1.2rem;
        border-radius: 100px;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        font-size: 0.9rem;
        border: 1px solid #e2e8f0;
    }

    .email-display .label {
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
    }

    .email-display .value {
        color: #334155;
        font-weight: 500;
        font-family: monospace;
    }

    .form-section {
        margin-bottom: 2rem;
    }

    .input-group {
        margin-bottom: 1.5rem;
    }

    .input-group label {
        display: block;
        font-size: 0.9rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 0.5rem;
        margin-left: 0.2rem;
    }

    .input-wrapper input {
        width: 100%;
        padding: 0.9rem 1rem;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        font-size: 1rem;
        transition: all 0.2s;
        background: #fff;
    }

    .input-wrapper input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        width: 100%;
        padding: 1rem;
        border-radius: 12px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }

    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.25);
    }

    .btn-primary:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(var(--primary-color-rgb), 0.35);
    }

    .btn-danger {
        background: #fff;
        color: #ef4444;
        border: 1px solid #fee2e2;
    }

    .btn-danger:not(:disabled):hover {
        background: #fef2f2;
        border-color: #fecaca;
    }

    .divider {
        height: 1px;
        background: #f1f5f9;
        margin: 2rem 0;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    @media (max-width: 640px) {
        .profile-container {
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .profile-card {
            padding: 1.5rem;
        }
    }
</style>
