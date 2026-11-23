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
    interface Props {
        title: string;
        slug: string;
        category: string;
        categoryName: string;
        authorId: string;
        excerpt: string;
        tags: string;
        type?: string;
        thumbnailFit?: string;
        submitToBoard?: boolean;
        hubCategory?: string;
        status?: string;
        charCount?: number;
        autoSyndicateDefault?: boolean;
        categories?: Array<{slug: string, name: string, lang?: string}>;
        lang?: string;
        defaultLang?: string;
        oncategorysync?: (newCategorySlug: string) => void;
        onslugsync?: (newSlug: string) => void;
    }

    let {
        title = $bindable(),
        slug = $bindable(),
        category = $bindable(),
        categoryName = $bindable(),
        authorId = $bindable(),
        excerpt = $bindable(),
        tags = $bindable(),
        type = 'post',
        thumbnailFit = $bindable("cover"),
        submitToBoard = $bindable(false),
        hubCategory = $bindable(""),
        status = 'draft',
        charCount = 0,
        autoSyndicateDefault = false,
        categories = [],
        lang = 'ko',
        defaultLang = 'ko',
        oncategorysync,
        onslugsync
    }: Props = $props();

    function autoGenerateSlug() {
        if (!title || slug) return;
        let base = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s가-힣-]/g, "") // Keep alphanumeric, space, Korean, and hyphen
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Collapse multiple hyphens
            .replace(/^-+|-+$/g, ""); // Trim hyphens from start/end
        slug = base;
        if (onslugsync) onslugsync(slug);
    }

    let filteredCategories = $derived(categories.filter(c => !c.lang || c.lang === lang));

    import { t, adminLang } from "$lib/i18n.svelte";
    import { HUB_CATEGORIES, HUB_MIN_CONTENT_LENGTH } from "@blog/shared";

    let isScheduled = $derived(status === 'scheduled');
    let canSubmitToHub = $derived(!isScheduled && charCount >= HUB_MIN_CONTENT_LENGTH);
    let userManuallyToggled = $state(false);
    let autoCheckedApplied = $state(false);

    $effect(() => {
        if (!canSubmitToHub) {
            if (submitToBoard) {
                submitToBoard = false;
            }
            autoCheckedApplied = false;
        } else if (autoSyndicateDefault && !userManuallyToggled && !autoCheckedApplied) {
            submitToBoard = true;
            autoCheckedApplied = true;
        }
    });

    let selectedHubCategoryInfo = $derived(HUB_CATEGORIES.find((c) => c.slug === hubCategory));
</script>

