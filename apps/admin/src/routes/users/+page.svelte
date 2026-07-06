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
    import { invalidateAll } from "$app/navigation";
    import { Search, UserX, UserCheck, History, Calendar, AlertCircle, Pencil, Trash2 } from "lucide-svelte";
    import type { PageData } from "./$types";
    import UserActivityModal from "$lib/components/users/UserActivityModal.svelte";

    let { data }: { data: PageData } = $props();

    let searchQuery = $state("");
    let processingId = $state("");

    // Activity Modal State
    let showActivityModal = $state(false);
    let activityUser: any = $state(null);

    // Ban Modal State
    let showBanModal = $state(false);
    let banUser: any = $state(null);
    let banReason = $state("");
    let banExpires = $state("");
    let showBanReason = $state(false);

    // Delete Modal State
    let showDeleteModal = $state(false);
    let deleteUser: any = $state(null);
    let deleteBehavior = $state('anonymize'); // 'cascade' | 'anonymize'

    const filteredUsers = $derived(data.users.filter((u: any) => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ));

    function formatDate(dstr: any) {
        if (!dstr) return "-";
        try { return new Date(dstr).toLocaleDateString(); } catch { return String(dstr); }
    }

    function openActivity(user: any) {
        activityUser = user;
        showActivityModal = true;
    }

    function openBan(user: any) {
        banUser = user;
        banReason = user.ban_reason || "";
        
        if (user.ban_expires) {
            try {
                // Ensure correct date format for input type="date"
                const date = new Date(user.ban_expires);
                banExpires = date.toISOString().split('T')[0];
            } catch {
                banExpires = "";
            }
        } else {
            banExpires = "";
        }
        
        showBanReason = user.show_ban_reason === 1 || user.show_ban_reason === true;
        showBanModal = true;
    }

    async function handleBan() {
        if (!banUser) return;
        processingId = banUser.id;
        try {
            const expiryTimestamp = banExpires ? new Date(banExpires).getTime() : null;
            const res = await fetch(`/api/users/${banUser.id}/ban`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    banned: true,
                    reason: banReason,
                    expires: expiryTimestamp,
                    show_ban_reason: showBanReason
                })
            });
            if (res.ok) {
                showBanModal = false;
                await invalidateAll();
            } else {
                alert(t('admin.users.ban_failed'));
            }
        } catch (e) {
            alert(t('admin.common.error_occurred', { default: '오류 발생' }));
        } finally {
            processingId = "";
        }
    }

    async function handleUnban(id: string) {
        if (!confirm(t('admin.users.unban_confirm'))) return;
        processingId = id;
        try {
            const res = await fetch(`/api/users/${id}/ban`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banned: false })
            });
            if (res.ok) {
                await invalidateAll();
            } else {
                alert(t('admin.users.unban_failed'));
            }
        } catch (e) {
            alert(t('admin.common.error_occurred', { default: '오류 발생' }));
        } finally {
            processingId = "";
        }
    }

    function openDelete(user: any) {
        deleteUser = user;
        deleteBehavior = 'anonymize';
        showDeleteModal = true;
    }

    async function handleDelete() {
        if (!deleteUser) return;
        processingId = deleteUser.id;
        try {
            const res = await fetch(`/api/users/${deleteUser.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleteBehavior })
            });
            if (res.ok) {
                showDeleteModal = false;
                await invalidateAll();
            } else {
                const errData = await res.json();
                alert(errData.error || t('admin.users.delete_failed'));
            }
        } catch (e) {
            alert(t('admin.common.error_occurred', { default: '오류 발생' }));
        } finally {
            processingId = "";
        }
    }
</script>

<div class="user-management">
    <div class="header">
        <div>
            <h1>{t('admin.left.menu.users')}</h1>
            <p class="subtitle">{t('admin.users.subtitle')}</p>
        </div>
        <div class="search-box">
            <Search size={18} class="search-icon" />
            <input type="text" bind:value={searchQuery} placeholder={t('admin.users.search_placeholder')} />
        </div>
    </div>

    <div class="table-container">
        <table class="user-table">
            <thead>
                <tr>
                    <th>{t('admin.users.col_user')}</th>
                    <th>{t('admin.users.col_role')}</th>
                    <th>{t('admin.users.col_joined')}</th>
                    <th>{t('admin.posts.col.status')}</th>
                    <th>{t('admin.interactions.col_actions')}</th>
                </tr>
            </thead>
            <tbody>
                {#if filteredUsers.length === 0}
                    <tr>
                        <td colspan="5" class="empty">{t('admin.users.empty', { default: '가입된 유저가 없거나 검색 결과가 없습니다.' })}</td>
                    </tr>
                {:else}
                    {#each filteredUsers as u}
                        {@const user = u as any}
                        <tr class:is-banned={user.banned}>
                            <td>
                                <div class="user-info">
                                    {#if user.image}
                                        <img src={user.image} alt="profile" class="avatar" />
                                    {:else}
                                        <div class="avatar-placeholder">{user.name?.[0] || 'U'}</div>
                                    {/if}
                                    <div class="meta">
                                        <strong>{user.name}</strong>
                                        <span class="email">{user.email}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="role-badge" class:admin={user.role === 'admin'}>
                                    {user.role || 'user'}
                                </span>
                            </td>
                            <td>{formatDate(user.created_at || user.createdAt)}</td>
                            <td>
                                {#if user.banned}
                                    <div class="status-banned">
                                        <UserX size={14} /> {t('admin.users.status_banned')}
                                        {#if user.ban_expires}
                                            <span class="expiry">({formatDate(user.ban_expires)})</span>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="status-active">
                                        <UserCheck size={14} /> {t('admin.users.status_active')}
                                    </div>
                                {/if}
                            </td>
                            <td>
                                <div class="actions">
                                    <button class="btn-icon" title={t('admin.users.btn_activity')} onclick={() => openActivity(user)}>
                                        <History size={18} />
                                    </button>
                                    {#if user.banned}
                                        <button class="btn-icon" title={t('admin.users.btn_edit_ban', { default: '차단 정보 수정' })} onclick={() => openBan(user)}>
                                            <Pencil size={18} />
                                        </button>
                                        <button class="btn-icon unban" title={t('admin.users.btn_unban')} onclick={() => handleUnban(user.id)} disabled={processingId === user.id}>
                                            <UserCheck size={18} />
                                        </button>
                                    {:else}
                                        <button class="btn-icon ban" title={t('admin.users.btn_ban')} onclick={() => openBan(user)} disabled={processingId === user.id}>
                                            <UserX size={18} />
                                        </button>
                                    {/if}
                                    {#if user.role !== 'admin'}
                                        <button class="btn-icon delete" title={t('admin.users.btn_delete_user', { default: '회원 삭제' })} onclick={() => openDelete(user)} disabled={processingId === user.id}>
                                            <Trash2 size={18} />
                                        </button>
                                    {/if}
                                </div>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>

<!-- 활동 내역 모달 -->
{#if showActivityModal}
    <UserActivityModal 
        userId={activityUser.id} 
        userName={activityUser.name} 
        onClose={() => showActivityModal = false} 
    />
{/if}

<!-- 차단 설정 모달 -->
{#if showBanModal}
    <div class="modal-backdrop" onclick={() => showBanModal = false}>
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h3>{banUser.banned ? t('admin.users.btn_edit_ban', { default: '차단 정보 수정' }) : t('admin.users.modal_ban_title')}</h3>
            </div>
            <div class="modal-body">
                <div class="user-preview">
                    <strong>{banUser.name}</strong> ({banUser.email})
                </div>
                
                <div class="form-group">
                    <label for="banReason">{t('admin.users.label_ban_reason')}</label>
                    <textarea id="banReason" bind:value={banReason} placeholder={t('admin.users.placeholder_ban_reason', { default: '차단 사유를 입력하세요...' })}></textarea>
                </div>
                <div class="form-group">
                    <label for="banExpires">{t('admin.users.label_ban_expires')}</label>
                    <div class="input-with-icon">
                        <Calendar size={18} />
                        <input type="date" id="banExpires" bind:value={banExpires} />
                    </div>
                    <p class="hint"><AlertCircle size={14} /> {t('admin.users.hint_ban_expires', { default: '만료일이 지나면 어떻게 하나요? 현재는 수동 해제가 필요합니다.' })}</p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" bind:checked={showBanReason} />
                        <span>{t('admin.users.label_show_ban_reason', { default: '차단 사유를 사용자에게 공개' })}</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick={() => showBanModal = false}>{t('admin.common.cancel')}</button>
                <button class="btn-confirm" onclick={handleBan} disabled={processingId === banUser.id}>
                    {processingId === banUser.id ? t('blog.auth.processing') : (banUser.banned ? t('admin.users.btn_edit_ban', { default: '정보 수정' }) : t('admin.users.btn_ban'))}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- 회원 삭제 설정 모달 -->
{#if showDeleteModal}
    <div class="modal-backdrop" onclick={() => showDeleteModal = false}>
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h3>{t('admin.users.modal_delete_title')}</h3>
            </div>
            <div class="modal-body">
                <div class="user-preview">
                    <strong>{deleteUser.name}</strong> ({deleteUser.email})
                </div>
                
                <p class="warning-text" style="color: #ef4444; font-size: 0.9rem; font-weight: 500; margin: 0.5rem 0;">
                    {@html t('admin.users.delete_warning_text')}
                </p>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
                    <label class="radio-label" style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;">
                        <input type="radio" name="deleteBehavior" value="anonymize" bind:group={deleteBehavior} style="margin-top: 0.25rem;" />
                        <div>
                            <strong style="color: #374151;">{@html t('admin.users.delete_anonymize_title')}</strong>
                            <span style="display: block; font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;">
                                {@html t('admin.users.delete_anonymize_desc')}
                            </span>
                        </div>
                    </label>

                    <label class="radio-label" style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; border-top: 1px solid #f3f4f6; padding-top: 0.75rem;">
                        <input type="radio" name="deleteBehavior" value="cascade" bind:group={deleteBehavior} style="margin-top: 0.25rem;" />
                        <div>
                            <strong style="color: #ef4444;">{@html t('admin.users.delete_cascade_title')}</strong>
                            <span style="display: block; font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;">
                                {@html t('admin.users.delete_cascade_desc')}
                            </span>
                        </div>
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick={() => showDeleteModal = false}>{t('admin.common.cancel')}</button>
                <button class="btn-confirm" onclick={handleDelete} disabled={processingId === deleteUser.id} style="background-color: #ef4444;">
                    {processingId === deleteUser.id ? t('blog.auth.processing') : t('admin.users.btn_delete_user', { default: '회원 삭제' })}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .user-management {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }
    h1 {
        font-size: 1.8rem;
        font-weight: bold;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }
    .subtitle {
        color: #6b7280;
        margin: 0;
    }
    .search-box {
        position: relative;
        min-width: 300px;
    }
    .search-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        color: #9ca3af;
    }
    .search-box input {
        width: 100%;
        padding: 0.6rem 1rem 0.6rem 2.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: white;
        transition: border-color 0.2s;
    }
    .search-box input:focus {
        border-color: #3b82f6;
        outline: none;
    }

    .table-container {
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        overflow: hidden;
    }
    .user-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
    }
    .user-table th {
        background: #f9fafb;
        padding: 1rem 1.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: #4b5563;
        border-bottom: 1px solid #e5e7eb;
    }
    .user-table td {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: middle;
    }
    .user-table tr:hover td { background: #f9fafb; }
    .user-table tr.is-banned td { background: #fff1f2; }

    .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder {
        width: 40px; height: 40px; border-radius: 50%;
        background: #f3f4f6; color: #6b7280;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 1.1rem;
    }
    .meta strong { display: block; color: #111827; }
    .meta .email { font-size: 0.8rem; color: #6b7280; }

    .role-badge {
        padding: 0.2rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #f3f4f6;
        color: #4b5563;
        text-transform: uppercase;
    }
    .role-badge.admin { background: #dbeafe; color: #1d4ed8; }

    .status-active { display: flex; align-items: center; gap: 0.4rem; color: #10b981; font-weight: 500; font-size: 0.875rem; }
    .status-banned { display: flex; align-items: center; gap: 0.4rem; color: #ef4444; font-weight: 500; font-size: 0.875rem; }
    .status-banned .expiry { font-size: 0.75rem; opacity: 0.8; }

    .actions { display: flex; gap: 0.5rem; }
    .btn-icon {
        padding: 0.5rem;
        border-radius: 0.375rem;
        border: 1px solid #e5e7eb;
        background: white;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-icon:hover { background: #f9fafb; color: #111827; }
    .btn-icon.ban:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
    .btn-icon.delete:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
    .btn-icon.unban { color: #10b981; }
    .btn-icon.unban:hover { background: #ecfdf5; border-color: #a7f3d0; }

    .empty { padding: 3rem; text-align: center; color: #9ca3af; }

    /* Modal */
    .modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
        backdrop-filter: blur(2px);
    }
    .modal-content {
        background: white; width: 100%; max-width: 450px; border-radius: 0.75rem;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #f3f4f6; }
    .modal-header h3 { margin: 0; font-size: 1.25rem; }
    .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .user-preview { padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; font-size: 0.9rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .form-group label { font-size: 0.875rem; font-weight: 600; color: #374151; }
    .form-group textarea {
        padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem;
        resize: vertical; min-height: 80px; font-family: inherit;
    }
    .input-with-icon {
        position: relative; display: flex; align-items: center;
    }
    .input-with-icon :global(svg) {
        position: absolute; left: 0.75rem; color: #9ca3af; pointer-events: none;
    }
    .input-with-icon input {
        width: 100%; padding: 0.6rem 0.75rem 0.6rem 2.5rem;
        border: 1px solid #d1d5db; border-radius: 0.375rem;
    }
    .hint { font-size: 0.75rem; color: #6b7280; display: flex; align-items: center; gap: 0.4rem; margin: 0; }
    .modal-footer {
        padding: 1.25rem 1.5rem; background: #f9fafb;
        display: flex; justify-content: flex-end; gap: 0.75rem;
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        color: #374151;
        font-weight: 500;
    }
    .checkbox-label input {
        width: 1.1rem;
        height: 1.1rem;
        cursor: pointer;
    }
    .btn-confirm {
        padding: 0.6rem 1.25rem; border-radius: 0.375rem; border: none;
        background: #ef4444; color: white; font-weight: 600; cursor: pointer;
    }
    .btn-confirm:hover { background: #dc2626; }
    .btn-cancel {
        padding: 0.6rem 1.25rem; border-radius: 0.375rem; border: 1px solid #d1d5db;
        background: white; color: #374151; font-weight: 600; cursor: pointer;
    }
</style>
