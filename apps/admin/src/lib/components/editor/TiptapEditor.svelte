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
    import { t } from "$lib/i18n.svelte";
    import {
        Bold,
        Italic,
        Strikethrough,
        Code,
        Heading,
        AlignLeft,
        AlignCenter,
        AlignRight,
        AlignJustify,
        List,
        ListOrdered,
        FileCode,
        Link as LinkIcon,
        Image as ImageIcon,
        Youtube as YoutubeIcon,
        Minus,
        Quote,
        Type,
        Highlighter,
        CaseSensitive,
        ChevronDown,
        Upload as UploadIcon,
        Paperclip,
    } from "lucide-svelte";
    import ImageUploadModal from "$lib/components/editor/ImageUploadModal.svelte";
    import ImageEditModal from "$lib/components/editor/ImageEditModal.svelte";
    import FileUploadModal from "$lib/components/editor/FileUploadModal.svelte";

    // Props
    interface Props {
        content?: string;
        category?: string;
        slug?: string;
        lang: string;
        saveOriginal?: boolean;
        placeholder?: string;
    }

    let {
        content = $bindable(""),
        category = $bindable("uncategorized"),
        slug = $bindable("new-post"),
        lang,
        saveOriginal = $bindable(false),
        placeholder = "",
    }: Props = $props();

    const textColors = [
        "#000000",
        "#4B5563",
        "#EF4444",
        "#F59E0B",
        "#10B981",
        "#3B82F6",
        "#6366F1",
        "#8B5CF6",
    ];
    const highlightColors = [
        "#FDE047",
        "#BBF7D0",
        "#CFFAFE",
        "#FBCFE8",
        "#FFEDD5",
        "#DDD6FE",
    ];

    let editor = $state.raw<any>(null);
    let editorElement: HTMLElement;
    let showImageModal = $state(false);
    let showFileModal = $state(false);
    let imageCounter = $state(0);

    // Image edit modal state
    let showImageEditModal = $state(false);
    let editingImage = $state<{
        pos: number;
        src: string;
        caption: string;
        alignment: string;
        linkUrl?: string;
        linkTargetBlank?: boolean;
    }>({ pos: 0, src: "", caption: "", alignment: "center", linkUrl: "", linkTargetBlank: false });

    let activeColorPalette = $state<
        "text" | "highlight" | "heading" | "fontSize" | null
    >(null);

    const fontSizes = [
        "12px",
        "14px",
        "16px",
        "18px",
        "20px",
        "24px",
        "30px",
        "36px",
    ];
    const headingLevels = [2, 3, 4, 5, 6];

    function togglePalette(
        palette: "text" | "highlight" | "heading" | "fontSize",
    ) {
        activeColorPalette = activeColorPalette === palette ? null : palette;
    }

    function selectColor(color: string, isHighlight = false) {
        if (isHighlight) {
            editor?.chain().focus().setHighlight({ color }).run();
        } else {
            editor?.chain().focus().setColor(color).run();
        }
        activeColorPalette = null;
    }

    function selectFontSize(size: string | null) {
        let chain = editor?.chain().focus();
        if (!size) {
            chain.unsetFontSize().run();
        } else {
            if (editor?.isActive("heading")) {
                chain = chain.setParagraph();
            }
            chain.setFontSize(size).run();
        }
        activeColorPalette = null;
    }

    function selectHeading(level: number) {
        let chain = editor?.chain().focus();
        if (level === 0) {
            chain.setParagraph();
        } else {
            chain.unsetFontSize().toggleHeading({ level: level as any });
        }
        chain.run();
        activeColorPalette = null;
    }

    onMount(async () => {
        const [
            { Editor, Extension },
            { default: StarterKit },
            { default: Image },
            { default: Placeholder },
            { default: TextAlign },
            { TextStyle },
            { default: Color },
            { default: Highlight },
            { default: Youtube },
        ] = await Promise.all([
            import("@tiptap/core"),
            import("@tiptap/starter-kit"),
            import("@tiptap/extension-image"),
            import("@tiptap/extension-placeholder"),
            import("@tiptap/extension-text-align"),
            import("@tiptap/extension-text-style"),
            import("@tiptap/extension-color"),
            import("@tiptap/extension-highlight"),
            import("@tiptap/extension-youtube"),
        ]);

        const FontSize = TextStyle.extend({
            addAttributes() {
                return {
                    ...this.parent?.(),
                    fontSize: {
                        default: null,
                        parseHTML: (element) =>
                            element.style.fontSize.replace(/['\"]+/g, ""),
                        renderHTML: (attributes) => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                };
            },
            addCommands() {
                return {
                    ...this.parent?.(),
                    setFontSize:
                        (fontSize: string) =>
                        ({ chain }: { chain: any }) => {
                            return chain()
                                .setMark("textStyle", { fontSize })
                                .run();
                        },
                    unsetFontSize:
                        () =>
                        ({ chain }: { chain: any }) => {
                            return chain()
                                .setMark("textStyle", { fontSize: null })
                                .removeEmptyTextStyle()
                                .run();
                        },
                } as any;
            },
        });

        // Extend Image to preserve data-original, data-align, and data-caption attributes
        // addNodeView() provides visual caption/alignment in the editor
        // renderHTML provides the <img> tag for getHTML() serialization
        const CustomImage = Image.extend({
            addAttributes() {
                return {
                    ...this.parent?.(),
                    "data-original": {
                        default: null,
                        parseHTML: (element) =>
                            element.getAttribute("data-original"),
                        renderHTML: (attributes) => {
                            if (!attributes["data-original"]) return {};
                            return {
                                "data-original": attributes["data-original"],
                            };
                        },
                    },
                    "data-align": {
                        default: null,
                        parseHTML: (element) =>
                            element.getAttribute("data-align"),
                        renderHTML: (attributes) => {
                            if (!attributes["data-align"]) return {};
                            return { "data-align": attributes["data-align"] };
                        },
                    },
                    "data-caption": {
                        default: null,
                        parseHTML: (element) =>
                            element.getAttribute("data-caption"),
                        renderHTML: (attributes) => {
                            if (!attributes["data-caption"]) return {};
                            return {
                                "data-caption": attributes["data-caption"],
                            };
                        },
                    },
                };
            },
            addNodeView() {
                return ({
                    node,
                    getPos,
                }: {
                    node: any;
                    getPos: () => number;
                }) => {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("editor-image-block");
                    const align = node.attrs["data-align"] || "center";
                    wrapper.dataset.align = align;

                    const img = document.createElement("img");
                    img.src = node.attrs.src || "";
                    if (node.attrs.alt) img.alt = node.attrs.alt;
                    wrapper.appendChild(img);

                    const caption = node.attrs["data-caption"];
                    if (caption) {
                        const cap = document.createElement("div");
                        cap.classList.add("editor-image-caption");
                        cap.textContent = caption;
                        wrapper.appendChild(cap);
                    }

                    // Click to open edit modal
                    wrapper.style.cursor = "pointer";
                    wrapper.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const pos = getPos();
                        let linkUrl = "";
                        let linkTargetBlank = false;

                        const innerNode = editor?.state.doc.nodeAt(pos);
                        if (innerNode) {
                            const linkMark = innerNode.marks.find(m => m.type.name === "link");
                            if (linkMark) {
                                linkUrl = linkMark.attrs.href || "";
                                linkTargetBlank = linkMark.attrs.target === "_blank";
                            } else {
                                // 부모 노드 깊이의 앵커 마크 검색
                                const resolvedPos = editor.state.doc.resolve(pos);
                                const parentLinkMark = resolvedPos.marks().find(m => m.type.name === "link");
                                if (parentLinkMark) {
                                    linkUrl = parentLinkMark.attrs.href || "";
                                    linkTargetBlank = parentLinkMark.attrs.target === "_blank";
                                }
                            }
                        }

                        openImageEditModal({
                            pos: pos,
                            src: node.attrs.src || "",
                            caption: node.attrs["data-caption"] || "",
                            alignment: node.attrs["data-align"] || "center",
                            linkUrl,
                            linkTargetBlank,
                        });
                    });

                    return { dom: wrapper };
                };
            },
        });

        editor = new Editor({
            element: editorElement,
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [2, 3, 4, 5, 6],
                    },
                    link: {
                        openOnClick: false,
                    },
                }),
                CustomImage.configure({
                    inline: false,
                    allowBase64: true,
                }),
                // Placeholder.configure({
                //     placeholder,
                // }),
                TextAlign.configure({
                    types: ["heading", "paragraph", "image"],
                }),
                Youtube.configure({
                    width: 840,
                    height: 480,
                    HTMLAttributes: {
                        class: 'w-full aspect-video rounded-lg shadow-lg',
                    },
                }),
                FontSize,
                Color,
                Highlight.configure({ multicolor: true }),
            ],
            content,
            editorProps: {
                attributes: {
                    class: "prose max-w-none focus:outline-none min-h-[400px] p-4",
                },
            },
            onUpdate: ({ editor }: { editor: any }) => {
                content = editor.getHTML();
            },
        });

        // Sync content if it was set before editor initialized
        if (content && editor && editor.getHTML() !== content) {
            editor.commands.setContent(content);
        }
    });

    // 외부 content Prop의 반응형 변화(비동기 데이터 로딩 및 탭 전환)를 감지하여 에디터에 반영
    $effect(() => {
        if (editor && content !== undefined && editor.getHTML() !== content) {
            editor.commands.setContent(content);
        }
    });

    // Close dropdowns on outside click
    $effect(() => {
        if (activeColorPalette) {
            const handleOutsideClick = (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                if (!target.closest(".color-popover-container")) {
                    activeColorPalette = null;
                }
            };
            window.addEventListener("click", handleOutsideClick);
            return () =>
                window.removeEventListener("click", handleOutsideClick);
        }
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    // Image Upload Logic
    function calculateImageCount() {
        let count = 0;
        if (editor) {
            editor.state.doc.descendants((node: any) => {
                if (node.type.name === "image") {
                    count++;
                }
                return true;
            });
        }
        return count + 1;
    }

    function openImageModal() {
        imageCounter = calculateImageCount();
        showImageModal = true;
    }

    function handleImageInsert(
        imagesData: Array<{ url: string; originalUrl?: string | null; alt?: string }>,
        caption: string,
        alignment: string,
        linkConfig?: { url: string; targetBlank: boolean } | null
    ) {
        if (editor) {
            if (linkConfig && linkConfig.url) {
                // 이미지 링크 설정이 활성화된 경우
                imagesData.forEach((img) => {
                    const alignAttr = alignment ? ` data-align="${alignment}"` : '';
                    const captionAttr = caption ? ` data-caption="${caption}"` : '';
                    const origAttr = img.originalUrl ? ` data-original="${img.originalUrl}"` : '';
                    const targetAttr = linkConfig.targetBlank ? ' target="_blank" rel="noopener noreferrer"' : '';

                    const imgHtml = `<img src="${img.url}" alt="${img.alt || ''}"${origAttr}${alignAttr}${captionAttr} />`;
                    const linkHtml = `<a href="${linkConfig.url}"${targetAttr}>${imgHtml}</a>`;

                    editor.chain().focus().insertContent(linkHtml).run();
                });
                editor.chain().focus().enter().run();
            } else {
                // 이미지 링크 설정이 활성화되지 않은 기존 단독 이미지 삽입 로직
                let chain = editor.chain().focus();
                imagesData.forEach((img) => {
                    chain = chain.setImage({
                        src: img.url,
                        alt: img.alt || "",
                        "data-original": img.originalUrl || null,
                        "data-align": alignment || "center",
                        "data-caption": caption || null,
                    } as any).enter();
                });
                chain.run();
            }
        }
    }

    function handleFileInsert(fileData: { url: string; name: string; size: number }) {
        if (editor) {
            const formattedSize = formatSize(fileData.size);
            const fileHtml = `
                <a href="${fileData.url}" download="${fileData.name}" target="_blank" rel="noopener" class="file-attachment-card" data-file-size="${formattedSize}">
                    <span class="file-icon">📎</span>
                    <span class="file-details">
                        <span class="file-name">${fileData.name}</span>
                        <span class="file-size">${formattedSize}</span>
                    </span>
                    <span class="download-badge">Download</span>
                </a>
            `;
            editor.chain().focus().insertContent(fileHtml).run();
            editor.chain().focus().enter().run();
        }
    }

    function formatSize(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    // Image Edit Modal Logic
    function openImageEditModal(info: {
        pos: number;
        src: string;
        caption: string;
        alignment: string;
        linkUrl?: string;
        linkTargetBlank?: boolean;
    }) {
        editingImage = info;
        showImageEditModal = true;
    }

    function handleImageEditSave(
        caption: string,
        alignment: string,
        linkConfig?: { url: string; targetBlank: boolean } | null,
    ) {
        if (!editor) return;
        const pos = editingImage.pos;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) return;

        // 1. 이미지 노드 마크업(캡션, 정렬) 수정
        editor
            .chain()
            .focus()
            .command(({ tr }: { tr: any }) => {
                tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    "data-caption": caption || null,
                    "data-align": alignment,
                });
                return true;
            })
            .run();

        // 2. 링크(Mark) 수정 혹은 삭제
        if (linkConfig && linkConfig.url) {
            editor
                .chain()
                .focus()
                .setNodeSelection(pos)
                .setMark("link", {
                    href: linkConfig.url,
                    target: linkConfig.targetBlank ? "_blank" : null,
                })
                .run();
        } else {
            editor
                .chain()
                .focus()
                .setNodeSelection(pos)
                .unsetMark("link")
                .run();
        }

        showImageEditModal = false;
    }

    async function handleImageDelete() {
        if (!editor) return;
        const src = editingImage.src;
        const pos = editingImage.pos;

        // 1. Extract storage key from URL and delete from server
        const keyMatch = src.match(/\/images\/(.+)$/);
        if (keyMatch) {
            const desktopKey = keyMatch[1];
            const mobileKey = desktopKey.replace("/desktop/", "/mobile/");
            const originalKey = desktopKey.replace("/desktop/", "/original/");
            const keys = [desktopKey, mobileKey, originalKey];

            try {
                await fetch("/api/media", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keys }),
                });
            } catch (e) {
                console.error("이미지 서버 삭제 실패:", e);
            }
        }

        // 2. Delete node from editor
        editor
            .chain()
            .focus()
            .command(({ tr }: { tr: any }) => {
                const node = tr.doc.nodeAt(pos);
                if (node) tr.delete(pos, pos + node.nodeSize);
                return true;
            })
            .run();

        showImageEditModal = false;
    }

    function insertImage() {
        const url = prompt(t('admin.editor.prompt_image_url', { default: "이미지 URL을 입력하세요:" }));
        if (url) {
            const caption = prompt(t('admin.editor.prompt_image_caption', { default: "이미지 설명을 입력하세요 (선택사항):" }));
            if (editor) {
                editor
                    .chain()
                    .focus()
                    .setImage({
                        src: url,
                        "data-align": "center",
                        "data-caption": caption || null,
                    } as any)
                    .run();
                editor.chain().focus().enter().run();
            }
        }
    }

    function triggerImageUpload() {
        document.getElementById("tiptap-image-upload")?.click();
    }

    function insertLink() {
        const url = prompt(t('admin.editor.prompt_link_url', { default: "링크 URL을 입력하세요:" }));
        if (url && editor) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }

    function insertYouTube() {
        const url = prompt(t('admin.editor.prompt_youtube_url', { default: "YouTube URL을 입력하세요:" }));
        if (url && editor) {
            editor.chain().focus().setYoutubeVideo({ src: url }).run();
        }
    }