<div class="form-section">
    <div class="form-group">
        <label for="title">{t('admin.posts.form.title', { default: '제목 *' })}</label>
        <input
            type="text"
            id="title"
            name="title"
            bind:value={title}
            onblur={autoGenerateSlug}
            required
            placeholder={t('admin.posts.form.title_placeholder', { default: '글 제목을 입력하세요' })}
        />
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="slug">{t('admin.posts.form.slug', { default: '슬러그 *' })}</label>
            <input
                type="text"
                id="slug"
                name="slug"
                bind:value={slug}
                oninput={(e) => { if (onslugsync) onslugsync(e.currentTarget.value) }}
                required
                placeholder={t('admin.posts.form.slug_placeholder', { default: 'url-friendly-slug' })}
            />
            <small class="help-text">{t('admin.posts.form.slug_help', { default: '가급적 영문과 하이픈(-) 사용을 권장합니다.' })}</small>
        </div>
        <div class="form-group">
            <label for="category">{type === 'page' ? t('admin.posts.form.category_slug_page', { default: '카테고리 슬러그 (정적 페이지 제외)' }) : t('admin.posts.form.category_slug', { default: '카테고리 슬러그 *' })}</label>
            <input
                type="text"
                id="category"
                name="category"
                list="category-slugs-list"
                value={category}
                oninput={(e) => {
                    category = e.currentTarget.value;
                    const founds = categories.filter(c => c.slug === category);
                    const match = founds.find(c => c.lang === lang) || founds[0];
                    if (match) {
                        categoryName = match.name;
                    }
                    if (oncategorysync) oncategorysync(category);
                }}
                required={type !== 'page'}
                placeholder={type === 'page' ? t('admin.posts.form.category_placeholder_page', { default: '정적 페이지는 카테고리가 필요 없습니다' }) : t('admin.posts.form.category_placeholder', { default: 'tech, life, etc.' })}
                autocomplete="off"
            />
            <datalist id="category-slugs-list">
                {#each filteredCategories as cat}
                    <option value={cat.slug}>{cat.name}</option>
                {/each}
            </datalist>
            <small class="help-text" style="color: #3b82f6;">{t('admin.posts.form.category_help', { default: '💡 입력창을 더블 클릭하면 기존에 등록된 카테고리 목록이 나타납니다.' })}</small>
        </div>
        <div class="form-group">
            <label for="category_name">{t('admin.posts.form.category_name', { default: '카테고리 표시명' })}</label>
            <input
                type="text"
                id="category_name"
                name="category_name"
                bind:value={categoryName}
                list="category-names-list"
                placeholder={t('admin.posts.form.category_name_placeholder', { default: '기술, 일상, 등' })}
                autocomplete="off"
            />
            <datalist id="category-names-list">
                {#each filteredCategories as cat}
                    <option value={cat.name}>{cat.name}</option>
                {/each}
            </datalist>
            <small class="help-text" style="color: #3b82f6;">{t('admin.posts.form.category_name_help', { default: '💡 입력창을 더블 클릭하면 기존에 등록된 표시명 목록이 나타납니다.' })}</small>
        </div>
        <div class="form-group">
            <label for="author_id">{t('admin.posts.form.author', { default: '작성자' })}</label>
            <input
                type="text"
                id="author_id"
                name="author_id"
                bind:value={authorId}
                placeholder={t('admin.posts.form.author_placeholder', { default: '작성자 이름' })}
            />
        </div>
    </div>

    <div class="form-group">
        <label for="excerpt">{t('admin.posts.form.excerpt', { default: '요약' })}</label>
        <textarea
            id="excerpt"
            name="excerpt"
            bind:value={excerpt}
            rows="2"
            placeholder={t('admin.posts.form.excerpt_placeholder', { default: '글 요약을 입력하세요 (선택사항)' })}
        ></textarea>
    </div>

    <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 0;">
        <div class="form-group" style="margin-bottom: 0;">
            <label for="tags">{t('admin.posts.form.tags', { default: '태그 (쉼표로 구분)' })}</label>
            <input
                type="text"
                id="tags"
                name="tags"
                bind:value={tags}
                placeholder={t('admin.posts.form.tags_placeholder', { default: '예: Svelte, Web, 개발' })}
            />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label for="thumbnail_fit">{t('admin.posts.form.thumbnail_fit', { default: '썸네일 노출 방식' })}</label>
            <select
                id="thumbnail_fit"
                name="thumbnail_fit"
                bind:value={thumbnailFit}
                style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; background-color: white;"
            >
                <option value="cover">{t('admin.posts.form.thumbnail_fit_cover', { default: 'Cover (기본 채우기)' })}</option>
                <option value="contain">{t('admin.posts.form.thumbnail_fit_contain', { default: 'Contain (원본비율 보존)' })}</option>
            </select>
        </div>
    </div>

    <div class="form-group" style="margin-top: 1.25rem; margin-bottom: 0; padding: 0.85rem 1rem; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem;">
            <label
                class="flex items-center gap-2 select-none"
                style="margin-bottom: 0; font-weight: 600; color: {canSubmitToHub ? '#1e293b' : '#94a3b8'}; display: flex; align-items: center; cursor: {canSubmitToHub ? 'pointer' : 'not-allowed'};"
            >
                <input
                    type="checkbox"
                    bind:checked={submitToBoard}
                    disabled={!canSubmitToHub}
                    onchange={() => { userManuallyToggled = true; }}
                    style="width: 1.1rem; height: 1.1rem; cursor: {canSubmitToHub ? 'pointer' : 'not-allowed'}; accent-color: #3b82f6;"
                />
                <span>🌐 {t('admin.posts.form.submit_to_hub', { default: '스벨트킷블로그 허브(hub.sveltekitblog.com)에 자동 제출' })}</span>
            </label>
            <span
                style="font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.55rem; border-radius: 9999px; background-color: {canSubmitToHub ? '#dcfce7' : '#fef3c7'}; color: {canSubmitToHub ? '#166534' : '#92400e'};"
            >
                {#if isScheduled}
                    🕒 {t('admin.posts.form.hub_disabled_scheduled', { default: '예약 공개 글은 허브 자동 제출 불가 (공개 후 수정 화면에서 제출)' })}
                {:else if canSubmitToHub}
                    ✅ {t('admin.posts.form.hub_min_length_met', { current: charCount, default: `허브 제출 가능 (${charCount}자)` })}
                {:else}
                    ⚠️ {t('admin.posts.form.hub_min_length_unmet', { current: charCount, default: `본문 700자 이상 작성 시 활성화됩니다 (현재 ${charCount}자 / 최소 700자)` })}
                {/if}
            </span>
        </div>

        {#if submitToBoard && canSubmitToHub}
            <div style="margin-top: 0.75rem; padding-left: 1.6rem;">
                <label for="hub_category" style="font-size: 0.85rem; margin-bottom: 0.35rem; color: #334155;">
                    {t('admin.posts.form.hub_category_label', { default: '허브 공식 카테고리 선택 *' })}
                </label>
                <select
                    id="hub_category"
                    name="hub_category"
                    bind:value={hubCategory}
                    style="width: 100%; max-width: 420px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; background-color: white; color: #1e293b;"
                >
                    <option value="">{t('admin.posts.form.hub_category_placeholder', { default: '-- 허브 8대 공식 카테고리를 선택하세요 --' })}</option>
                    {#each HUB_CATEGORIES as hc}
                        {@const label = (hc.labels as Record<string, string>)[adminLang.value] || hc.labels.ko}
                        <option value={hc.slug}>{label} ({hc.slug})</option>
                    {/each}
                </select>
                {#if selectedHubCategoryInfo}
                    {@const hint = (selectedHubCategoryInfo.hint as Record<string, string>)[adminLang.value] || selectedHubCategoryInfo.hint.ko}
                    <small class="help-text" style="color: #2563eb; margin-top: 0.3rem;">📌 {hint}</small>
                {/if}
            </div>
        {/if}

        <small class="help-text" style="margin-top: 0.4rem; color: #64748b; padding-left: 1.6rem; display: block; line-height: 1.45;">
            {t('admin.posts.form.submit_to_hub_help', { default: '체크 시 글이 발행될 때 허브 피드로 요약 카드가 자동 전송됩니다. 체크를 해제하면 허브 피드에서 "숨김" 처리되어 추천(좋아요) 통계가 안전하게 보존되며, 허브에서 완전히 삭제하려면 블로그에서 포스트를 삭제해야 합니다.' })}
        </small>
        <small class="help-text" style="margin-top: 0.25rem; color: #64748b; padding-left: 1.6rem; display: block; line-height: 1.45;">
            {t('admin.posts.form.hub_policy_notice', { default: '💡 신규 공개 글은 5분에 1개씩 허브에 등록 가능하며, 이미 추천을 받은 글의 제목을 완전히 다른 내용으로 변경하면 추천수가 초기화됩니다.' })}
        </small>
    </div>
</div>

<style>
    .form-section {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        margin-bottom: 2rem;
    }
    .form-group {
        margin-bottom: 1.5rem;
    }
    .form-group:last-child {
        margin-bottom: 0;
    }
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
    }
    label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #374151;
    }
    input[type="text"],
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s;
    }
    input:focus,
    textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    @media (max-width: 768px) {
        .form-row {
            grid-template-columns: 1fr;
            gap: 1rem;
        }
    }

    .help-text {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: #6b7280;
    }
</style>
