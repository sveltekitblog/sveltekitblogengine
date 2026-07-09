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
    import PostMetadataForm from "$lib/components/editor/PostMetadataForm.svelte";
    import TiptapEditor from "$lib/components/editor/TiptapEditor.svelte";
    import MarkdownEditor from "$lib/components/editor/MarkdownEditor.svelte";
    import type { SubmitFunction } from "./$types";
    import { t } from "$lib/i18n.svelte";
    import { processContentHtml } from "$lib/utils/contentProcessor";

    let { data } = $props();

    type EditorMode = "visual" | "html" | "preview";
    let mode = $state<EditorMode>("visual");
    let saveOriginal = $state(false);

    let activeLang = $state("");
    let translationsData = $state<Record<string, any>>({});
    let groupDataJson = $state("[]");
    let defaultLang = $derived(data.languages?.find((l: any) => l.is_default)?.code || data.languages?.[0]?.code || 'ko');

    // 실시간 모드별 글자 수 계산 유도 상태 ($derived)
    let charCount = $derived(() => {
        const rawContent = translationsData[activeLang]?.content || "";
        if (mode === "markdown") {
            const cleanMarkdown = rawContent
                .replace(/[#*`_~-]/g, "") // 마크다운 서식 제거
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 링크 [텍스트](url) -> 텍스트
                .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // 이미지 ![설명](url) -> 제거
                .trim();
            return cleanMarkdown.length;
        }
        const cleanHtml = rawContent
            .replace(/<[^>]*>/g, "") // HTML 태그 제거
            .replace(/&nbsp;/g, " ") // 공백 기호 복원
            .trim();
        return cleanHtml.length;
    });

    // Initialize blank data for each language
    $effect(() => {
        if (data.languages && Object.keys(translationsData).length === 0) {
            data.languages.forEach((lang: any) => {
                translationsData[lang.code] = {
                    id: 'new-' + lang.code,
                    translation_group_id: data.groupId,
                    lang: lang.code,
                    title: "",
                    slug: "",
                    excerpt: "",
                    category: "",
                    categoryName: "",
                    status: "draft",
                    type: "post",
                    authorId: "",
                    content: "",
                    tags: "",
                    contentType: "html",
                    contentMarkdown: "",
                    thumbnailFit: "cover"
                };
            });
            activeLang = data.languages.find((l: any) => l.is_default)?.code || data.languages[0]?.code || 'ko';
        }
    });

    // Sync groupDataJson for submission whenever translationsData changes
    $effect(() => {
        groupDataJson = JSON.stringify(Object.values(translationsData));
    });

    // Auto-fill slug when switching to an empty translation tab
    $effect(() => {
        if (activeLang && translationsData[activeLang]) {
            const curr = translationsData[activeLang];
            if (!curr.slug && curr.id?.startsWith('new-') && activeLang !== defaultLang) {
                const baseData = translationsData[defaultLang];
                if (baseData?.slug) {
                    curr.slug = baseData.slug;
                }
            }
        }
    });

    function setMode(newMode: EditorMode) {
        mode = newMode;
    }

    let markdownEditorRef = $state<any>(null);

    function handleAccordionFocusOut() {
        setTimeout(() => {
            if (markdownEditorRef?.syncFromSvelteToMarkdown) {
                markdownEditorRef.syncFromSvelteToMarkdown();
            }
        }, 0);
    }

    const submitPost: SubmitFunction = ({ formData, cancel }) => {
        // Force-sync YAML front matter before submission for absolute DB integrity
        Object.keys(translationsData).forEach(lang => {
            const item = translationsData[lang];
            if (item.contentType === 'markdown' && item.contentMarkdown) {
                const parts = item.contentMarkdown.split(/^---\s*$/m);
                const body = parts.length >= 3 ? parts.slice(2).join("---").trim() : item.contentMarkdown.trim();
                const cleanTags = item.tags ? `[${item.tags.split(",").map((t: string) => t.trim()).filter(Boolean).join(", ")}]` : "[]";
                const header = `---
title: "${item.title || ''}"
slug: "${item.slug || ''}"
category: "${item.category || ''}"
categoryName: "${item.categoryName || ''}"
tags: ${cleanTags}
excerpt: "${(item.excerpt || '').replace(/"/g, '\\"')}"
authorId: "${item.authorId || ''}"
thumbnailFit: "${item.thumbnailFit || 'cover'}"
---`;
                item.contentMarkdown = header + "\n" + body;
            }
        });

        // Sync groupDataJson string before setting
        groupDataJson = JSON.stringify(Object.values(translationsData));

        // Multi-language custom validation
        const items = Object.values(translationsData);
        for (const item of items) {
            const hasStartedWriting = item.title?.trim() || item.contentMarkdown?.trim() || item.content?.trim();
            if (hasStartedWriting) {
                const displayLang = item.lang.toUpperCase();
                if (!item.title?.trim()) {
                    alert(`[${displayLang}] ${t('admin.editor.validate_title', { default: '제목을 입력해 주세요.' })}`);
                    cancel();
                    return;
                }
                if (!item.slug?.trim()) {
                    alert(`[${displayLang}] ${t('admin.editor.validate_slug', { default: '슬러그를 입력해 주세요.' })}`);
                    cancel();
                    return;
                }
                if (!item.category?.trim()) {
                    alert(`[${displayLang}] ${t('admin.editor.validate_category', { default: '카테고리를 입력해 주세요.' })}`);
                    cancel();
                    return;
                }
            }
        }

        formData.set("groupData", groupDataJson);
        return async ({ result, update }) => {
            if (result.type === 'failure') {
                const errData = result.data as any;
                alert(`저장 실패: ${errData?.error || '알 수 없는 오류가 발생했습니다.'}`);
            } else if (result.type === 'error') {
                alert(`시스템 오류: 서버와의 통신에 실패했습니다.`);
            }
            await update();
        };
    };
</script>

<div class="write-container">
    <div class="header">
        <h1>{t('admin.posts.write.new_title', { default: '새 글 쓰기 (다국어 묶음)' })}</h1>
        <a href="/posts" class="btn-secondary">{t('admin.posts.write.back', { default: '← 목록으로' })}</a>
    </div>

    <!-- Language Tabs -->
    <div class="lang-tabs pb-4 border-b border-gray-200 mb-6">
        <span class="text-sm text-gray-500 font-semibold mr-4">{t('admin.posts.write.edit_lang', { default: '편집 언어:' })}</span>
        <div class="flex gap-2">
            {#each data.languages || [] as lang}
                <button
                    type="button"
                    class="lang-tab-btn {activeLang === lang.code ? 'active' : ''}"
                    onclick={() => activeLang = lang.code}
                >
                    <span class="uppercase font-bold text-xs bg-gray-100 rounded px-1.5 py-0.5 mr-1">{lang.code}</span>
                    {lang.name}
                    {#if translationsData[lang.code]?.id?.startsWith('new-') && !translationsData[lang.code]?.title}
                        <span class="text-xs text-gray-400 ml-1">{t('admin.posts.write.unwritten', { default: '(미작성)' })}</span>
                    {/if}
                </button>
            {/each}
        </div>
    </div>

    {#if activeLang && translationsData[activeLang]}
    <form method="POST" use:enhance={submitPost} novalidate>
        <input type="hidden" name="groupData" value={groupDataJson} />

        <!-- Editor Type Selector -->
        <div class="editor-type-selector bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div class="info">
                <span class="font-bold text-gray-800 block">{t('admin.editor.type_title', { default: '문서 에디터 유형 선택' })}</span>
                <span class="text-xs text-gray-500">{t('admin.editor.type_desc', { default: '작성하시는 문서의 포맷을 선택하세요. 마크다운은 YAML Front Matter 헤더 작성을 지원합니다.' })}</span>
            </div>
            <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                        type="radio"
                        name="editor_type_{activeLang}"
                        value="html"
                        bind:group={translationsData[activeLang].contentType}
                    />
                    <span>{t('admin.editor.type_html', { default: '비주얼 HTML 에디터' })}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                    <input
                        type="radio"
                        name="editor_type_{activeLang}"
                        value="markdown"
                        bind:group={translationsData[activeLang].contentType}
                    />
                    <span>{t('admin.editor.type_markdown', { default: '마크다운 에디터' })}</span>
                </label>
            </div>
        </div>

        {#if translationsData[activeLang].contentType !== 'markdown'}
            <PostMetadataForm
                bind:title={translationsData[activeLang].title}
                bind:slug={translationsData[activeLang].slug}
                bind:category={translationsData[activeLang].category}
                bind:categoryName={translationsData[activeLang].categoryName}
                bind:authorId={translationsData[activeLang].authorId}
                bind:excerpt={translationsData[activeLang].excerpt}
                bind:tags={translationsData[activeLang].tags}
                bind:thumbnailFit={translationsData[activeLang].thumbnailFit}
                categories={data.categories}
                lang={activeLang}
                {defaultLang}
                oncategorysync={(newCat) => {
                    Object.keys(translationsData).forEach(lang => {
                        if (lang !== activeLang) {
                            translationsData[lang].category = newCat;
                            const match = data.categories.find((c: any) => c.slug === newCat && c.lang === lang);
                            if (match) {
                                translationsData[lang].categoryName = match.name;
                            }
                        }
                    });
                }}
                onslugsync={(newSlug) => {
                    Object.keys(translationsData).forEach(lang => {
                        if (lang !== activeLang) {
                            translationsData[lang].slug = newSlug;
                        }
                    });
                }}
            />
        {:else}
            <!-- Collapsible Metadata Accordion for Markdown Editor -->
            <div class="metadata-accordion mb-6" onfocusout={handleAccordionFocusOut}>
                <details class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <summary class="bg-gray-50 p-4 font-bold text-gray-700 cursor-pointer select-none hover:bg-gray-100 flex justify-between items-center">
                        <span>⚙️ {t('admin.editor.meta_accordion', { default: '마크다운 헤더 메타데이터 보기 (YAML로 싱크됨)' })}</span>
                        <span class="text-xs text-blue-500 font-normal">{t('admin.editor.meta_accordion_hint', { default: '클릭하여 세부 정보 확인' })}</span>
                    </summary>
                    <div class="p-4 border-t border-gray-100 bg-gray-50/50">
                        <PostMetadataForm
                            bind:title={translationsData[activeLang].title}
                            bind:slug={translationsData[activeLang].slug}
                            bind:category={translationsData[activeLang].category}
                            bind:categoryName={translationsData[activeLang].categoryName}
                            bind:authorId={translationsData[activeLang].authorId}
                            bind:excerpt={translationsData[activeLang].excerpt}
                            bind:tags={translationsData[activeLang].tags}
                            bind:thumbnailFit={translationsData[activeLang].thumbnailFit}
                            categories={data.categories}
                            lang={activeLang}
                            {defaultLang}
                            oncategorysync={(newCat) => {
                                Object.keys(translationsData).forEach(lang => {
                                    if (lang !== activeLang) {
                                        translationsData[lang].category = newCat;
                                        const match = data.categories.find((c: any) => c.slug === newCat && c.lang === lang);
                                        if (match) {
                                            translationsData[lang].categoryName = match.name;
                                        }
                                    }
                                });
                            }}
                            onslugsync={(newSlug) => {
                                Object.keys(translationsData).forEach(lang => {
                                    if (lang !== activeLang) {
                                        translationsData[lang].slug = newSlug;
                                    }
                                });
                            }}
                        />
                    </div>
                </details>
            </div>
        {/if}

        <div class="editor-container">
            {#if translationsData[activeLang].contentType === "markdown"}
                <MarkdownEditor
                    bind:this={markdownEditorRef}
                    lang={activeLang}
                    bind:rawText={translationsData[activeLang].contentMarkdown}
                    bind:title={translationsData[activeLang].title}
                    bind:slug={translationsData[activeLang].slug}
                    bind:category={translationsData[activeLang].category}
                    bind:categoryName={translationsData[activeLang].categoryName}
                    bind:authorId={translationsData[activeLang].authorId}
                    bind:excerpt={translationsData[activeLang].excerpt}
                    bind:tags={translationsData[activeLang].tags}
                    bind:thumbnailFit={translationsData[activeLang].thumbnailFit}
                />
            {:else}
                <div class="mode-tabs">
                    <button
                        type="button"
                        class:active={mode === "visual"}
                        onclick={() => setMode("visual")}>{t('admin.posts.write.visual', { default: 'Visual' })}</button>
                    <button
                        type="button"
                        class:active={mode === "html"}
                        onclick={() => setMode("html")}>{t('admin.posts.write.html', { default: 'HTML' })}</button>
                    <button
                        type="button"
                        class:active={mode === "preview"}
                        onclick={() => setMode("preview")}>{t('admin.posts.write.preview', { default: 'Preview' })}</button>
                </div>

                {#if mode === "visual"}
                    <TiptapEditor
                        bind:content={translationsData[activeLang].content}
                        bind:category={translationsData[activeLang].category}
                        bind:slug={translationsData[activeLang].slug}
                        lang={activeLang}
                        bind:saveOriginal={saveOriginal}
                    />
                {/if}

                {#if mode === "html"}
                    <textarea
                        class="html-editor"
                        bind:value={translationsData[activeLang].content}
                        placeholder={t('admin.posts.write.html_placeholder', { default: 'HTML 코드를 직접 입력하세요...' })}
                    ></textarea>
                {/if}

                {#if mode === "preview"}
                    <div class="preview-mode prose max-w-none p-4 board">
                        {@html processContentHtml(translationsData[activeLang].content)}
                    </div>
                {/if}
            {/if}
            <!-- 실시간 글자수 카운터 UI 추가 (다국어화 적용) -->
            <div class="char-counter">
                ({t('admin.editor.char_count')}: {charCount()})
            </div>
        </div>

        <div class="form-actions">
            <div class="status-selector">
                <label>
                    <input
                        type="radio"
                        name="status"
                        value="draft"
                        bind:group={translationsData[activeLang].status}
                    />
                    <span>{t('admin.posts.write.save_draft', { default: '초안으로 저장 (이 언어만)' })}</span>
                </label>
                <label>
                    <input
                        type="radio"
                        name="status"
                        value="published"
                        bind:group={translationsData[activeLang].status}
                    />
                    <span>{t('admin.posts.write.publish', { default: '발행 (이 언어만)' })}</span>
                </label>
            </div>
            
            <div class="type-selector ml-4 pl-4 border-l border-gray-300">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="post" bind:group={translationsData[activeLang].type} />
                    <span>{t("admin.posts.type_post", { default: "일반 글(Post)" })}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="page" bind:group={translationsData[activeLang].type} />
                    <span>{t("admin.posts.type_page", { default: "정적 페이지(Page)" })}</span>
                </label>
            </div>
            
            <div class="flex-1"></div>

            <button type="submit" class="btn-primary">
                {t('admin.posts.write.submit', { default: '모든 탭 동시 저장하기' })}
            </button>
        </div>
    </form>
    {/if}
</div>

<style>
    /* Identical to edit page styles */
    .write-container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .btn-secondary { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: white; color: #374151; text-decoration: none; border-radius: 0.375rem; font-weight: 500; border: 1px solid #e5e7eb; }
    .btn-secondary:hover { background: #f9fafb; }
    .lang-tabs { display: flex; align-items: center; }
    .flex { display: flex; } .gap-2 { gap: 0.5rem; }
    .lang-tab-btn { padding: 0.6rem 1.2rem; border: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; border-radius: 0.375rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; }
    .lang-tab-btn:hover { background: #f3f4f6; color: #1f2937; }
    .lang-tab-btn.active { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .mode-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    .mode-tabs button { padding: 0.5rem 1rem; background: #f3f4f6; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 0.5rem 0.5rem 0 0; cursor: pointer; font-weight: 500; color: #4b5563; }
    .mode-tabs button.active { background: white; border-color: #e5e7eb; border-bottom: 1px solid white; color: #111827; margin-bottom: -1px; z-index: 1; }
    .editor-container { background: white; border: 1px solid #e5e7eb; border-radius: 0 0 0.5rem 0.5rem; min-height: 400px; }
    .html-editor { width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; font-family: monospace; min-height: 400px; resize: vertical; border-radius: 0 0 0.5rem 0.5rem; border-top: none; }
    .preview-mode { min-height: 400px; padding: 1rem; background: white; border-radius: 0 0 0.5rem 0.5rem; }
    .board { background-color: #fff; }
    :global(.preview-mode img) { max-width: 100%; height: auto; }
    :global(.preview-mode figure) { margin: 1.5rem 0; display: flex; flex-direction: column; align-items: center; }
    :global(.preview-mode figure[data-align="left"]) { align-items: flex-start; }
    :global(.preview-mode figure[data-align="right"]) { align-items: flex-end; }
    :global(.preview-mode figcaption) { margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280; text-align: center; }
    .char-counter { text-align: right; padding: 0.5rem 1rem; font-size: 0.875rem; color: #6b7280; background: #fafafa; border-top: 1px solid #e5e7eb; border-radius: 0 0 0.5rem 0.5rem; }
    .form-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .status-selector { display: flex; gap: 1.5rem; }
    .status-selector label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0; }
    .btn-primary { padding: 0.75rem 2rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    .btn-primary:hover { background: #059669; }
</style>
