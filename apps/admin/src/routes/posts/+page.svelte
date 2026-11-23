<!--
 Copyright (C) 2026 SvelteKit Blog Engine

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
    import { enhance, deserialize } from "$app/forms";
    import type { PageData } from "./$types";
    import { invalidateAll } from "$app/navigation";
    import { FileText, Edit2, Trash2, Plus, Eye, Calendar, Tag, RotateCw, Folder, File, Clock, HelpCircle, Search, ArrowUpDown, FolderEdit, EyeOff, Send, X } from "lucide-svelte";
    import { t } from "$lib/i18n.svelte";

    let { data } = $props<{ data: PageData }>();

    let deleteConfirmPost: any = $state(null);

    // 서버 전달 데이터 기반 반응형 상태 (브라우저 캐시 완전 배제)
    let cachedPosts = $derived(data.posts || []);
    let cachedCategories = $derived(data.categories || []);
    let cachedLanguages = $derived(data.languages || []);
    let siteTimezone = $derived((data as any).timezone || 'Asia/Seoul');
    let isRefreshing = $state(false);

    // 수동 새로고침 함수 (SvelteKit 표준 캐시 무효화)
    async function handleForceRefresh() {
        isRefreshing = true;
        try {
            await invalidateAll();
        } finally {
            isRefreshing = false;
        }
    }

    function showDeleteConfirm(post: any) {
        deleteConfirmPost = post;
    }

    function cancelDelete() {
        deleteConfirmPost = null;
    }

    function formatDate(date: string | number) {
        if (!date) return "-";

        let normalized: string | number = date;
        if (typeof date === "string") {
            const trimmed = date.trim();
            if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
                normalized = `${trimmed.replace(" ", "T")}+09:00`;
            }
        }

        const d = new Date(normalized);
        if (isNaN(d.getTime())) {
            if (typeof date === "string" && date.length >= 16) {
                return date.substring(0, 16);
            }
            return "Invalid Date";
        }

        try {
            const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: siteTimezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).formatToParts(d);
            const get = (type: string) => parts.find(p => p.type === type)?.value || "";
            const hour = get("hour") === "24" ? "00" : get("hour");
            return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}`;
        } catch {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const hours = String(d.getHours()).padStart(2, "0");
            const minutes = String(d.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    }

    // Language filtering state (1단 언어 축)
    let selectedLang = $state<string>('all');

    // Dynamic languages list: DB languages + any existing post languages
    let availableLanguages = $derived.by(() => {
        const langMap = new Map<string, { code: string; name: string }>();
        
        // 1. Add configured languages from DB
        (cachedLanguages || []).forEach((l: any) => {
            if (l?.code) {
                langMap.set(l.code, {
                    code: l.code,
                    name: l.name || l.code.toUpperCase()
                });
            }
        });

        // 2. Discover any additional languages present in existing posts
        (cachedPosts || []).forEach((p: any) => {
            const code = p.lang || 'ko';
            if (!langMap.has(code)) {
                langMap.set(code, {
                    code,
                    name: code.toUpperCase()
                });
            }
        });

        return Array.from(langMap.values());
    });

    // Counts per language
    let langCounts = $derived.by(() => {
        const counts: Record<string, number> = {
            all: cachedPosts?.length || 0
        };
        availableLanguages.forEach(l => {
            counts[l.code] = 0;
        });
        (cachedPosts || []).forEach((p: any) => {
            const code = p.lang || 'ko';
            counts[code] = (counts[code] || 0) + 1;
        });
        return counts;
    });

    // 1단: 현재 선택된 언어 기준 포스트 목록
    let postsByLang = $derived.by(() => {
        if (selectedLang === 'all') return cachedPosts || [];
        return (cachedPosts || []).filter((p: any) => (p.lang || 'ko') === selectedLang);
    });

    // 2단: 카테고리 & 특수 분류 필터 상태 ('all' | 'draft' | 'page' | 'uncategorized' | 'cat:{slug}')
    let activeFilter = $state<string>('all');

    // 현재 언어 기준 특수 분류(초안, 정적페이지, 미분류) 카운트
    let specialCounts = $derived.by(() => {
        let draft = 0;
        let scheduled = 0;
        let page = 0;
        let uncategorized = 0;

        postsByLang.forEach((p: any) => {
            if (p.status === 'draft') draft++;
            if (p.status === 'scheduled') scheduled++;
            if (p.type === 'page') page++;
            if (p.type !== 'page' && (!p.category_slug || p.category_slug.trim() === '')) {
                uncategorized++;
            }
        });

        return { draft, scheduled, page, uncategorized };
    });

    // 현재 언어 기준 카테고리 목록 및 카운트
    let categoryList = $derived.by(() => {
        const map = new Map<string, { slug: string; name: string; count: number }>();

        // DB 카테고리 name 매핑
        const catNameMap = new Map<string, string>();
        cachedCategories.forEach((c: any) => {
            if (c?.slug && c?.name) {
                if (selectedLang === 'all' || !c.lang || c.lang === selectedLang) {
                    catNameMap.set(c.slug, c.name);
                }
            }
        });

        // 현재 언어 포스트 중 일반 글(type !== 'page') 카테고리 집계
        postsByLang.forEach((p: any) => {
            if (p.type === 'page') return;
            const slug = p.category_slug?.trim();
            if (!slug) return;

            if (!map.has(slug)) {
                map.set(slug, {
                    slug,
                    name: catNameMap.get(slug) || slug,
                    count: 0
                });
            }
            map.get(slug)!.count++;
        });

        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    });

    // 검색 & 정렬 상태
    let searchQuery = $state("");
    let sortBy = $state<'newest' | 'oldest' | 'views' | 'likes' | 'title'>('newest');

    // 2단 최종 필터링 + 검색 + 정렬된 포스트 목록
    let filteredPosts = $derived.by(() => {
        let base = postsByLang;
        if (activeFilter === 'draft') {
            base = postsByLang.filter((p: any) => p.status === 'draft');
        } else if (activeFilter === 'scheduled') {
            base = postsByLang.filter((p: any) => p.status === 'scheduled');
        } else if (activeFilter === 'page') {
            base = postsByLang.filter((p: any) => p.type === 'page');
        } else if (activeFilter === 'uncategorized') {
            base = postsByLang.filter((p: any) => p.type !== 'page' && (!p.category_slug || p.category_slug.trim() === ''));
        } else if (activeFilter.startsWith('cat:')) {
            const catSlug = activeFilter.slice(4);
            base = postsByLang.filter((p: any) => p.type !== 'page' && p.category_slug === catSlug);
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            base = base.filter((p: any) =>
                (p.title || '').toLowerCase().includes(q) ||
                (p.slug || '').toLowerCase().includes(q)
            );
        }

        if (sortBy === 'newest') return base;
        const copy = [...base];
        if (sortBy === 'oldest') {
            return copy.reverse();
        }
        if (sortBy === 'views') {
            return copy.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));
        }
        if (sortBy === 'likes') {
            return copy.sort((a: any, b: any) => (b.like_count || 0) - (a.like_count || 0));
        }
        if (sortBy === 'title') {
            return copy.sort((a: any, b: any) => String(a.title || '').localeCompare(String(b.title || '')));
        }
        return copy;
    });

    let selectedLangObj = $derived(availableLanguages.find(l => l.code === selectedLang));

    function selectLanguageTab(code: string) {
        selectedLang = code;
        currentPage = 1;
        selectedPostIds = new Set();
        // 선택된 특정 카테고리가 새 언어에 없으면 'all'로 안전 복귀
        if (activeFilter.startsWith('cat:')) {
            const catSlug = activeFilter.slice(4);
            const exists = categoryList.some(c => c.slug === catSlug);
            if (!exists) {
                activeFilter = 'all';
            }
        }
    }

    function selectFilterTab(filterKey: string) {
        activeFilter = filterKey;
        currentPage = 1;
        selectedPostIds = new Set();
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

    let totalPages = $derived(Math.ceil(filteredPosts.length / itemsPerPage) || 1);
    
    // Ensure currentPage is within bounds when totalPages changes
    $effect(() => {
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    });

    let paginatedPosts = $derived(filteredPosts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

    // Calculate numbering and labels for published posts using a Map for O(1) rendering lookup
    let publishedPosts = $derived((cachedPosts || []).filter((p: any) => p.status === 'published' && p.type !== 'page'));

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

    // ── 체크박스 선택 및 일괄 작업 상태 ─────────────────────────────────
    let selectedPostIds = $state<Set<string>>(new Set());
    let selectedCount = $derived(selectedPostIds.size);
    let isAllPageSelected = $derived(
        paginatedPosts.length > 0 && paginatedPosts.every((p: any) => selectedPostIds.has(p.id))
    );
    let selectedPosts = $derived(cachedPosts.filter((p: any) => selectedPostIds.has(p.id)));
    let selectedSyndicatedCount = $derived(selectedPosts.filter((p: any) => p.is_syndicated === 1).length);

    function toggleSelectAllPage() {
        const next = new Set(selectedPostIds);
        if (isAllPageSelected) {
            paginatedPosts.forEach((p: any) => next.delete(p.id));
        } else {
            paginatedPosts.forEach((p: any) => next.add(p.id));
        }
        selectedPostIds = next;
    }

    function togglePostSelection(id: string) {
        const next = new Set(selectedPostIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        selectedPostIds = next;
    }

    function clearSelection() {
        selectedPostIds = new Set();
    }

    // ── 다국어 카테고리 수정 모달 상태 ─────────────────────────────────
    let editCategoryModal = $state<{
        oldSlug: string;
        newSlug: string;
        translations: Array<{ lang: string; langName: string; name: string }>;
        errorMsg: string;
        isSubmitting: boolean;
    } | null>(null);

    function openEditCategoryModal(slug: string, e: MouseEvent) {
        e.stopPropagation();
        const langs = availableLanguages.length > 0 ? availableLanguages : [{ code: 'ko', name: '한국어' }];
        const translations = langs.map((l) => {
            const match = cachedCategories.find((c: any) => c.slug === slug && c.lang === l.code);
            return {
                lang: l.code,
                langName: l.name || l.code.toUpperCase(),
                name: match?.name || ''
            };
        });
        editCategoryModal = {
            oldSlug: slug,
            newSlug: slug,
            translations,
            errorMsg: '',
            isSubmitting: false
        };
    }

    async function submitEditCategory(allowMerge = false) {
        if (!editCategoryModal) return;
        const cleanNewSlug = editCategoryModal.newSlug.trim();
        if (!cleanNewSlug) {
            editCategoryModal.errorMsg = t('admin.posts.cat_err_slug_required', { default: '카테고리 슬러그를 입력하세요.' });
            return;
        }
        const missing = editCategoryModal.translations.find((tr) => !tr.name.trim());
        if (missing) {
            editCategoryModal.errorMsg = t('admin.posts.cat_err_name_required', { lang: missing.langName, default: `모든 언어의 카테고리명을 입력해야 합니다. (${missing.langName})` });
            return;
        }

        editCategoryModal.errorMsg = '';
        editCategoryModal.isSubmitting = true;
        try {
            const formData = new FormData();
            formData.set('oldSlug', editCategoryModal.oldSlug);
            formData.set('newSlug', cleanNewSlug);
            formData.set('translations', JSON.stringify(
                editCategoryModal.translations.map((tr) => ({ lang: tr.lang, name: tr.name.trim() }))
            ));
            if (allowMerge) formData.set('allowMerge', 'true');

            const res = await fetch('?/renameCategory', { method: 'POST', body: formData });
            const result = deserialize(await res.text());

            if (result.type === 'failure') {
                const errData = result.data as any;
                if (errData?.error === 'TARGET_CATEGORY_EXISTS') {
                    editCategoryModal.isSubmitting = false;
                    const ok = confirm(t('admin.posts.cat_confirm_merge', { slug: cleanNewSlug, default: `"${cleanNewSlug}" 카테고리가 이미 존재합니다. 기존 카테고리로 병합(Merge)하시겠습니까?` }));
                    if (ok) {
                        await submitEditCategory(true);
                    }
                    return;
                }
                editCategoryModal.errorMsg = errData?.error || t('admin.posts.cat_err_save', { default: '카테고리 변경에 실패했습니다.' });
                return;
            }

            if (result.type === 'success') {
                if (activeFilter === `cat:${editCategoryModal.oldSlug}`) {
                    activeFilter = `cat:${cleanNewSlug}`;
                }
                editCategoryModal = null;
                await invalidateAll();
            }
        } catch (err: any) {
            editCategoryModal.errorMsg = err?.message || t('admin.posts.bulk_error_generic', { default: '처리 중 오류가 발생했습니다.' });
        } finally {
            if (editCategoryModal) editCategoryModal.isSubmitting = false;
        }
    }

    // ── 일괄 작업 모달 및 10건 단위 청크 실행 ────────────────────────────
    let bulkProgress = $state<{ active: boolean; label: string; processed: number; total: number }>({
        active: false,
        label: '',
        processed: 0,
        total: 0
    });

    let bulkCategoryModal = $state<{
        targetSlug: string;
        isNewCategory: boolean;
        translations: Array<{ lang: string; langName: string; name: string }>;
        errorMsg: string;
    } | null>(null);

    let bulkDeleteModalOpen = $state(false);

    let uniqueCategorySlugs = $derived.by(() => {
        const map = new Map<string, string>();
        cachedCategories.forEach((c: any) => {
            if (c?.slug && !map.has(c.slug)) {
                map.set(c.slug, c.name || c.slug);
            }
        });
        return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
    });

    function openBulkCategoryModal() {
        const langs = availableLanguages.length > 0 ? availableLanguages : [{ code: 'ko', name: '한국어' }];
        const defaultSlug = uniqueCategorySlugs[0]?.slug || '';
        bulkCategoryModal = {
            targetSlug: defaultSlug,
            isNewCategory: uniqueCategorySlugs.length === 0,
            translations: langs.map((l) => ({
                lang: l.code,
                langName: l.name || l.code.toUpperCase(),
                name: ''
            })),
            errorMsg: ''
        };
    }

    async function runBulkInChunks(
        actionPath: string,
        label: string,
        ids: string[],
        extraFields: Record<string, string> = {}
    ): Promise<{ ok: boolean; error?: string }> {
        const chunkSize = 10;
        bulkProgress = { active: true, label, processed: 0, total: ids.length };
        try {
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const formData = new FormData();
                formData.set('ids', JSON.stringify(chunk));
                for (const [k, v] of Object.entries(extraFields)) {
                    formData.set(k, v);
                }
                const res = await fetch(actionPath, { method: 'POST', body: formData });
                const result = deserialize(await res.text());
                if (result.type === 'failure') {
                    return { ok: false, error: (result.data as any)?.error || t('admin.posts.bulk_error_generic', { default: '처리 중 오류가 발생했습니다.' }) };
                }
                bulkProgress.processed = Math.min(i + chunk.length, ids.length);
            }
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err?.message || t('admin.posts.bulk_error_network', { default: '네트워크 오류가 발생했습니다.' }) };
        } finally {
            bulkProgress = { active: false, label: '', processed: 0, total: 0 };
        }
    }

    async function submitBulkCategory() {
        if (!bulkCategoryModal) return;
        const targetSlug = bulkCategoryModal.targetSlug.trim();
        if (!targetSlug) {
            bulkCategoryModal.errorMsg = t('admin.posts.bulk_cat_err_slug', { default: '카테고리 슬러그를 선택하거나 입력하세요.' });
            return;
        }
        if (bulkCategoryModal.isNewCategory) {
            const missing = bulkCategoryModal.translations.find((tr) => !tr.name.trim());
            if (missing) {
                bulkCategoryModal.errorMsg = t('admin.posts.bulk_cat_err_names', { lang: missing.langName, default: `새 카테고리의 모든 언어 이름을 입력하세요. (${missing.langName})` });
                return;
            }
        }

        const ids = Array.from(selectedPostIds);
        const translationsPayload = bulkCategoryModal.isNewCategory
            ? JSON.stringify(bulkCategoryModal.translations.map((tr) => ({ lang: tr.lang, name: tr.name.trim() })))
            : '[]';

        bulkCategoryModal = null;
        const res = await runBulkInChunks('?/bulkUpdateCategory', t('admin.posts.bulk_progress_category', { default: '카테고리 일괄 변경 중...' }), ids, {
            targetSlug,
            translations: translationsPayload
        });
        if (!res.ok) {
            alert(res.error);
        } else {
            clearSelection();
            await invalidateAll();
        }
    }

    async function executeBulkStatus(targetStatus: 'draft' | 'published') {
        const ids = Array.from(selectedPostIds);
        if (ids.length === 0) return;
        const msg = targetStatus === 'draft'
            ? t('admin.posts.bulk_confirm_draft', { count: ids.length, default: `선택한 ${ids.length}개 포스트를 초안(비공개)으로 전환하시겠습니까?` })
            : t('admin.posts.bulk_confirm_publish', { count: ids.length, default: `선택한 ${ids.length}개 포스트를 공개 발행하시겠습니까?` });
        if (!confirm(msg)) return;

        const label = targetStatus === 'draft'
            ? t('admin.posts.bulk_progress_draft', { default: '초안으로 전환 중...' })
            : t('admin.posts.bulk_progress_publish', { default: '일괄 발행 중...' });
        const res = await runBulkInChunks('?/bulkUpdateStatus', label, ids, { targetStatus });
        if (!res.ok) {
            alert(res.error);
        } else {
            clearSelection();
            await invalidateAll();
        }
    }

    async function executeBulkDelete() {
        const ids = Array.from(selectedPostIds);
        if (ids.length === 0) return;
        bulkDeleteModalOpen = false;
        const res = await runBulkInChunks('?/bulkDelete', t('admin.posts.bulk_progress_delete', { default: '선택한 포스트 삭제 중...' }), ids);
        if (!res.ok) {
            alert(res.error);
        } else {
            clearSelection();
            await invalidateAll();
        }
    }
</script>

<div class="admin-container">
    <header class="page-header">
        <h1><FileText size={24} /> {t('admin.left.menu.posts', { default: '포스트 관리' })} ({cachedPosts.length})</h1>
        <div class="header-actions flex gap-4 items-center">
            <button
                type="button"
                class="btn-refresh"
                onclick={handleForceRefresh}
                title={t('admin.posts.btn_refresh', { default: '캐시 비우고 최신 데이터로 새로고침' })}
                disabled={isRefreshing}
            >
                <RotateCw size={15} class={isRefreshing ? 'spin' : ''} />
                <span class="refresh-text">{t('admin.posts.refresh', { default: '새로고침' })}</span>
            </button>
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

    <!-- Dynamic Language Filter Tabs (1단: 언어 필터) -->
    {#if availableLanguages.length > 1}
        <div class="lang-filter-bar">
            <button
                type="button"
                class="lang-filter-tab {selectedLang === 'all' ? 'active' : ''}"
                onclick={() => selectLanguageTab('all')}
            >
                <span>{t('admin.posts.filter_all', { default: '전체' })}</span>
                <span class="count-badge">{langCounts['all'] || 0}</span>
            </button>
            {#each availableLanguages as lang}
                <button
                    type="button"
                    class="lang-filter-tab {selectedLang === lang.code ? 'active' : ''}"
                    onclick={() => selectLanguageTab(lang.code)}
                >
                    <span class="lang-code-pill">{lang.code === 'ko' ? 'KR' : lang.code.toUpperCase()}</span>
                    <span>{lang.name}</span>
                    <span class="count-badge {langCounts[lang.code] === 0 ? 'zero' : ''}">{langCounts[lang.code] || 0}</span>
                </button>
            {/each}
        </div>
    {/if}

    <!-- Category & Special Classifications Filter Bar (2단: 카테고리 및 특수분류) -->
    <div class="category-filter-bar">
        <button
            type="button"
            class="cat-filter-tab {activeFilter === 'all' ? 'active' : ''}"
            onclick={() => selectFilterTab('all')}
        >
            <span>{t('admin.posts.filter_all_cats', { default: '전체' })}</span>
            <span class="cat-count-badge">{postsByLang.length}</span>
        </button>

        {#each categoryList as cat}
            <div class="cat-filter-chip-wrap {activeFilter === `cat:${cat.slug}` ? 'active' : ''}">
                <button
                    type="button"
                    class="cat-filter-tab {activeFilter === `cat:${cat.slug}` ? 'active' : ''}"
                    onclick={() => selectFilterTab(`cat:${cat.slug}`)}
                >
                    <Folder size={13} class="tab-icon cat-icon" />
                    <span class="cat-name">{cat.name}</span>
                    <span class="cat-count-badge">{cat.count}</span>
                </button>
                <button
                    type="button"
                    class="cat-edit-btn"
                    title={t('admin.posts.cat_edit_title', { default: '카테고리 이름·슬러그 수정' })}
                    onclick={(e) => openEditCategoryModal(cat.slug, e)}
                >
                    <Edit2 size={12} />
                </button>
            </div>
        {/each}

        <div class="filter-divider"></div>

        <button
            type="button"
            class="cat-filter-tab special-tab tab-page {activeFilter === 'page' ? 'active' : ''}"
            onclick={() => selectFilterTab('page')}
        >
            <File size={13} class="tab-icon" />
            <span>{t('admin.posts.filter_page', { default: '정적 페이지' })}</span>
            <span class="cat-count-badge {specialCounts.page === 0 ? 'zero' : ''}">{specialCounts.page}</span>
        </button>

        <button
            type="button"
            class="cat-filter-tab special-tab tab-draft {activeFilter === 'draft' ? 'active' : ''}"
            onclick={() => selectFilterTab('draft')}
        >
            <Clock size={13} class="tab-icon" />
            <span>{t('admin.posts.filter_draft', { default: '초안' })}</span>
            <span class="cat-count-badge {specialCounts.draft === 0 ? 'zero' : ''}">{specialCounts.draft}</span>
        </button>
        <button
            type="button"
            class="cat-filter-tab special-tab tab-scheduled {activeFilter === 'scheduled' ? 'active' : ''}"
            onclick={() => selectFilterTab('scheduled')}
            title={t('admin.posts.filter_scheduled_title', { default: '예약 공개 대기 중인 포스트 목록' })}
        >
            <Calendar size={13} class="tab-icon" />
            <span>{t('admin.posts.filter_scheduled', { default: '예약됨' })}</span>
            <span class="cat-count-badge {specialCounts.scheduled === 0 ? 'zero' : ''}">{specialCounts.scheduled}</span>
        </button>

        {#if specialCounts.uncategorized > 0}
            <button
                type="button"
                class="cat-filter-tab special-tab tab-uncategorized {activeFilter === 'uncategorized' ? 'active' : ''}"
                onclick={() => selectFilterTab('uncategorized')}
            >
                <HelpCircle size={13} class="tab-icon" />
                <span>{t('admin.posts.filter_uncategorized', { default: '미분류' })}</span>
                <span class="cat-count-badge">{specialCounts.uncategorized}</span>
            </button>
        {/if}
    </div>

    <!-- 검색 및 정렬 툴바 -->
    <div class="posts-toolbar">
        <div class="search-box">
            <Search size={15} class="search-icon" />
            <input
                type="text"
                bind:value={searchQuery}
                oninput={() => { currentPage = 1; clearSelection(); }}
                placeholder={t('admin.posts.search_placeholder', { default: '제목 또는 슬러그로 검색...' })}
                aria-label={t('admin.posts.search_placeholder', { default: '제목 또는 슬러그로 검색...' })}
            />
            {#if searchQuery}
                <button type="button" class="search-clear" onclick={() => { searchQuery = ''; currentPage = 1; clearSelection(); }} title={t('admin.posts.search_clear', { default: '검색어 지우기' })}>
                    <X size={14} />
                </button>
            {/if}
        </div>
        <div class="sort-box">
            <ArrowUpDown size={14} />
            <select bind:value={sortBy} onchange={() => { currentPage = 1; clearSelection(); }} aria-label="Sort posts">
                <option value="newest">{t('admin.posts.sort_newest', { default: '최신순' })}</option>
                <option value="oldest">{t('admin.posts.sort_oldest', { default: '오래된순' })}</option>
                <option value="views">{t('admin.posts.sort_views', { default: '조회수순' })}</option>
                <option value="likes">{t('admin.posts.sort_likes', { default: '좋아요순' })}</option>
                <option value="title">{t('admin.posts.sort_title', { default: '제목순' })}</option>
            </select>
        </div>
    </div>

    <!-- 일괄 작업 바 -->
    {#if selectedCount > 0 || bulkProgress.active}
        <div class="bulk-action-bar">
            {#if bulkProgress.active}
                <div class="bulk-progress-info">
                    <RotateCw size={15} class="spin" />
                    <span>{bulkProgress.label} ({bulkProgress.processed} / {bulkProgress.total})</span>
                </div>
            {:else}
                <div class="bulk-selection-info">
                    <span>{t('admin.posts.bulk_selected_count', { count: selectedCount, default: `${selectedCount}개 선택됨` })}</span>
                    <button type="button" class="btn-bulk-clear" onclick={clearSelection}>{t('admin.posts.bulk_clear', { default: '선택 해제' })}</button>
                </div>
                <div class="bulk-buttons">
                    <button type="button" class="btn-bulk" onclick={openBulkCategoryModal}>
                        <FolderEdit size={14} /> {t('admin.posts.bulk_change_category', { default: '카테고리 변경' })}
                    </button>
                    <button type="button" class="btn-bulk" onclick={() => executeBulkStatus('draft')}>
                        <EyeOff size={14} /> {t('admin.posts.bulk_to_draft', { default: '초안으로 전환' })}
                    </button>
                    <button type="button" class="btn-bulk btn-bulk-publish" onclick={() => executeBulkStatus('published')}>
                        <Send size={14} /> {t('admin.posts.bulk_publish', { default: '일괄 발행' })}
                    </button>
                    <button type="button" class="btn-bulk btn-bulk-delete" onclick={() => { bulkDeleteModalOpen = true; }}>
                        <Trash2 size={14} /> {t('admin.posts.bulk_delete', { default: '선택 삭제' })}
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="col-check">
                        <input
                            type="checkbox"
                            checked={isAllPageSelected}
                            onchange={toggleSelectAllPage}
                            aria-label="현재 페이지 전체 선택"
                        />
                    </th>
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
                        <td colspan="7" class="empty-state">
                            <div class="empty-lang-box">
                                <p class="empty-lang-title">
                                    {#if activeFilter === 'page'}
                                        {t('admin.posts.empty_page', { default: '등록된 정적 페이지가 없습니다.' })}
                                    {:else if activeFilter === 'draft'}
                                        {t('admin.posts.empty_draft', { default: '작성 중인 초안이 없습니다.' })}
                                    {:else if activeFilter === 'scheduled'}
                                        {t('admin.posts.empty_scheduled', { default: '예약 공개 대기 중인 포스트가 없습니다.' })}
                                    {:else if activeFilter === 'uncategorized'}
                                        {t('admin.posts.empty_uncategorized', { default: '미분류 포스트가 없습니다.' })}
                                    {:else if activeFilter.startsWith('cat:')}
                                        {t('admin.posts.empty_cat', { default: '해당 카테고리에 등록된 포스트가 없습니다.' })}
                                    {:else if selectedLang !== 'all'}
                                        {selectedLangObj ? `${selectedLangObj.name} (${selectedLangObj.code.toUpperCase()}) ` : ''}
                                        {t('admin.posts.filter_empty_lang', { default: '해당 언어로 작성된 포스트가 없습니다.' })}
                                    {:else}
                                        {t('admin.posts.empty', { default: '작성된 글이 없습니다.' })}
                                    {/if}
                                </p>
                                {#if activeFilter !== 'all'}
                                    <button type="button" class="btn-reset-filter" onclick={() => selectFilterTab('all')}>
                                        {t('admin.posts.reset_filter', { default: '전체 목록 보기' })}
                                    </button>
                                {/if}
                            </div>
                        </td>
                    </tr>
                {/if}
                {#each paginatedPosts as post}
                    <tr class={selectedPostIds.has(post.id) ? 'row-selected' : ''}>
                        <td class="col-check">
                            <input
                                type="checkbox"
                                checked={selectedPostIds.has(post.id)}
                                onchange={() => togglePostSelection(post.id)}
                                aria-label="{post.title} 선택"
                            />
                        </td>
                        <td>
                            <div class="post-title flex items-center flex-wrap gap-1.5">
                                {#if postNumberMap.has(post.id)}
                                    <span class="text-indigo-600 font-bold mr-1">{postNumberMap.get(post.id)}</span>
                                {/if}
                                <span class="title-text">{post.title}</span>
                                <span class="lang-chip">{post.lang === 'ko' ? 'KR' : (post.lang || 'KR').toUpperCase()}</span>
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
                            <span class="badge {post.status}">
                                {post.status === 'scheduled' ? t('admin.posts.status_scheduled', { default: '예약됨' }) : post.status}
                            </span>
                        </td>
                        <td>
                            <div class="icon-value"><Calendar size={14}/> <span>{formatDate(post.status === 'published' ? (post.published_at || post.created_at) : post.created_at)}</span></div>
                            {#if post.status === 'scheduled' && post.published_at}
                                <div class="scheduled-date-note">
                                    <Clock size={12}/> <span>{t('admin.posts.scheduled_at_prefix', { default: '공개 예정:' })} {formatDate(post.published_at)}</span>
                                </div>
                            {/if}
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
            <button class="btn-page" disabled={currentPage === 1} onclick={() => { currentPage--; clearSelection(); }}>{t('admin.posts.page_prev', { default: "이전" })}</button>
            <span class="page-info">{currentPage} / {totalPages}</span>
            <button class="btn-page" disabled={currentPage === totalPages} onclick={() => { currentPage++; clearSelection(); }}>{t('admin.posts.page_next', { default: "다음" })}</button>
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
                {#if deleteConfirmPost.is_syndicated}
                    <div style="margin: 0.85rem 0; padding: 0.75rem; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 0.8125rem; color: #0369a1; line-height: 1.45;">
                        <span style="font-weight: 700; display: block; margin-bottom: 0.25rem;">🌐 {t('admin.posts.delete_modal.hub_notice_title', { default: '스벨트킷블로그 허브 연동 안내' })}</span>
                        • {@html t('admin.posts.delete_modal.hub_notice_1', { default: '허브에 등록된 글의 경우, <strong>추천(좋아요)이 없는 경우에만 허브에서 완전 삭제</strong>됩니다.' })}<br/>
                        • {@html t('admin.posts.delete_modal.hub_notice_2', { default: '추천이 1개 이상 존재하는 경우에는 방문자 추천 통계 보존을 위해 <strong>허브 피드에서 자동으로 비공개(숨김)</strong> 처리됩니다.' })}
                    </div>
                {/if}

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
                                if (typeof window !== 'undefined') {
                                    window.location.href = `/posts?refreshed=${Date.now()}`;
                                } else {
                                    await invalidateAll();
                                }
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

<!-- 다국어 카테고리 수정 모달 -->
{#if editCategoryModal}
    <div class="modal-overlay" onclick={() => { if (!editCategoryModal?.isSubmitting) editCategoryModal = null; }}>
        <div class="modal modal-wide" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>📁 {t('admin.posts.cat_modal_title', { default: '카테고리 이름·슬러그 수정' })}</h2>
            </div>
            <div class="modal-body">
                <div class="form-field">
                    <label for="edit-cat-slug">{t('admin.posts.cat_slug_label', { default: '공통 슬러그 (영문 URL 키)' })}</label>
                    <input
                        id="edit-cat-slug"
                        type="text"
                        bind:value={editCategoryModal.newSlug}
                        placeholder={t('admin.posts.cat_slug_placeholder', { default: '예: dev, review' })}
                        disabled={editCategoryModal.isSubmitting}
                    />
                    <small class="field-help">{t('admin.posts.cat_slug_help', { slug: editCategoryModal.oldSlug, default: `기존 슬러그: ${editCategoryModal.oldSlug} — 변경 시 해당 카테고리의 모든 포스트에 즉시 반영됩니다.` })}</small>
                </div>

                <div class="form-field">
                    <span class="field-group-label">{t('admin.posts.cat_names_label', { default: '언어별 카테고리명 (모든 언어 필수 입력)' })}</span>
                    <div class="lang-inputs-grid">
                        {#each editCategoryModal.translations as tr}
                            <div class="lang-input-row">
                                <span class="lang-tag">{tr.lang === 'ko' ? 'KR' : tr.lang.toUpperCase()}</span>
                                <input
                                    type="text"
                                    bind:value={tr.name}
                                    placeholder={t('admin.posts.cat_name_placeholder', { lang: tr.langName, default: `${tr.langName} 카테고리명` })}
                                    disabled={editCategoryModal.isSubmitting}
                                />
                            </div>
                        {/each}
                    </div>
                </div>

                {#if editCategoryModal.errorMsg}
                    <p class="modal-error">{editCategoryModal.errorMsg}</p>
                {/if}
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" disabled={editCategoryModal.isSubmitting} onclick={() => { editCategoryModal = null; }}>{t('blog.common.cancel', { default: '취소' })}</button>
                <button type="button" class="btn-primary-modal" disabled={editCategoryModal.isSubmitting} onclick={() => submitEditCategory(false)}>
                    {editCategoryModal.isSubmitting ? t('admin.posts.cat_saving', { default: '저장 중...' }) : t('admin.posts.cat_save', { default: '저장' })}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- 일괄 카테고리 변경 모달 -->
{#if bulkCategoryModal}
    <div class="modal-overlay" onclick={() => { bulkCategoryModal = null; }}>
        <div class="modal modal-wide" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>📂 {t('admin.posts.bulk_cat_modal_title', { count: selectedCount, default: `선택 포스트 카테고리 일괄 변경 (${selectedCount}건)` })}</h2>
            </div>
            <div class="modal-body">
                <div class="mode-toggle-row">
                    <label>
                        <input type="radio" name="bulkCatMode" checked={!bulkCategoryModal.isNewCategory} onchange={() => { if (bulkCategoryModal) { bulkCategoryModal.isNewCategory = false; bulkCategoryModal.targetSlug = uniqueCategorySlugs[0]?.slug || ''; } }} />
                        {t('admin.posts.bulk_cat_mode_existing', { default: '기존 카테고리 선택' })}
                    </label>
                    <label>
                        <input type="radio" name="bulkCatMode" checked={bulkCategoryModal.isNewCategory} onchange={() => { if (bulkCategoryModal) { bulkCategoryModal.isNewCategory = true; bulkCategoryModal.targetSlug = ''; } }} />
                        {t('admin.posts.bulk_cat_mode_new', { default: '새 카테고리 직접 입력' })}
                    </label>
                </div>

                {#if !bulkCategoryModal.isNewCategory}
                    <div class="form-field">
                        <label for="bulk-cat-select">{t('admin.posts.bulk_cat_select_label', { default: '대상 카테고리' })}</label>
                        <select id="bulk-cat-select" bind:value={bulkCategoryModal.targetSlug}>
                            {#each uniqueCategorySlugs as c}
                                <option value={c.slug}>{c.name} ({c.slug})</option>
                            {/each}
                        </select>
                    </div>
                {:else}
                    <div class="form-field">
                        <label for="bulk-cat-new-slug">{t('admin.posts.bulk_cat_new_slug_label', { default: '새 카테고리 슬러그' })}</label>
                        <input id="bulk-cat-new-slug" type="text" bind:value={bulkCategoryModal.targetSlug} placeholder={t('admin.posts.cat_slug_placeholder', { default: '예: tech, news' })} />
                    </div>
                    <div class="form-field">
                        <span class="field-group-label">{t('admin.posts.bulk_cat_new_names_label', { default: '새 카테고리 언어별 이름 (모든 언어 필수)' })}</span>
                        <div class="lang-inputs-grid">
                            {#each bulkCategoryModal.translations as tr}
                                <div class="lang-input-row">
                                    <span class="lang-tag">{tr.lang === 'ko' ? 'KR' : tr.lang.toUpperCase()}</span>
                                    <input type="text" bind:value={tr.name} placeholder={t('admin.posts.cat_name_placeholder', { lang: tr.langName, default: `${tr.langName} 카테고리명` })} />
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <small class="field-help">{t('admin.posts.bulk_cat_page_notice', { default: '※ 정적 페이지(Page)가 포함된 경우 카테고리 변경 대상에서 자동으로 제외됩니다.' })}</small>
                {#if bulkCategoryModal.errorMsg}
                    <p class="modal-error">{bulkCategoryModal.errorMsg}</p>
                {/if}
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick={() => { bulkCategoryModal = null; }}>{t('blog.common.cancel', { default: '취소' })}</button>
                <button type="button" class="btn-primary-modal" onclick={submitBulkCategory}>{t('admin.posts.bulk_cat_apply', { default: '일괄 변경' })}</button>
            </div>
        </div>
    </div>
{/if}

<!-- 일괄 삭제 확인 모달 -->
{#if bulkDeleteModalOpen}
    <div class="modal-overlay" onclick={() => { bulkDeleteModalOpen = false; }}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>⚠️ {t('admin.posts.bulk_delete_modal_title', { default: '선택 포스트 일괄 삭제' })}</h2>
            </div>
            <div class="modal-body">
                <p>{t('admin.posts.bulk_delete_confirm_msg', { count: selectedCount, default: `선택한 ${selectedCount}개의 포스트를 정말 삭제하시겠습니까?` })}</p>
                {#if selectedSyndicatedCount > 0}
                    <div style="margin: 0.85rem 0; padding: 0.75rem; background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 0.8125rem; color: #0369a1; line-height: 1.45;">
                        <span style="font-weight: 700; display: block; margin-bottom: 0.25rem;">🌐 {t('admin.posts.bulk_delete_hub_title', { count: selectedSyndicatedCount, default: `허브 연동 포스트 ${selectedSyndicatedCount}건 포함` })}</span>
                        {t('admin.posts.bulk_delete_hub_desc', { default: '• 추천(좋아요)이 없는 글은 허브에서 완전 삭제되며, 추천이 1개 이상 있는 글은 통계 보존을 위해 허브 피드에서 비공개(숨김) 처리됩니다.' })}
                    </div>
                {/if}
                <p class="warning">{t('admin.common.warning_irreversible', { default: '이 작업은 되돌릴 수 없습니다.' })}</p>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick={() => { bulkDeleteModalOpen = false; }}>{t('blog.common.cancel', { default: '취소' })}</button>
                <button type="button" class="btn-confirm-delete" onclick={executeBulkDelete}>{t('admin.posts.bulk_delete_confirm_btn', { default: '일괄 삭제' })}</button>
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

    /* Language Filter Tabs */
    .lang-filter-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        overflow-x: auto;
        padding-bottom: 0.5rem;
        scrollbar-width: thin;
    }
    .lang-filter-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
    }
    .lang-filter-tab:hover {
        background: #e2e8f0;
        color: #1e293b;
        border-color: #cbd5e1;
    }
    .lang-filter-tab.active {
        background: #1e293b;
        color: white;
        border-color: #1e293b;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .lang-code-pill {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        background: #e2e8f0;
        color: #334155;
    }
    .lang-filter-tab.active .lang-code-pill {
        background: #334155;
        color: #f8fafc;
    }
    .count-badge {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.125rem 0.45rem;
        border-radius: 9999px;
        background: #cbd5e1;
        color: #1e293b;
    }
    .count-badge.zero {
        opacity: 0.6;
    }
    .lang-filter-tab.active .count-badge {
        background: #475569;
        color: white;
    }
    .lang-chip {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.125rem 0.4rem;
        border-radius: 0.25rem;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        letter-spacing: 0.03em;
    }
    .empty-lang-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 0;
    }
    .empty-lang-title {
        color: #64748b;
        font-size: 0.9375rem;
        margin: 0;
    }

    /* 새로고침 버튼 스타일 */
    .btn-refresh {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: white;
        border: 1px solid #e2e8f0;
        color: #475569;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-refresh:hover:not(:disabled) {
        background: #f8fafc;
        color: #1e293b;
        border-color: #cbd5e1;
    }
    .btn-refresh:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .refresh-text {
        font-size: 0.8125rem;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .btn-refresh :global(svg.spin) {
        animation: spin 0.8s linear infinite;
    }

    /* 2단: Category & Special Filter Tabs */
    .category-filter-bar {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        margin-bottom: 1.5rem;
        overflow-x: auto;
        padding-bottom: 0.35rem;
        scrollbar-width: thin;
    }
    .cat-filter-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.375rem 0.75rem;
        background: #ffffff;
        color: #475569;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
    }
    .cat-filter-tab:hover {
        background: #f1f5f9;
        color: #1e293b;
        border-color: #cbd5e1;
    }
    .cat-filter-tab.active {
        background: #0f172a;
        color: #ffffff;
        border-color: #0f172a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .cat-name {
        font-weight: 500;
    }
    .tab-icon {
        flex-shrink: 0;
        opacity: 0.75;
    }
    .cat-filter-tab.active .tab-icon {
        opacity: 1;
    }
    .cat-count-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.1rem 0.4rem;
        border-radius: 9999px;
        background: #e2e8f0;
        color: #334155;
        line-height: 1.2;
    }
    .cat-filter-tab.active .cat-count-badge {
        background: #334155;
        color: #ffffff;
    }
    .cat-count-badge.zero {
        opacity: 0.5;
    }

    /* 구분선 */
    .filter-divider {
        width: 1px;
        height: 18px;
        background: #cbd5e1;
        margin: 0 0.35rem;
        flex-shrink: 0;
    }

    /* 특수 탭 개별 스타일 */
    .cat-filter-tab.special-tab.tab-page {
        background: #f5f3ff;
        color: #5b21b6;
        border-color: #ddd6fe;
    }
    .cat-filter-tab.special-tab.tab-page:hover {
        background: #ede9fe;
    }
    .cat-filter-tab.special-tab.tab-page.active {
        background: #6d28d9;
        color: #ffffff;
        border-color: #6d28d9;
    }
    .cat-filter-tab.special-tab.tab-page .cat-count-badge {
        background: #ddd6fe;
        color: #5b21b6;
    }
    .cat-filter-tab.special-tab.tab-page.active .cat-count-badge {
        background: #5b21b6;
        color: #ffffff;
    }

    .cat-filter-tab.special-tab.tab-draft {
        background: #fffbeb;
        color: #92400e;
        border-color: #fde68a;
    }
    .cat-filter-tab.special-tab.tab-draft:hover {
        background: #fef3c7;
    }
    .cat-filter-tab.special-tab.tab-draft.active {
        background: #d97706;
        color: #ffffff;
        border-color: #d97706;
    }
    .cat-filter-tab.special-tab.tab-draft .cat-count-badge {
        background: #fde68a;
        color: #92400e;
    }
    .cat-filter-tab.special-tab.tab-draft.active .cat-count-badge {
        background: #b45309;
        color: #ffffff;
    }

    .cat-filter-tab.special-tab.tab-uncategorized {
        background: #f8fafc;
        color: #475569;
        border-color: #cbd5e1;
    }
    .cat-filter-tab.special-tab.tab-uncategorized:hover {
        background: #f1f5f9;
    }
    .cat-filter-tab.special-tab.tab-uncategorized.active {
        background: #475569;
        color: #ffffff;
        border-color: #475569;
    }

    /* 필터 리셋 버튼 */
    .btn-reset-filter {
        margin-top: 0.5rem;
        background: none;
        border: none;
        color: #4f46e5;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
    }
    .btn-reset-filter:hover {
        color: #3730a3;
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
    .badge.scheduled {
        background: #ede9fe;
        color: #6d28d9;
    }
    .scheduled-date-note {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: #6d28d9;
        white-space: nowrap;
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

    /* Category chip edit button */
    .cat-filter-chip-wrap {
        display: inline-flex;
        align-items: center;
        border-radius: 9999px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        transition: all 0.15s ease;
    }
    .cat-filter-chip-wrap .cat-filter-tab {
        border: none;
        background: transparent;
    }
    .cat-filter-chip-wrap.active {
        background: #3b82f6;
        border-color: #3b82f6;
    }
    .cat-edit-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem 0.5rem 0.25rem 0.15rem;
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        border-radius: 0 9999px 9999px 0;
    }
    .cat-edit-btn:hover {
        color: #1e293b;
    }
    .cat-filter-chip-wrap.active .cat-edit-btn {
        color: rgba(255, 255, 255, 0.85);
    }
    .cat-filter-chip-wrap.active .cat-edit-btn:hover {
        color: #ffffff;
    }

    /* Search & sort toolbar */
    .posts-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }
    .search-box {
        position: relative;
        flex: 1;
        min-width: 220px;
        max-width: 420px;
        display: flex;
        align-items: center;
    }
    .search-box :global(.search-icon) {
        position: absolute;
        left: 0.75rem;
        color: #9ca3af;
        pointer-events: none;
    }
    .search-box input {
        width: 100%;
        padding: 0.5rem 2rem 0.5rem 2.25rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        background: #ffffff;
        color: #111827;
    }
    .search-box input:focus {
        outline: none;
        border-color: #3b82f6;
    }
    .search-clear {
        position: absolute;
        right: 0.5rem;
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        display: inline-flex;
        padding: 0.2rem;
    }
    .sort-box {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.45rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: #ffffff;
        color: #4b5563;
        font-size: 0.875rem;
    }
    .sort-box select {
        border: none;
        background: transparent;
        color: #111827;
        font-weight: 600;
        cursor: pointer;
        outline: none;
    }

    /* Bulk action bar */
    .bulk-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem;
        margin-bottom: 1rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 0.5rem;
        flex-wrap: wrap;
    }
    .bulk-selection-info,
    .bulk-progress-info {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        font-size: 0.875rem;
        color: #1e3a8a;
    }
    .btn-bulk-clear {
        background: transparent;
        border: none;
        color: #2563eb;
        text-decoration: underline;
        cursor: pointer;
        font-size: 0.8125rem;
    }
    .bulk-buttons {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .btn-bulk {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: 0.375rem;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #1e293b;
        cursor: pointer;
    }
    .btn-bulk:hover {
        background: #f1f5f9;
    }
    .btn-bulk-publish {
        border-color: #86efac;
        color: #166534;
        background: #f0fdf4;
    }
    .btn-bulk-publish:hover {
        background: #dcfce7;
    }
    .btn-bulk-delete {
        border-color: #fecaca;
        color: #dc2626;
        background: #fef2f2;
    }
    .btn-bulk-delete:hover {
        background: #fee2e2;
    }

    /* Checkbox column */
    .col-check {
        width: 40px;
        text-align: center;
    }
    .col-check input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }
    tr.row-selected td {
        background: #f8fafc;
    }

    /* Extended modals */
    .modal.modal-wide {
        max-width: 520px;
    }
    .form-field {
        margin-bottom: 1rem;
    }
    .form-field label,
    .field-group-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin-bottom: 0.4rem;
    }
    .form-field input[type="text"],
    .form-field select {
        width: 100%;
        padding: 0.55rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        box-sizing: border-box;
    }
    .field-help {
        display: block;
        margin-top: 0.35rem;
        font-size: 0.75rem;
        color: #6b7280;
    }
    .lang-inputs-grid {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .lang-input-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .lang-tag {
        min-width: 38px;
        text-align: center;
        padding: 0.35rem 0.45rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 700;
        color: #475569;
    }
    .mode-toggle-row {
        display: flex;
        gap: 1.25rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }
    .mode-toggle-row label {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
    }
    .modal-error {
        margin-top: 0.5rem;
        font-size: 0.8125rem;
        color: #dc2626;
        font-weight: 500;
    }
    .btn-primary-modal {
        padding: 0.5rem 1rem;
        border: none;
        background: #2563eb;
        color: white;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
    }
    .btn-primary-modal:hover:not(:disabled) {
        background: #1d4ed8;
    }
    .btn-primary-modal:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
