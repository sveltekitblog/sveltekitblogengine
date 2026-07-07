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
    import { MessageSquare, BookOpen, Trash2, Edit3, Eye, EyeOff, Reply } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { page } from "$app/stores";

    let { data }: { data: PageData } = $props();

    let activeTab = $state<'comment' | 'guestbook' | 'archive'>('comment');
    
    $effect(() => {
        const tab = $page.url.searchParams.get('tab');
        if (tab === 'comment' || tab === 'guestbook' || tab === 'archive') {
            activeTab = tab;
        }
    });

    let searchQuery = $state('');

    // Pagination & Selection States
    let currentPage = $state(1);
    let itemsPerPage = $state(20);
    let selectedIds = $state<string[]>([]);

    $effect(() => {
        const saved = localStorage.getItem('admin_interactions_per_page');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed > 0) itemsPerPage = parsed;
        }
    });

    $effect(() => {
        if (itemsPerPage > 0) {
            localStorage.setItem('admin_interactions_per_page', itemsPerPage.toString());
        }
    });

    // Reset pagination and checkbox list on tab change
    $effect(() => {
        const _ = activeTab;
        currentPage = 1;
        selectedIds = [];
    });

    // Action State
    let processingId = $state('');
    
    // Modal State
    let showEditModal = $state(false);
    let editItem: any = $state(null);
    let editContent = $state('');

    let showReplyModal = $state(false);
    let replyItem: any = $state(null);
    let replyContent = $state('');

    const filteredComments = $derived(data.comments.filter((c: any) => 
        c.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ));

    const filteredGuestbooks = $derived(data.guestbooks.filter((g: any) => 
        g.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        g.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ));

    const filteredArchives = $derived(data.archives?.filter((a: any) => 
        a.parsed_data?.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.parsed_data?.userId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.parsed_data?.user_id?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []);

    const activeList = $derived(activeTab === 'comment' ? filteredComments : activeTab === 'guestbook' ? filteredGuestbooks : filteredArchives);

    const totalPages = $derived(Math.ceil(activeList.length / itemsPerPage) || 1);
    
    $effect(() => {
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    });

    const paginatedList = $derived(activeList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

    const isAllSelected = $derived(paginatedList.length > 0 && paginatedList.every((item: any) => selectedIds.includes(item.id)));
    
    function toggleSelectAll() {
        if (isAllSelected) {
            const paginatedItemIds = paginatedList.map((item: any) => item.id);
            selectedIds = selectedIds.filter(id => !paginatedItemIds.includes(id));
        } else {
            const newSelected = [...selectedIds];
            paginatedList.forEach((item: any) => {
                if (!newSelected.includes(item.id)) {
                    newSelected.push(item.id);
                }
            });
            selectedIds = newSelected;
        }
    }

    function toggleSelectItem(id: string) {
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter(x => x !== id);
        } else {
            selectedIds = [...selectedIds, id];
        }
    }

    async function restoreSelected() {
        if (selectedIds.length === 0) return;
        if (!confirm(t('admin.interactions.confirm_restore_selected', { default: `선택한 ${selectedIds.length}개의 데이터를 복구하시겠습니까?` }))) return;
        
        processingId = 'bulk';
        try {
            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore', ids: selectedIds })
            });
            if (res.ok) {
                selectedIds = [];
                await invalidateAll();
            } else alert(t('admin.interactions.restore_failed', { default: "복구 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    async function purgeSelected() {
        if (selectedIds.length === 0) return;
        if (!confirm(t('admin.interactions.confirm_purge_selected', { default: `⚠️ 선택한 ${selectedIds.length}개의 데이터를 휴지통에서 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.` }))) return;
        
        processingId = 'bulk';
        try {
            const res = await fetch(`/api/interactions?action=hard_purge&ids=${selectedIds.join(',')}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                selectedIds = [];
                await invalidateAll();
            } else alert(t('admin.interactions.delete_failed', { default: "삭제 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    async function toggleBlind(id: string, currentDeleted: boolean) {
        const confirmMsg = currentDeleted 
            ? t('admin.interactions.confirm_unblind', { default: "이 글의 블라인드(숨김)를 해제하시겠습니까?" })
            : t('admin.interactions.confirm_blind', { default: "이 글을 블라인드(숨김) 처리하시겠습니까?" });
        if (!confirm(confirmMsg)) return;
        
        processingId = id;
        try {
            const res = await fetch('/api/interactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_deleted: !currentDeleted })
            });
            if (res.ok) await invalidateAll();
            else alert(t('admin.interactions.action_failed', { default: "처리 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    async function hardDelete(id: string) {
        if (!confirm(t('admin.interactions.confirm_delete_trash', { default: "⚠️ 정말 삭제하시겠습니까? 관련 답글도 모두 삭제되며 휴지통에 보관됩니다." }))) return;
        
        processingId = id;
        try {
            const res = await fetch(`/api/interactions?id=${id}`, { method: 'DELETE' });
            if (res.ok) await invalidateAll();
            else alert(t('admin.interactions.delete_failed', { default: "삭제 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    async function restore(id: string) {
        if (!confirm(t('admin.interactions.confirm_restore', { default: "이 데이터를 복구하시겠습니까?" }))) return;
        processingId = id;
        try {
            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore', id })
            });
            if (res.ok) await invalidateAll();
            else alert(t('admin.interactions.restore_failed', { default: "복구 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    async function hardPurge(id: string) {
        if (!confirm(t('admin.interactions.confirm_purge_permanent', { default: "⚠️ 휴지통에서 완전히 영구 삭제하시겠습니까? 돌이킬 수 없습니다." }))) return;
        processingId = id;
        try {
            const res = await fetch(`/api/interactions?action=hard_purge&id=${id}`, { method: 'DELETE' });
            if (res.ok) await invalidateAll();
            else alert(t('admin.interactions.delete_failed', { default: "삭제 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
        processingId = '';
    }

    function openEdit(item: any) {
        editItem = item;
        editContent = item.content;
        showEditModal = true;
    }

    async function saveEdit() {
        if (!editContent.trim()) return;
        try {
            const res = await fetch('/api/interactions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editItem.id, content: editContent })
            });
            if (res.ok) {
                showEditModal = false;
                await invalidateAll();
            } else alert(t('admin.interactions.edit_failed', { default: "수정 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
    }

    function openReply(item: any) {
        replyItem = item;
        replyContent = '';
        showReplyModal = true;
    }

    async function saveReply() {
        if (!replyContent.trim()) return;
        try {
            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_id: replyItem.post_id || null, // pass target_id if comment
                    parent_id: replyItem.id, // the entry we are replying to
                    content: replyContent,
                    type: activeTab // reply matches the parent type
                })
            });
            if (res.ok) {
                showReplyModal = false;
                await invalidateAll();
            } else alert(t('admin.interactions.reply_failed', { default: "답글 작성 실패" }));
        } catch(e) { alert(t('admin.interactions.error_occurred', { default: "오류 발생" })); }
    }

    function formatDate(dstr: string) {
        if(!dstr) return '';
        try { return new Date(dstr).toLocaleString(); } catch { return dstr; }
    }
</script>

<div class="header">
    <div>
        <h1>{t('admin.interactions.title') || '상호작용 관리'}</h1>
        <p class="subtitle">{t('admin.interactions.subtitle') || '사용자의 댓글과 방명록을 일괄 관리합니다.'}</p>
    </div>
    <div class="header-actions flex gap-4 items-center" style="display: flex; gap: 1rem; align-items: center;">
        <div class="items-per-page text-sm text-gray-600 flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200" style="display: flex; align-items: center; gap: 0.5rem; background: white; padding: 0.5rem 0.75rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; font-size: 0.875rem;">
            <label for="perPage" class="whitespace-nowrap">{t('admin.posts.main.items_per_page', { default: '페이지당 항목:' })}</label>
            <select id="perPage" bind:value={itemsPerPage} class="border-none bg-transparent outline-none cursor-pointer font-semibold text-gray-800" style="border: none; background: transparent; outline: none; cursor: pointer; font-weight: 600; color: #1f2937;">
                <option value={10}>{t('admin.posts.main.items_count', { count: 10, default: '10개' })}</option>
                <option value={20}>{t('admin.posts.main.items_count', { count: 20, default: '20개' })}</option>
                <option value={50}>{t('admin.posts.main.items_count', { count: 50, default: '50개' })}</option>
                <option value={100}>{t('admin.posts.main.items_count', { count: 100, default: '100개' })}</option>
            </select>
        </div>
        <div class="search-box">
            <input type="text" bind:value={searchQuery} placeholder={t('admin.interactions.search_placeholder') || '이름 또는 내용 검색...'} />
        </div>
    </div>
</div>

<div class="tabs">
    <button class:active={activeTab === 'comment'} onclick={() => activeTab = 'comment'}>
        <MessageSquare size={18}/> {t('admin.interactions.tab_comments', { default: '댓글' })} <span class="badge">{data.comments.length}</span>
    </button>
    <button class:active={activeTab === 'guestbook'} onclick={() => activeTab = 'guestbook'}>
        <BookOpen size={18}/> {t('admin.interactions.tab_guestbooks', { default: '방명록' })} <span class="badge">{data.guestbooks.length}</span>
    </button>
    <button class:active={activeTab === 'archive'} onclick={() => activeTab = 'archive'}>
        <Trash2 size={18}/> {t('admin.interactions.tab_archive', { default: '휴지통' })} <span class="badge">{data.archives?.length || 0}</span>
    </button>
</div>

{#if activeTab === 'archive' && selectedIds.length > 0}
    <div class="bulk-action-bar" style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.75rem 1rem; border-radius: 0.375rem; margin-bottom: 1rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        <span style="font-size: 0.875rem; color: #1e40af; font-weight: 600;">
            {selectedIds.length}개 선택됨
        </span>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn-cancel" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; cursor: pointer; border: 1px solid #d1d5db; background: white; border-radius: 4px; color: #374151; font-weight: 600;" onclick={restoreSelected} disabled={processingId !== ''}>선택 복구</button>
            <button class="btn-save" style="background:#ef4444; color: white; font-size: 0.8rem; padding: 0.4rem 0.8rem; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;" onclick={purgeSelected} disabled={processingId !== ''}>선택 영구 삭제</button>
        </div>
    </div>
{/if}

<div class="table-container">
    {#if paginatedList.length === 0}
        <div class="empty">{t('admin.interactions.empty') || '조건에 맞는 데이터가 없습니다.'}</div>
    {:else}
        <table class="interactions-table">
            <thead>
                <tr>
                    {#if activeTab === 'archive'}
                        <th style="width: 5%; text-align: center;"><input type="checkbox" checked={isAllSelected} onchange={toggleSelectAll} style="cursor: pointer;" /></th>
                        <th style="width: 20%">{t('admin.interactions.col_author') || '작성자 / 일시'}</th>
                    {:else}
                        <th style="width: 25%">{t('admin.interactions.col_author') || '작성자 / 일시'}</th>
                    {/if}
                    <th style="width: 45%;">{t('admin.interactions.col_content') || '내용 / 연결 정보'}</th>
                    <th style="width: 30%">{t('admin.interactions.col_actions') || '관리'}</th>
                </tr>
            </thead>
            <tbody>
                {#each paginatedList as item}
                    {#if activeTab === 'archive'}
                        <tr>
                            <td style="text-align: center; vertical-align: middle;">
                                <input type="checkbox" checked={selectedIds.includes(item.id)} onchange={() => toggleSelectItem(item.id)} style="cursor: pointer;" />
                            </td>
                            <td>
                                <div class="author-info">
                                    <div class="meta">
                                        <strong>{item.parsed_data?.user_name || item.parsed_data?.userId || item.parsed_data?.user_id || 'Unknown'}</strong>
                                        {#if item.parsed_data?.user_email}
                                        <span class="date block text-xs mt-1" style="color: #64748b;">E-mail: {item.parsed_data?.user_email}</span>
                                        {/if}
                                        <span class="date block text-xs mt-1">{t('admin.interactions.deleted_at') || '삭제 일시'}: {formatDate(item.deleted_at)}</span>
                                        <span class="date block text-xs mt-1" style="color: #ef4444;">{t('admin.interactions.deleted_by') || '지운 주체'}: {item.deleted_by}</span>
                                        {#if item.parsed_data?.ipAddress || item.parsed_data?.ip_address}
                                        <span class="date block text-xs mt-1">IP: {item.parsed_data?.ipAddress || item.parsed_data?.ip_address}</span>
                                        {/if}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div class="content-text opacity-70">
                                    [{t('admin.interactions.original_text') || '원본 텍스트'}]<br>
                                    {item.parsed_data?.content || ''}
                                </div>
                                <div class="text-xs text-gray-400 mt-2">
                                    {t('admin.interactions.created_at') || '작성 일시'}: {formatDate(item.parsed_data?.createdAt || item.parsed_data?.created_at)}
                                </div>
                            </td>
                            <td>
                                <div class="actions-group">
                                    <button class="btn-cancel" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick={() => restore(item.id)} disabled={processingId === item.id}>{t('admin.interactions.action_restore') || '복구'}</button>
                                    <button class="btn-save" style="background:#ef4444; font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick={() => hardPurge(item.id)} disabled={processingId === item.id}>{t('admin.interactions.action_purge') || '영구 삭제'}</button>
                                </div>
                            </td>
                        </tr>
                    {:else}
                        <tr class:is-deleted={item.is_deleted}>
                            <td>
                                <div class="author-info">
                                    {#if item.user_image}
                                        <img src={item.user_image} alt="profile" class="avatar" />
                                    {:else}
                                        <div class="avatar-placeholder">U</div>
                                    {/if}
                                    <div class="meta">
                                        <strong>{item.user_name}</strong>
                                        <span class="date">{formatDate(item.created_at)}</span>
                                        {#if item.ip_address}
                                        <span class="date block text-xs mt-1">IP: {item.ip_address}</span>
                                        {/if}
                                    </div>
                                </div>
                            </td>
                        <td>
                            <div class="content-text {item.is_deleted ? 'line-through opacity-50' : ''}">
                                {item.content}
                            </div>
                            
                            {#if item.parent_id}
                                <div class="badge-reply">↳ {t('admin.interactions.badge_reply') || '답글'}</div>
                            {/if}

                            {#if activeTab === 'comment' && item.post_title}
                                <div class="post-ref">
                                    <a href="/posts/{item.actual_post_id}" target="_blank" title={t('admin.interactions.link_editor') || '에디터에서 수정하기'}>📝 {item.post_title}</a>
                                </div>
                            {/if}
                            {#if item.is_private}
                                <div class="badge-private">{t('admin.interactions.badge_private') || '비밀글'}</div>
                            {/if}
                        </td>
                        <td>
                            <div class="actions-group">
                                <button class="btn-icon" title={t('admin.interactions.tooltip_reply') || '답글 달기'} onclick={() => openReply(item)}><Reply size={16}/></button>
                                <button class="btn-icon" title={t('admin.interactions.tooltip_edit') || '수정'} onclick={() => openEdit(item)}><Edit3 size={16}/></button>
                                    <button class="btn-icon {item.is_deleted ? 'active-blind' : ''}" 
                                        title={item.is_deleted ? (t('admin.interactions.tooltip_unblind') || '블라인드 해제') : (t('admin.interactions.tooltip_blind') || '블라인드(숨김) 처리')} 
                                        onclick={() => toggleBlind(item.id, !!item.is_deleted)}
                                        disabled={processingId === item.id}>
                                        {#if item.is_deleted}<Eye size={16}/>{:else}<EyeOff size={16}/>{/if}
                                    </button>
                                    <button class="btn-icon danger" title={t('admin.interactions.tooltip_delete') || '휴지통으로 이동'} onclick={() => hardDelete(item.id)} disabled={processingId === item.id}><Trash2 size={16}/></button>
                                </div>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    {/if}
</div>

{#if totalPages > 1}
    <div class="pagination-controls" style="margin-top: 1.5rem; display: flex; justify-content: center; align-items: center; gap: 1rem;">
        <button class="btn-page" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; cursor: pointer; font-weight: 500; color: #374151;" disabled={currentPage === 1} onclick={() => currentPage--}>{t('admin.posts.page_prev', { default: "이전" })}</button>
        <span class="page-info" style="font-size: 0.875rem; color: #4b5563; font-weight: 600;">{currentPage} / {totalPages}</span>
        <button class="btn-page" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; cursor: pointer; font-weight: 500; color: #374151;" disabled={currentPage === totalPages} onclick={() => currentPage++}>{t('admin.posts.page_next', { default: "다음" })}</button>
    </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
<div class="modal open">
    <div class="modal-box">
        <h3>{t('admin.interactions.modal_edit_title') || '내용 수정'}</h3>
        <textarea bind:value={editContent} rows="5" class="modal-textarea"></textarea>
        <div class="modal-actions">
            <button class="btn-cancel" onclick={() => showEditModal = false}>{t('admin.interactions.modal_cancel') || '취소'}</button>
            <button class="btn-save" onclick={saveEdit}>{t('admin.interactions.modal_save') || '저장'}</button>
        </div>
    </div>
</div>
{/if}

<!-- Reply Modal -->
{#if showReplyModal}
<div class="modal open">
    <div class="modal-box">
        <h3>{t('admin.interactions.modal_reply_title') || '관리자 답글 쓰기'}</h3>
        <p class="reply-target"><strong>{replyItem?.user_name}</strong>: {replyItem?.content?.substring(0, 50)}...</p>
        <textarea bind:value={replyContent} rows="5" placeholder={t('admin.interactions.modal_reply_placeholder') || '답글 내용을 입력하세요...'} class="modal-textarea"></textarea>
        <div class="modal-actions">
            <button class="btn-cancel" onclick={() => showReplyModal = false}>{t('admin.interactions.modal_cancel') || '취소'}</button>
            <button class="btn-save" onclick={saveReply}>{t('admin.interactions.modal_reply_save') || '답글 작성'}</button>
        </div>
    </div>
</div>
{/if}

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 2rem;
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
    .search-box input {
        padding: 0.5rem 1rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        min-width: 250px;
        background: white;
    }

    .tabs {
        display: flex;
        gap: 0.5rem;
        border-bottom: 2px solid #e5e7eb;
        margin-bottom: 1.5rem;
    }
    .tabs button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: none;
        color: #6b7280;
        font-weight: 500;
        cursor: pointer;
        position: relative;
        bottom: -2px;
        transition: color 0.2s;
    }
    .tabs button:hover { color: #111827; }
    .tabs button.active {
        color: #3b82f6;
        border-bottom: 2px solid #3b82f6;
    }
    .badge {
        background: #f3f4f6;
        color: #4b5563;
        padding: 0.1rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
    }
    .tabs button.active .badge {
        background: #dbeafe;
        color: #1d4ed8;
    }

    .table-container {
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        overflow: hidden;
    }
    .empty {
        padding: 3rem;
        text-align: center;
        color: #6b7280;
    }
    .interactions-table {
        width: 100%;
        border-collapse: collapse;
    }
    .interactions-table th {
        background: #f9fafb;
        padding: 0.75rem 1.5rem;
        text-align: left;
        font-size: 0.875rem;
        color: #4b5563;
        font-weight: 600;
        border-bottom: 1px solid #e5e7eb;
    }
    .interactions-table td {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
    }
    .interactions-table tr:hover td { background: #f9fafb; }
    .is-deleted { background-color: #fef2f2 !important; }

    .author-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder {
        width: 36px; height: 36px; border-radius: 50%;
        background: #e5e7eb; color: #6b7280;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold;
    }
    .meta strong { display: block; color: #111827; margin-bottom: 0.2rem; }
    .meta .date { font-size: 0.75rem; color: #6b7280; }

    .content-text { color: #374151; line-height: 1.5; margin-bottom: 0.5rem; white-space: pre-wrap; word-break: break-all; }
    .line-through { text-decoration: line-through; }
    .opacity-50 { opacity: 0.5; }

    .badge-reply { display: inline-block; font-size: 0.75rem; color: #8b5cf6; background: #ede9fe; padding: 0.1rem 0.4rem; border-radius: 4px; margin-top: 0.2rem; }
    .badge-private { display: inline-block; font-size: 0.75rem; color: #ef4444; background: #fee2e2; padding: 0.1rem 0.4rem; border-radius: 4px; margin-top: 0.2rem; }
    .post-ref { font-size: 0.8rem; margin-top: 0.5rem; }
    .post-ref a { color: #3b82f6; text-decoration: none; }
    .post-ref a:hover { text-decoration: underline; }

    .actions-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .btn-icon {
        padding: 0.4rem; border: none; background: #f3f4f6; color: #4b5563;
        border-radius: 0.375rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-icon:hover { background: #e5e7eb; color: #111827; }
    .btn-icon.active-blind { background: #fee2e2; color: #ef4444; }
    .btn-icon.active-blind:hover { background: #fecaca; }
    .btn-icon.danger:hover { background: #fee2e2; color: #ef4444; }

    /* Modal basics */
    .modal {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: none; align-items: center; justify-content: center; z-index: 50;
    }
    .modal.open { display: flex; }
    .modal-box { background: white; padding: 1.5rem; border-radius: 0.5rem; width: 100%; max-width: 500px; }
    .modal-box h3 { margin-top: 0; margin-bottom: 1rem; color: #111827; }
    .reply-target { font-size: 0.875rem; color: #6b7280; background: #f9fafb; padding: 0.5rem; margin-bottom: 1rem; border-left: 3px solid #d1d5db; }
    .modal-textarea {
        width: 100%; padding: 0.75rem; border: 1px solid #d1d5db;
        border-radius: 0.375rem; box-sizing: border-box; font-family: inherit; margin-bottom: 1rem; resize: vertical;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .btn-save, .btn-cancel { padding: 0.5rem 1rem; border-radius: 0.375rem; border: none; cursor: pointer; font-weight: 500; }
    .btn-save { background: #3b82f6; color: white; }
    .btn-save:hover { background: #2563eb; }
    .btn-cancel { background: #f3f4f6; color: #4b5563; }
    .btn-cancel:hover { background: #e5e7eb; }
</style>
