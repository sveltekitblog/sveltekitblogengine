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
    import { invalidateAll } from "$app/navigation";
    import { FileText, Edit2, Trash2, Plus, Eye, Calendar, Tag } from "lucide-svelte";
    import { t } from "$lib/i18n.svelte";

    let { data } = $props<{ data: PageData }>();

    let deleteConfirmPost: any = $state(null);

    function showDeleteConfirm(post: any) {
        deleteConfirmPost = post;
    }

    function cancelDelete() {
        deleteConfirmPost = null;
    }

    function formatDate(date: string | number) {
        if (!date) return "-";

        // If it's a number (timestamp), convert to Date object
        const d =
            typeof date === "number"
                ? new Date(date)
                : new Date(date.replace(" ", "T"));

        if (isNaN(d.getTime())) {
            // Fallback for weird formats - directly use string part if possible
            if (typeof date === "string" && date.length >= 16) {
                return date.substring(0, 16); // "YYYY-MM-DD HH:mm"
            }
            return "Invalid Date";
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    // Pagination & Numbering state
    let currentPage = $state(1);
    let itemsPerPage = $state(20);

    $effect(() => {
        const saved = localStorage.getItem('admin_posts_per_page');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed > 0) itemsPerPage = parsed;
        }
    });

    $effect(() => {
        if (itemsPerPage > 0) {
            localStorage.setItem('admin_posts_per_page', itemsPerPage.toString());
            // currentPage = 1; // Unnecessary reset causing reactivity loops sometimes, better not to reset unless out of bounds
        }
    });

    let totalPages = $derived(Math.ceil(data.posts.length / itemsPerPage) || 1);
    
    // Ensure currentPage is within bounds when totalPages changes
    $effect(() => {
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    });

    let paginatedPosts = $derived(data.posts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

    // Calculate numbering and labels for published posts using a Map for O(1) rendering lookup
    let publishedPosts = $derived(data.posts.filter((p: any) => p.status === 'published' && p.type !== 'page'));

    let postNumberMap = $derived.by(() => {
        const map = new Map<string, string>();
        if (publishedPosts.length === 0) return map;

        const groupIds: string[] = [];
        const groupToPostsMap = new Map<string, any[]>();

        for (const post of publishedPosts) {
            // translation_group_id가 없는 레거시 데이터는 본인 id로 독립 그룹 분리
            const gid = post.translation_group_id || post.id;
            if (!groupToPostsMap.has(gid)) {
                groupIds.push(gid);
                groupToPostsMap.set(gid, []);
            }
            groupToPostsMap.get(gid)!.push(post);
        }

        // 가장 오래된 글 그룹이 #1이 되도록 그룹 순서 반전
        const orderedGroups = groupIds.reverse();

        // 번호 및 라벨 생성 (기본 언어 구분 없이 무조건 #-언어코드 형식 부여)
        orderedGroups.forEach((gid, idx) => {
            const baseNumber = idx + 1;
            const siblingPosts = groupToPostsMap.get(gid) || [];
            
            siblingPosts.forEach(post => {
                const getLangLabel = (l: string) => l === 'ko' ? 'kr' : l;
                map.set(post.id, `#${baseNumber}-${getLangLabel(post.lang || 'ko')}`);
            });
        });

        return map;
    });
</script>

<div class="admin-container">
    <header class="page-header">
        <h1><FileText size={24} /> {t('admin.left.menu.posts', { default: '포스트 관리' })} ({data.posts.length})</h1>
        <div class="header-actions flex gap-4 items-center">
            <div class="items-per-page text-sm text-gray-600 flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200">
                <label for="perPage" class="whitespace-nowrap">{t('admin.posts.main.items_per_page', { default: '페이지당 항목:' })}</label>
                <select id="perPage" bind:value={itemsPerPage} class="border-none bg-transparent outline-none cursor-pointer font-semibold text-gray-800">
                    <option value={10}>{t('admin.posts.main.items_count', { count: 10, default: '10개' })}</option>
                    <option value={20}>{t('admin.posts.main.items_count', { count: 20, default: '20개' })}</option>
                    <option value={50}>{t('admin.posts.main.items_count', { count: 50, default: '50개' })}</option>
                    <option value={100}>{t('admin.posts.main.items_count', { count: 100, default: '100개' })}</option>
                </select>
            </div>
            <a href="/posts/new" class="btn-primary">
                <Plus size={16} /> {t('admin.posts.main.new_post', { default: '새 글 작성' })}
            </a>
        </div>
    </header>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>{t('admin.posts.col.title', { default: '제목 & 슬러그' })}</th>
                    <th>{t('blog.nav.category', { default: '카테고리' })}</th>
                    <th class="col-views">{t('admin.posts.col.views', { default: '조회수' })}</th>
                    <th>{t('admin.posts.col.status', { default: '상태' })}</th>
                    <th>{t('admin.posts.col.date', { default: '작성일' })}</th>
                    <th>{t('admin.posts.col.actions', { default: '관리' })}</th>
                </tr>
            </thead>
            <tbody>
                {#if paginatedPosts.length === 0}
                    <tr>
                        <td colspan="6" class="empty-state">{t('admin.posts.empty', { default: '작성된 글이 없습니다.' })}</td>
                    </tr>
                {/if}
                {#each paginatedPosts as post}
                    <tr>
                        <td>
                            <div class="post-title">
                                {#if postNumberMap.has(post.id)}
                                    <span class="text-indigo-600 font-bold mr-2">{postNumberMap.get(post.id)}</span>
                                {/if}
                                {post.title}
                                {#if post.type === 'page'}
                                    <span class="badge type-page">Page</span>
                                {/if}
                            </div>
                            <div class="post-slug">/{post.slug}</div>
                        </td>
                        <td>
                            <span class="category-tag"><Tag size={12}/> {post.category_slug || post.category_name || t('admin.posts.category_default', { default: "일반" })}</span>
                        </td>
                        <td class="col-views">
                            <div class="icon-value"><Eye size={14}/> <span>{post.view_count}</span></div>
                        </td>
                        <td>
                            <span class="badge {post.status}">{post.status}</span>
                        </td>
                        <td>
                            <div class="icon-value"><Calendar size={14}/> <span>{formatDate(post.created_at)}</span></div>
                        </td>
                        <td class="actions">
                            <a href="/posts/{post.id}" class="btn-edit" title={t('admin.posts.action_edit', { default: "수정" })}><Edit2 size={16}/></a>
                            <button
                                type="button"
                                class="btn-delete"
                                onclick={() => showDeleteConfirm(post)}
                                title={t('admin.posts.action_delete', { default: "삭제" })}
                            >
                                <Trash2 size={16}/>
                            </button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if data.posts.length === 0}
            <div class="empty-state">
                <FileText size={48} />
                <p>{t('admin.posts.main.empty', { default: '작성된 포스트가 없습니다.' })}</p>
                <a href="/posts/new" class="btn-primary mt-4">
                    <Plus size={16} /> {t('admin.posts.main.new_post', { default: '새 글 작성' })}
                </a>
            </div>
        {/if}
    </div>

    {#if totalPages > 1}
        <div class="pagination-controls">
            <button class="btn-page" disabled={currentPage === 1} onclick={() => currentPage--}>{t('admin.posts.page_prev', { default: "이전" })}</button>
            <span class="page-info">{currentPage} / {totalPages}</span>
            <button class="btn-page" disabled={currentPage === totalPages} onclick={() => currentPage++}>{t('admin.posts.page_next', { default: "다음" })}</button>
        </div>
    {/if}
</div>

<!-- 삭제 확인 모달 -->
{#if deleteConfirmPost}
    <div class="modal-overlay" onclick={cancelDelete}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>⚠️ {t('admin.posts.main.delete_title', { default: '글 삭제 확인' })}</h2>
            </div>
            <div class="modal-body">
                <p>"{deleteConfirmPost.title}"{t('admin.posts.main.delete_confirm', { default: '을(를) 정말 삭제하시겠습니까?' })}</p>
                <p class="warning">{t('admin.common.warning_irreversible', { default: '이 작업은 되돌릴 수 없습니다.' })}</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick={cancelDelete}>{t('blog.common.cancel', { default: '취소' })}</button>
                <form
                    method="POST"
                    action="?/delete"
                    use:enhance={() => {
                        return async ({ result }) => {
                            if (result.type === "success") {
                                deleteConfirmPost = null;
                                await invalidateAll();
                            } else {
                                console.error("Delete failed:", result);
                                alert(t('admin.posts.delete_failed_server', { default: "삭제에 실패했습니다. (서버 오류)" }));
                            }
                        };
                    }}
                >
                    <input
                        type="hidden"
                        name="id"
                        value={deleteConfirmPost.id}
                    />
                    <button type="submit" class="btn-confirm-delete"
                        >{t('admin.posts.action_delete', { default: "삭제" })}</button
                    >
                </form>
            </div>
        </div>
    </div>
{/if}

<style>
    .admin-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }
    .page-header h1 {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
        font-size: 1.75rem;
        color: #111827;
        font-weight: 700;
    }
    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: #111827;
        color: white;
        padding: 0.75rem 1.25rem;
        border-radius: 0.5rem;
        text-decoration: none;
        font-weight: 600;
        transition: background 0.2s;
        border: none;
        cursor: pointer;
    }
    .btn-primary:hover {
        background: #374151;
    }

    .table-container {
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        overflow: hidden;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
    }
    th {
        background: #f8fafc;
        padding: 1rem 1.5rem;
        font-weight: 600;
        font-size: 0.875rem;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid #e2e8f0;
    }
    td {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.875rem;
        vertical-align: middle;
    }
    tr:last-child td {
        border-bottom: none;
    }
    tr:hover td {
        background: #f8fafc;
    }
    .post-title {
        font-weight: 600;
        color: #1e293b;
        font-size: 1rem;
    }
    .post-slug {
        color: #64748b;
        font-size: 0.75rem;
        margin-top: 0.35rem;
    }
    .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: #f1f5f9;
        color: #475569;
        padding: 0.25rem 0.6rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .icon-value {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #475569;
        white-space: nowrap;
    }
    .empty-state {
        text-align: center;
        padding: 3rem;
        color: #64748b;
        font-size: 0.875rem;
    }
    .col-views {
        min-width: 100px;
    }
    .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
    }
    .badge.published {
        background: #dcfce7;
        color: #166534;
    }
    .badge.draft {
        background: #f1f5f9;
        color: #334155;
    }
    .badge.type-page {
        background: #e0e7ff;
        color: #4338ca;
        margin-left: 0.5rem;
        font-size: 0.65rem;
        padding: 0.2rem 0.5rem;
    }
    .actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }
    .btn-edit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: #64748b;
        padding: 0.5rem;
        border-radius: 0.375rem;
        transition: all 0.2s;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
    }
    .btn-edit:hover {
        background: #eff6ff;
        color: #2563eb;
        border-color: #bfdbfe;
    }
    .btn-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 0.5rem;
        cursor: pointer;
        color: #64748b;
        border-radius: 0.375rem;
        transition: all 0.2s;
    }
    .btn-delete:hover {
        background: #fee2e2;
        color: #ef4444;
    }
    
    /* Pagination Styles */
    .pagination-controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        margin-top: 2rem;
    }
    .btn-page {
        padding: 0.5rem 1rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        font-weight: 500;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-page:not(:disabled):hover {
        background: #f9fafb;
        color: #111827;
        border-color: #d1d5db;
    }
    .btn-page:disabled {
        background: #f3f4f6;
        color: #9ca3af;
        cursor: not-allowed;
    }
    .page-info {
        font-weight: 600;
        color: #4b5563;
        font-size: 0.875rem;
    }

    /* Modal styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    .modal {
        background: white;
        border-radius: 0.75rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid #e5e7eb;
    }
    .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #111827;
    }
    .modal-body {
        padding: 1.5rem;
    }
    .modal-body p {
        margin: 0 0 1rem 0;
        color: #374151;
    }
    .warning {
        font-size: 0.875rem;
        color: #ef4444;
        font-weight: 500;
    }
    .modal-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }
    .btn-cancel {
        padding: 0.5rem 1rem;
        border: 1px solid #d1d5db;
        background: white;
        color: #374151;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-cancel:hover {
        background: #f9fafb;
    }
    .btn-confirm-delete {
        padding: 0.5rem 1rem;
        border: none;
        background: #ef4444;
        color: white;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-confirm-delete:hover {
        background: #dc2626;
    }
</style>