</script>

<div class="tiptap-editor">
    <!-- Editor Toolbar -->
    <div class="editor-toolbar sticky-toolbar">
        <!-- 텍스트 편집 -->
        <div class="toolbar-group">
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleBold().run()}
                class:active={editor?.isActive("bold")}
                title={t('admin.editor.tooltip_bold', { default: "굵게" })}
            >
                <Bold size={18} />
            </button>
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleItalic().run()}
                class:active={editor?.isActive("italic")}
                title={t('admin.editor.tooltip_italic', { default: "기울임" })}
            >
                <Italic size={18} />
            </button>
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleStrike().run()}
                class:active={editor?.isActive("strike")}
                title={t('admin.editor.tooltip_strike', { default: "취소선" })}
            >
                <Strikethrough size={18} />
            </button>
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleCode().run()}
                class:active={editor?.isActive("code")}
                title={t('admin.editor.tooltip_code', { default: "인라인 코드" })}
            >
                <Code size={18} />
            </button>
        </div>

        <!-- 제목 -->
        <div class="toolbar-group">
            <div class="color-popover-container">
                <button
                    type="button"
                    onclick={() => togglePalette("heading")}
                    class:active={activeColorPalette === "heading" ||
                        editor?.isActive("heading")}
                    title={t('admin.editor.tooltip_heading', { default: "제목" })}
                    class="dropdown-button"
                >
                    <Heading size={18} />
                    <ChevronDown size={12} />
                </button>
                {#if activeColorPalette === "heading"}
                    <div class="color-popover dropdown-popover">
                        {#each headingLevels as level}
                            <button
                                type="button"
                                class="dropdown-item"
                                class:active={editor?.isActive("heading", {
                                    level,
                                })}
                                onclick={() => selectHeading(level)}
                            >
                                Heading {level}
                            </button>
                        {/each}
                        <button
                            type="button"
                            class="dropdown-item"
                            onclick={() => selectHeading(0)}
                        >
                            {t('admin.editor.heading_normal', { default: "본문 (Normal)" })}
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <!-- 글자 크기 -->
        <div class="toolbar-group">
            <div class="color-popover-container">
                <button
                    type="button"
                    onclick={() => togglePalette("fontSize")}
                    class:active={activeColorPalette === "fontSize"}
                    title={t('admin.theme.font_size', { default: "글자 크기" })}
                    class="dropdown-button"
                >
                    <CaseSensitive size={18} />
                    <ChevronDown size={12} />
                </button>
                {#if activeColorPalette === "fontSize"}
                    <div class="color-popover dropdown-popover">
                        {#each fontSizes as size}
                            <button
                                type="button"
                                class="dropdown-item"
                                onclick={() => selectFontSize(size)}
                                style="font-size: {size}"
                            >
                                {size}
                            </button>
                        {/each}
                        <button
                            type="button"
                            class="dropdown-item"
                            onclick={() => selectFontSize("")}
                        >
                            {t('admin.editor.font_size_reset', { default: "초기화" })}
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <!-- 정렬 -->
        <div class="toolbar-group">
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().setTextAlign("left").run()}
                class:active={editor?.isActive({ textAlign: "left" })}
                title={t('admin.editor.tooltip_align_left', { default: "왼쪽 정렬" })}
            >
                <AlignLeft size={18} />
            </button>
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().setTextAlign("center").run()}
                class:active={editor?.isActive({ textAlign: "center" })}
                title={t('admin.editor.tooltip_align_center', { default: "가운데 정렬" })}
            >
                <AlignCenter size={18} />
            </button>
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().setTextAlign("right").run()}
                class:active={editor?.isActive({ textAlign: "right" })}
                title={t('admin.editor.tooltip_align_right', { default: "오른쪽 정렬" })}
            >
                <AlignRight size={18} />
            </button>
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().setTextAlign("justify").run()}
                class:active={editor?.isActive({ textAlign: "justify" })}
                title={t('admin.editor.tooltip_align_justify', { default: "양쪽 정렬" })}
            >
                <AlignJustify size={18} />
            </button>
        </div>

        <!-- 색상/강조 -->
        <div class="toolbar-group">
            <div class="color-popover-container">
                <button
                    type="button"
                    class="color-button main"
                    class:active={activeColorPalette === "text"}
                    onclick={() => togglePalette("text")}
                    title={t('admin.theme.text_color', { default: "글자 색상" })}
                >
                    <Type size={18} />
                    <div
                        class="color-indicator"
                        style="background: {editor?.getAttributes('textStyle')
                            .color || '#000'}"
                    ></div>
                </button>
                {#if activeColorPalette === "text"}
                    <div class="color-popover">
                        <div class="swatches">
                            {#each textColors as color}
                                <button
                                    type="button"
                                    class="swatch"
                                    style="background: {color}"
                                    onclick={() => selectColor(color)}
                                    title={color}
                                ></button>
                            {/each}
                        </div>
                        <label class="custom-color-label">
                            <input
                                type="color"
                                oninput={(e) =>
                                    selectColor(
                                        (e.target as HTMLInputElement).value,
                                    )}
                            />
                            <span>{t('admin.editor.custom_color', { default: "직접 선택" })}</span>
                        </label>
                    </div>
                {/if}
            </div>
            <div class="color-popover-container">
                <button
                    type="button"
                    class="color-button main"
                    class:active={activeColorPalette === "highlight"}
                    onclick={() => togglePalette("highlight")}
                    title={t('admin.editor.tooltip_highlight', { default: "배경 강조" })}
                >
                    <Highlighter size={16} />
                    <div
                        class="color-indicator"
                        style="background: {editor?.getAttributes('highlight')
                            .color || '#fde047'}"
                    ></div>
                </button>
                {#if activeColorPalette === "highlight"}
                    <div class="color-popover">
                        <div class="swatches">
                            {#each highlightColors as color}
                                <button
                                    type="button"
                                    class="swatch"
                                    style="background: {color}"
                                    onclick={() => selectColor(color, true)}
                                    title={color}
                                ></button>
                            {/each}
                        </div>
                        <label class="custom-color-label">
                            <input
                                type="color"
                                oninput={(e) =>
                                    selectColor(
                                        (e.target as HTMLInputElement).value,
                                        true,
                                    )}
                            />
                            <span>{t('admin.editor.custom_color', { default: "직접 선택" })}</span>
                        </label>
                    </div>
                {/if}
            </div>
        </div>

        <!-- 목록 -->
        <div class="toolbar-group">
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleBulletList().run()}
                class:active={editor?.isActive("bulletList")}
                title={t('admin.editor.tooltip_bullet_list', { default: "글머리 기호" })}
            >
                <List size={18} />
            </button>
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().toggleOrderedList().run()}
                class:active={editor?.isActive("orderedList")}
                title={t('admin.editor.tooltip_ordered_list', { default: "번호 매기기" })}
            >
                <ListOrdered size={18} />
            </button>
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
                class:active={editor?.isActive("codeBlock")}
                title={t('admin.editor.tooltip_code_block', { default: "코드 블록" })}
            >
                <FileCode size={18} />
            </button>
        </div>

        <!-- 링크 -->
        <div class="toolbar-group">
            <span class="group-label">{t('admin.editor.group_media_link', { default: "링크/미디어" })}</span>
            <button type="button" onclick={insertLink} title={t('admin.editor.tooltip_text_link', { default: "텍스트 링크" })} >
                <LinkIcon size={18} />
            </button>
            <button
                type="button"
                onclick={openImageModal}
                title={t('admin.editor.tooltip_image_upload', { default: "이미지 업로드" })}
            >
                <UploadIcon size={18} />
            </button>
            <button
                type="button"
                onclick={() => (showFileModal = true)}
                title={t('admin.editor.tooltip_file_upload', { default: "파일 첨부" })}
            >
                <Paperclip size={18} />
            </button>

            <button type="button" onclick={insertImage} title={t('admin.editor.tooltip_image_url', { default: "이미지 URL 삽입" })} >
                <ImageIcon size={18} />
            </button>
            <button type="button" onclick={insertYouTube} title={t('admin.editor.tooltip_youtube', { default: "YouTube 삽입" })} >
                <YoutubeIcon size={18} />
            </button>
        </div>

        <!-- 기타 -->
        <div class="toolbar-group">
            <button
                type="button"
                onclick={() =>
                    editor?.chain().focus().setHorizontalRule().run()}
                title={t('admin.editor.tooltip_hr', { default: "구분선" })}
            >
                <Minus size={18} />
            </button>
            <button
                type="button"
                onclick={() => editor?.chain().focus().toggleBlockquote().run()}
                class:active={editor?.isActive("blockquote")}
                title={t('admin.editor.tooltip_quote', { default: "인용" })}
            >
                <Quote size={18} />
            </button>
        </div>
    </div>

    <div bind:this={editorElement}></div>

    <ImageUploadModal
        bind:isOpen={showImageModal}
        category={category || "general"}
        slug={slug || "new-post"}
        {lang}
        imageCounter={imageCounter}
        defaultTargetBlank={true}
        onClose={() => (showImageModal = false)}
        onInsert={handleImageInsert}
    />

    <FileUploadModal
        bind:isOpen={showFileModal}
        {slug}
        onClose={() => (showFileModal = false)}
        onInsert={handleFileInsert}
    />

    <ImageEditModal
        bind:isOpen={showImageEditModal}
        currentSrc={editingImage.src}
        currentCaption={editingImage.caption}
        currentAlignment={editingImage.alignment}
        currentLinkUrl={editingImage.linkUrl}
        currentLinkTargetBlank={editingImage.linkTargetBlank}
        onSave={handleImageEditSave}
        onDelete={handleImageDelete}
        onClose={() => (showImageEditModal = false)}
    />
</div>

<style>
    .tiptap-editor {
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 0.5rem;
        border: 1px solid #e5e7eb;
    }

    .sticky-toolbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: #f9fafb;
    }

    .editor-toolbar {
        padding: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        border-radius: 0.5rem 0.5rem 0 0;
    }

    .toolbar-group {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        padding: 0.25rem;
        border-right: 1px solid #e5e7eb;
    }

    .toolbar-group:last-child {
        border-right: none;
    }

    .toolbar-group button {
        padding: 0.375rem;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #374151;
    }

    .toolbar-group button:hover {
        background: #e5e7eb;
    }

    .toolbar-group button.active {
        background: #dbeafe;
        color: #2563eb;
    }

    .group-label {
        font-size: 0.75rem;
        color: #6b7280;
        margin-right: 0.25rem;
        font-weight: 500;
    }

    .color-popover-container {
        position: relative;
    }

    .color-button {
        position: relative;
        padding: 0.375rem !important;
    }

    .color-indicator {
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        height: 3px;
        border-radius: 2px;
    }

    .color-popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.75rem;
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        z-index: 50;
        min-width: 200px;
    }

    .dropdown-popover {
        min-width: 180px;
    }

    .dropdown-button {
        display: flex !important;
        align-items: center;
        gap: 4px;
    }

    .dropdown-item {
        width: 100%;
        padding: 0.5rem 0.75rem !important;
        text-align: left;
        border-radius: 4px;
        background: transparent !important;
        margin-bottom: 2px;
    }

    .dropdown-item:hover {
        background: #f3f4f6 !important;
    }

    .dropdown-item.active {
        background: #dbeafe !important;
        color: #2563eb;
    }

    .swatches {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .swatch {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        border: 2px solid #e5e7eb;
        cursor: pointer;
        transition: transform 0.15s;
        padding: 0 !important;
    }

    .swatch:hover {
        transform: scale(1.1);
        border-color: #3b82f6;
    }

    .custom-color-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.875rem;
        color: #374151;
    }

    .custom-color-label input[type="color"] {
        width: 32px;
        height: 32px;
        border: none;
        cursor: pointer;
        border-radius: 4px;
    }

    :global(.tiptap-editor .ProseMirror) {
        outline: none;
        min-height: 400px;
        max-height: calc(100vh - 250px);
        overflow-y: auto;
    }

    :global(.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before) {
        color: #9ca3af;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }

    :global(.tiptap-editor .ProseMirror img) {
        max-width: 100%;
        border-radius: 4px;
    }

    /* Editor image block with caption/alignment */
    :global(.ProseMirror .editor-image-block) {
        display: table;
        margin: 1.5rem auto;
        text-align: center;
        position: relative;
    }
    :global(.ProseMirror .editor-image-block[data-align="left"]) {
        margin-left: 0;
        margin-right: auto;
    }
    :global(.ProseMirror .editor-image-block[data-align="right"]) {
        margin-left: auto;
        margin-right: 0;
    }
    :global(.ProseMirror .editor-image-block img) {
        max-width: 100%;
        display: block;
        border-radius: 4px;
    }
    :global(.ProseMirror .editor-image-caption) {
        display: table-caption;
        caption-side: bottom;
        text-align: center;
        color: #9ca3af;
        font-size: 0.82rem;
        font-weight: 600;
        margin-top: 0.3rem;
        letter-spacing: 0.01em;
    }
</style>
