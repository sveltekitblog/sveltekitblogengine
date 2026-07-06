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
    import { onMount, onDestroy } from "svelte";
    import { t, adminLang } from "$lib/i18n.svelte";
    import {
        Bold,
        Italic,
        Heading,
        Heading2,
        Heading3,
        List,
        ListOrdered,
        Quote,
        Link as LinkIcon,
        Image as ImageIcon,
        Paperclip,
        Eye,
        Columns,
        SquareSplitHorizontal,
        AlertCircle
    } from "lucide-svelte";
    import ImageUploadModal from "$lib/components/editor/ImageUploadModal.svelte";
    import FileUploadModal from "$lib/components/editor/FileUploadModal.svelte";

    // Props matching Svelte 5 bindables
    interface Props {
        rawText?: string;
        title?: string;
        slug?: string;
        category?: string;
        categoryName?: string;
        authorId?: string;
        excerpt?: string;
        tags?: string;
        thumbnailFit?: string;
        placeholder?: string;
        lang?: string;
        onChange?: (text: string) => void;
    }

    let {
        rawText = $bindable(""),
        title = $bindable(""),
        slug = $bindable(""),
        category = $bindable(""),
        categoryName = $bindable(""),
        authorId = $bindable(""),
        excerpt = $bindable(""),
        tags = $bindable(""),
        thumbnailFit = $bindable("cover"),
        placeholder = "",
        lang = "",
        onChange
    }: Props = $props();

    // Editor View Modes
    type ViewMode = "edit" | "split" | "preview";
    let viewMode = $state<ViewMode>("split");

    // Marked parser instance state
    let htmlContent = $state("");
    let parserError = $state<string | null>(null);
    let markedInstance: any = null;

    // Modals
    let showImageModal = $state(false);
    let showFileModal = $state(false);

    // Textarea Reference for Cursor Insertion
    let textareaEl = $state<HTMLTextAreaElement | null>(null);

    // Custom YAML Parser
    function parseFrontMatter(text: string) {
        const result = {
            metadata: {
                title: "",
                slug: "",
                category: "",
                categoryName: "",
                tags: "",
                excerpt: "",
                authorId: "",
                thumbnailFit: "cover"
            },
            body: text,
            error: null as string | null
        };

        const trimmed = text.trim();
        if (!trimmed.startsWith("---")) {
            return result;
        }

        // Split by --- lines
        const parts = text.split(/^---\s*$/m);
        if (parts.length < 3) {
            result.error = t('admin.editor.err_yaml_unclosed', { default: "YAML Front Matter (---)가 열렸으나 닫히지 않았습니다." });
            return result;
        }

        const yamlBlock = parts[1];
        result.body = parts.slice(2).join("---").trim();

        const lines = yamlBlock.split("\n");
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith("#")) continue;

            const colonIndex = trimmedLine.indexOf(":");
            if (colonIndex === -1) continue;

            const key = trimmedLine.substring(0, colonIndex).trim();
            let val = trimmedLine.substring(colonIndex + 1).trim();

            // Strip quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.substring(1, val.length - 1);
            }

            // Handle tags array syntax like [svelte, css]
            if (key === "tags" && val.startsWith("[") && val.endsWith("]")) {
                val = val.substring(1, val.length - 1).split(",").map(t => t.trim()).join(", ");
            }

            if (key in result.metadata) {
                (result.metadata as any)[key] = val;
            }
        }

        return result;
    }

    // Build YAML Front Matter block based on Svelte states
    function buildFrontMatter(): string {
        const cleanTags = tags ? `[${tags.split(",").map(t => t.trim()).filter(Boolean).join(", ")}]` : "[]";
        return `---
title: "${title || ''}"
slug: "${slug || ''}"
category: "${category || ''}"
categoryName: "${categoryName || ''}"
tags: ${cleanTags}
excerpt: "${(excerpt || '').replace(/"/g, '\\"')}"
authorId: "${authorId || ''}"
thumbnailFit: "${thumbnailFit || 'cover'}"
---
`;
    }

    // Initialize rawText if it's empty but properties are populated
    onMount(async () => {
        // Load marked package dynamically
        try {
            const markedModule = await import("marked");
            markedInstance = markedModule.marked;
            
            // Set options for GFM and Line breaks
            markedInstance.setOptions({
                gfm: true,
                breaks: true
            });
        } catch (e) {
            console.error("Failed to load marked parser:", e);
        }
        updatePreview();
    });

    // Sync markdown guide template reactively whenever lang changes and content is empty
    $effect(() => {
        if (!rawText && (lang || adminLang.value)) {
            if (title || slug || category) {
                rawText = buildFrontMatter() + "\n";
            } else {
                rawText = t('admin.editor.markdown_guide');
            }
        }
    });

    // Expose explicit sync function for focusout/blur updates from parent accordion
    export function syncFromSvelteToMarkdown() {
        const parsed = parseFrontMatter(rawText);
        if (!parsed.error) {
            const header = buildFrontMatter();
            const expectedText = header + "\n" + parsed.body;
            if (rawText !== expectedText) {
                rawText = expectedText;
            }
        }
    }

    // Explicit one-way synchronization from editor textarea to Svelte states
    function handleTextareaInput(e: Event) {
        const text = (e.target as HTMLTextAreaElement).value;
        const parsed = parseFrontMatter(text);
        
        parserError = parsed.error;
        if (!parsed.error) {
            // Only update Svelte states if the parsed value is actually different to prevent recursion loops
            if (parsed.metadata.title !== title) title = parsed.metadata.title;
            if (parsed.metadata.slug !== slug) slug = parsed.metadata.slug;
            if (parsed.metadata.category !== category) category = parsed.metadata.category;
            if (parsed.metadata.categoryName !== categoryName) categoryName = parsed.metadata.categoryName;
            if (parsed.metadata.tags !== tags) tags = parsed.metadata.tags;
            if (parsed.metadata.excerpt !== excerpt) excerpt = parsed.metadata.excerpt;
            if (parsed.metadata.authorId !== authorId) authorId = parsed.metadata.authorId;
            if (parsed.metadata.thumbnailFit !== thumbnailFit) thumbnailFit = parsed.metadata.thumbnailFit;
        }
    }

    // Update live HTML preview
    $effect(() => {
        const text = rawText;
        updatePreview();
    });

    function updatePreview() {
        if (!markedInstance) return;
        const parsed = parseFrontMatter(rawText);
        if (parsed.error) {
            htmlContent = `<p style="color: #ef4444; font-weight: bold;">⚠️ YAML 문법 에러: ${parsed.error}</p>`;
        } else {
            htmlContent = markedInstance.parse(parsed.body);
        }
    }

    // Insert text at current cursor location
    function insertAtCursor(before: string, after: string = "") {
        if (!textareaEl) return;

        const start = textareaEl.selectionStart;
        const end = textareaEl.selectionEnd;
        const currentVal = rawText;

        const selectedText = currentVal.substring(start, end);
        const replacement = before + selectedText + after;

        rawText = currentVal.substring(0, start) + replacement + currentVal.substring(end);
        
        // Return focus and restore selection
        setTimeout(() => {
            textareaEl?.focus();
            const newCursor = start + before.length + selectedText.length + after.length;
            textareaEl?.setSelectionRange(newCursor, newCursor);
        }, 50);
    }

    // Toolbar Action Handlers
    function insertBold() { insertAtCursor("**", "**"); }
    function insertItalic() { insertAtCursor("*", "*"); }
    function insertQuote() { insertAtCursor("> ", "\n"); }
    function insertHeading2() { insertAtCursor("## ", "\n"); }
    function insertHeading3() { insertAtCursor("### ", "\n"); }
    function insertBulletList() { insertAtCursor("- ", "\n"); }
    function insertOrderedList() { insertAtCursor("1. ", "\n"); }
    function insertLink() {
        const url = prompt(t('admin.editor.prompt_link_url', { default: "링크 URL을 입력하세요:" }));
        if (url) {
            insertAtCursor("[", `](${url})`);
        }
    }

    // Markdown 및 HTML 이미지 개수 계산 함수 (중복 방지용)
    function calculateImageCount(text: string): number {
        if (!text) return 1;
        const mdImageRegex = /!\[.*?\]\(.*?\)/g;
        const htmlImageRegex = /<img\s+[^>]*src\s*=\s*['"].*?['"][^>]*>/g;

        const mdMatches = text.match(mdImageRegex) || [];
        const htmlMatches = text.match(htmlImageRegex) || [];

        return mdMatches.length + htmlMatches.length + 1;
    }

    let imageCounter = $derived(calculateImageCount(rawText));

    // Image upload handler
    function handleImageInsert(
        imagesData: Array<{ url: string; originalUrl?: string | null; alt?: string }>,
        caption: string,
        alignment: string
    ) {
        let textToInsert = "";
        imagesData.forEach((img) => {
            // Standard markdown image with custom data tags for caption/alignment preserving
            const alignAttr = alignment ? ` data-align="${alignment}"` : '';
            const captionAttr = caption ? ` data-caption="${caption}"` : '';
            const origAttr = img.originalUrl ? ` data-original="${img.originalUrl}"` : '';

            // If caption or alignment is customized, we generate an HTML block to preserve Tiptap compatibility
            if (caption || alignment !== "center" || img.originalUrl) {
                textToInsert += `<img src="${img.url}" alt="${img.alt || ''}"${origAttr}${alignAttr}${captionAttr} />\n`;
            } else {
                // Otherwise, output pure clean Markdown image
                textToInsert += `![${img.alt || ''}](${img.url})\n`;
            }
        });
        insertAtCursor(textToInsert);
    }

    // File attachment handler
    function handleFileInsert(fileData: { url: string; name: string; size: number }) {
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(fileData.size) / Math.log(1024));
        const formattedSize = parseFloat((fileData.size / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];

        // Standard HTML attachment card matching Tiptap attachment rendering
        const fileHtml = `\n<a href="${fileData.url}" download="${fileData.name}" target="_blank" rel="noopener" class="file-attachment-card" data-file-size="${formattedSize}">
    <span class="file-icon">📎</span>
    <span class="file-details">
        <span class="file-name">${fileData.name}</span>
        <span class="file-size">${formattedSize}</span>
    </span>
    <span class="download-badge">Download</span>
</a>\n`;
        insertAtCursor(fileHtml);
    }
</script>

<div class="markdown-editor-wrapper">
    <!-- Toolbar -->
    <div class="editor-toolbar sticky-toolbar">
        <div class="toolbar-group">
            <button type="button" onclick={insertBold} title={t('admin.editor.tooltip_bold')}>
                <Bold size={16} />
            </button>
            <button type="button" onclick={insertItalic} title={t('admin.editor.tooltip_italic')}>
                <Italic size={16} />
            </button>
            <button type="button" onclick={insertHeading2} title={t('admin.editor.tooltip_heading') + " 2"}>
                <Heading2 size={16} />
            </button>
            <button type="button" onclick={insertHeading3} title={t('admin.editor.tooltip_heading') + " 3"}>
                <Heading3 size={16} />
            </button>
        </div>

        <div class="toolbar-group">
            <button type="button" onclick={insertBulletList} title={t('admin.editor.tooltip_bullet_list')}>
                <List size={16} />
            </button>
            <button type="button" onclick={insertOrderedList} title={t('admin.editor.tooltip_ordered_list')}>
                <ListOrdered size={16} />
            </button>
            <button type="button" onclick={insertQuote} title={t('admin.editor.tooltip_quote')}>
                <Quote size={16} />
            </button>
        </div>

        <div class="toolbar-group">
            <button type="button" onclick={insertLink} title={t('admin.editor.tooltip_text_link')}>
                <LinkIcon size={16} />
            </button>
            <button type="button" onclick={() => showImageModal = true} title={t('admin.editor.tooltip_image_upload')}>
                <ImageIcon size={16} />
            </button>
            <button type="button" onclick={() => showFileModal = true} title={t('admin.editor.tooltip_file_upload')}>
                <Paperclip size={16} />
            </button>
        </div>

        <div class="flex-grow"></div>

        <!-- View Toggle Buttons -->
        <div class="toolbar-group view-toggles">
            <button
                type="button"
                class:active={viewMode === "edit"}
                onclick={() => viewMode = "edit"}
                title={t('admin.editor.tooltip_edit_mode', { default: '편집 모드' })}
            >
                <Columns size={16} />
                <span>{t('admin.editor.view_write', { default: 'Write' })}</span>
            </button>
            <button
                type="button"
                class:active={viewMode === "split"}
                onclick={() => viewMode = "split"}
                title={t('admin.editor.tooltip_split_mode', { default: '분할 미리보기' })}
            >
                <SquareSplitHorizontal size={16} />
                <span>{t('admin.editor.view_split', { default: 'Split' })}</span>
            </button>
            <button
                type="button"
                class:active={viewMode === "preview"}
                onclick={() => viewMode = "preview"}
                title={t('admin.editor.tooltip_preview_mode', { default: '전체 미리보기' })}
            >
                <Eye size={16} />
                <span>{t('admin.editor.view_preview', { default: 'Preview' })}</span>
            </button>
        </div>
    </div>

    <!-- YAML 문법 에러 알림 배너 -->
    {#if parserError}
        <div class="error-banner">
            <AlertCircle size={18} class="text-red-500 shrink-0" />
            <span class="text-sm font-semibold">{parserError}</span>
        </div>
    {/if}

    <!-- Content Workspace -->
    <div class="editor-workspace {viewMode}">
        <!-- Editor Input Panel -->
        {#if viewMode === "edit" || viewMode === "split"}
            <div class="textarea-panel">
                <textarea
                    bind:this={textareaEl}
                    bind:value={rawText}
                    oninput={handleTextareaInput}
                    placeholder={placeholder || t('admin.editor.label_body', { default: '글 내용을 마크다운으로 작성하세요...' })}
                    class="markdown-textarea"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                ></textarea>
            </div>
        {/if}

        <!-- HTML Preview Panel -->
        {#if viewMode === "split" || viewMode === "preview"}
            <div class="preview-panel prose max-w-none p-6">
                <!-- Render compiled HTML safely -->
                {@html htmlContent}
            </div>
        {/if}
    </div>
</div>

<!-- Modal Overlays -->
<ImageUploadModal
    bind:isOpen={showImageModal}
    category={category || 'general'}
    slug={slug || 'new-post'}
    {lang}
    imageCounter={imageCounter}
    onClose={() => (showImageModal = false)}
    onInsert={handleImageInsert}
/>

<FileUploadModal
    bind:isOpen={showFileModal}
    slug={slug || 'new-post'}
    onClose={() => (showFileModal = false)}
    onInsert={handleFileInsert}
/>

<style>
    .markdown-editor-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0 0 0.5rem 0.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        overflow: hidden;
    }

    .editor-toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        flex-wrap: wrap;
    }

    .toolbar-group {
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.125rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }

    .toolbar-group button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.375rem;
        border: none;
        background: none;
        color: #4b5563;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .toolbar-group button:hover {
        background: #f3f4f6;
        color: #111827;
    }

    .flex-grow {
        flex-grow: 1;
    }

    .view-toggles button {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .view-toggles button.active {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
    }

    .error-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #fef2f2;
        border-bottom: 1px solid #fca5a5;
        padding: 0.75rem 1rem;
        color: #b91c1c;
    }

    .editor-workspace {
        display: grid;
        min-height: 500px;
        background: #ffffff;
    }

    .editor-workspace.edit {
        grid-template-columns: 1fr;
    }

    .editor-workspace.split {
        grid-template-columns: 1fr 1fr;
        border-bottom: none;
    }

    .editor-workspace.split .textarea-panel {
        border-right: 1px solid #e5e7eb;
    }

    .editor-workspace.preview {
        grid-template-columns: 1fr;
    }

    .textarea-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
    }

    .markdown-textarea {
        width: 100%;
        height: 100%;
        min-height: 500px;
        padding: 1.25rem;
        border: none;
        outline: none;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #1f2937;
        background: #fafafa;
    }

    .preview-panel {
        height: 100%;
        min-height: 500px;
        overflow-y: auto;
        background: #ffffff;
    }

    /* Preserve global Svelte CSS layout issues */
    :global(.preview-panel img) {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 1.5rem auto;
        display: block;
    }

    :global(.preview-panel figure) {
        margin: 1.5rem auto;
        text-align: center;
    }

    :global(.preview-panel figcaption) {
        font-size: 0.8rem;
        color: #6b7280;
        margin-top: 0.5rem;
    }
</style>
