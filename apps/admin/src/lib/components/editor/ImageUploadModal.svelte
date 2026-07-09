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
    import { processImage } from "$lib/utils/clientImageProcessor";
    import { onMount, tick } from "svelte";
    import { t } from "$lib/i18n.svelte";

    let {
        isOpen = $bindable(false),
        category,
        slug,
        lang,
        imageCounter,
        defaultTargetBlank = false,
        onClose,
        onInsert,
    } = $props<{
        isOpen?: boolean;
        category: string;
        slug: string;
        lang: string;
        imageCounter: number;
        defaultTargetBlank?: boolean;
        onClose: () => void;
        onInsert: (
            imagesData: Array<{
                url: string;
                originalUrl: string | null;
                alt: string;
            }>,
            caption: string,
            alignment: string,
            linkConfig?: { url: string; targetBlank: boolean } | null,
        ) => void;
    }>();

    let selectedFiles: File[] = $state([]);
    let previewUrls: string[] = $state([]);
    let imageQuality = $state(80);
    let imageCaption = $state("");
    let saveOriginal = $state(false);
    let isAnimated = $state(false);
    let imageAlignment = $state("center");
    let isProcessing = $state(false);
    let useLink = $state(false);
    let linkUrl = $state("");
    let linkTargetBlank = $state(defaultTargetBlank);

    let fileInput: HTMLInputElement | undefined = $state();

    // Svelte 5 커스텀 액션: 이미지 입력창 마운트 시 탐색기 즉시 실행
    function autoClick(node: HTMLInputElement) {
        tick().then(() => {
            node.click();
        });
    }

    function reset() {
        selectedFiles = [];
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        previewUrls = [];
        imageQuality = 80;
        imageCaption = "";
        saveOriginal = false;
        isAnimated = false;
        imageAlignment = "center";
        isProcessing = false;
        useLink = false;
        linkUrl = "";
        linkTargetBlank = defaultTargetBlank;
        if (fileInput) fileInput.value = "";
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            if (input.files.length > 5) {
                alert(
                    t("admin.editor.max_images_warning", {
                        default:
                            "이미지는 한 번에 최대 5개까지만 업로드할 수 있어, 처음 선택한 5개의 파일만 등록됩니다.",
                    }),
                );
                selectedFiles = Array.from(input.files).slice(0, 5);
            } else {
                selectedFiles = Array.from(input.files);
            }
            previewUrls = selectedFiles.map((file) =>
                URL.createObjectURL(file),
            );
        }
    }

    async function handleUpload() {
        if (selectedFiles.length === 0) return;

        // Validate slug for folder structure
        const safeSlug = slug ? slug.trim() : "";
        if (!safeSlug || safeSlug === "new-post") {
            alert(
                t("admin.editor.slug_required_warning", {
                    default:
                        "이미지 정리를 위해 URL 슬러그(Slug)를 먼저 입력해주세요.",
                }),
            );
            return;
        }

        isProcessing = true;

        try {
            const safeCategory = category ? category.trim() : "uncategorized";
            const safeLang = lang ? lang.trim() : "default";
            const insertData: Array<{
                url: string;
                originalUrl: string | null;
                alt: string;
            }> = [];

            // 순차적 순회 처리로 메모리 과점유 방지
            for (let i = 0; i < selectedFiles.length; i++) {
                const currentFile = selectedFiles[i];
                const currentCounter = imageCounter + i;
                const filename = `img-${safeCategory}-${safeSlug}-${safeLang}-${String(currentCounter).padStart(3, "0")}`;

                // ── 움짤(원본 보존) 모드로 체크 시 기존 압축 로직을 완전히 스킵하고 다이렉트 업로드 ──
                if (isAnimated) {
                    const fileExt = currentFile.name.split('.').pop()?.toLowerCase() ?? "";
                    const formData = new FormData();
                    formData.append("file", currentFile);
                    formData.append("folder", `posts/${safeSlug}/original`);
                    formData.append("filename", `${filename}.${fileExt}`);

                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || "Original upload failed");
                    }
                    const uploadResult = await res.json();

                    insertData.push({
                        url: uploadResult.url,
                        originalUrl: null,
                        alt: filename,
                    });
                    continue; // 하위의 기존 3단 WebP 변환 및 업로드 코드를 모두 안전하게 건너뜀
                }

                // 1. Client-side Processing
                const processed = await processImage(currentFile, {
                    quality: imageQuality,
                    generateOriginal: saveOriginal,
                });

                // 2. Upload Variants helper
                const uploadVariant = async (blob: Blob, variant: string) => {
                    const formData = new FormData();
                    formData.append("file", blob);
                    formData.append("folder", `posts/${safeSlug}/${variant}`);
                    formData.append("filename", `${filename}.webp`);

                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(
                            err.message || `${variant} upload failed`,
                        );
                    }
                    return res.json();
                };

                const uploads = [
                    uploadVariant(processed.desktop, "desktop"),
                    uploadVariant(processed.mobile, "mobile"),
                    uploadVariant(processed.thumbnail, "thumbnail"),
                ];

                if (saveOriginal && processed.original) {
                    uploads.push(uploadVariant(processed.original, "original"));
                }

                const results = await Promise.all(uploads);
                const desktopResult = results[0];
                const originalResult =
                    saveOriginal && results[3] ? results[3] : null;

                insertData.push({
                    url: desktopResult.url,
                    originalUrl: originalResult?.url || null,
                    alt: filename,
                });
            }

            // 3. Insert to Editor
            onInsert(
                insertData,
                imageCaption,
                imageAlignment,
                useLink && linkUrl.trim() ? { url: linkUrl.trim(), targetBlank: linkTargetBlank } : null
            );

            onClose();
            reset();
        } catch (e: any) {
            console.error(e);
            alert(
                t("admin.editor.upload_failed", { default: "업로드 실패" }) +
                    ": " +
                    e.message,
            );
        } finally {
            isProcessing = false;
        }
    }

    // Cleanup preview URLs
    onMount(() => {
        return () => {
            previewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    });
</script>

{#if isOpen}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal-container" onclick={(e) => e.stopPropagation()}>
            <h2 class="modal-title">
                {t("admin.editor.modal_upload_title", {
                    default: "이미지 업로드 설정",
                })}
            </h2>

            <div class="modal-body">
                <!-- File Input or Preview -->
                <div class="upload-area">
                    {#if previewUrls.length > 0}
                        <div class="preview-grid">
                            {#each previewUrls as url}
                                <img
                                    src={url}
                                    alt="Preview"
                                    class="preview-image"
                                />
                            {/each}
                        </div>
                        <button class="change-btn" onclick={reset}
                            >{t("admin.editor.change_image", {
                                default: "이미지 변경",
                            })}</button
                        >
                    {:else}
                        <div class="file-input-wrapper">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                bind:this={fileInput}
                                onchange={handleFileSelect}
                                style="display: none;"
                                use:autoClick
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                onclick={() => fileInput?.click()}
                            >
                                {t("admin.editor.select_image", {
                                    default: "이미지 선택",
                                })}
                            </button>
                        </div>
                    {/if}
                </div>

                {#if selectedFiles.length > 0}
                    <!-- Quality Slider -->
                    <div class="form-group">
                        <div class="label-row">
                            <label
                                >{t("admin.editor.image_quality", {
                                    default: "이미지 품질",
                                })}</label
                            >
                            <span>{imageQuality}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            bind:value={imageQuality}
                            class="range-input"
                        />
                    </div>

                    <!-- Options -->
                    <div class="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="saveOriginal"
                            bind:checked={saveOriginal}
                        />
                        <label for="saveOriginal"
                            >{t("admin.editor.save_original", {
                                default: "원본 이미지 별도 저장 (백업용)",
                            })}</label
                        >
                    </div>

                    <div class="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="isAnimated"
                            bind:checked={isAnimated}
                        />
                        <label for="isAnimated"
                            >{t("admin.editor.is_animated", {
                                default: "움직이는 이미지(GIF/WebP) 원본 유지",
                            })}</label
                        >
                    </div>

                    <!-- Caption -->
                    <div class="form-group">
                        <label class="block-label"
                            >{t("admin.editor.caption_label", {
                                default: "캡션 (선택사항)",
                            })}</label
                        >
                        <input
                            type="text"
                            bind:value={imageCaption}
                            class="text-input"
                            placeholder={t("admin.editor.caption_placeholder", {
                                default: "이미지 아래에 표시될 설명",
                            })}
                        />
                    </div>

                    <!-- Alignment -->
                    <div class="form-group">
                        <label class="block-label"
                            >{t("admin.editor.alignment_label", {
                                default: "이미지 정렬",
                            })}</label
                        >
                        <div class="alignment-options">
                            <label class="align-option">
                                <input
                                    type="radio"
                                    bind:group={imageAlignment}
                                    value="left"
                                />
                                <span>◀ {t("admin.theme.align_left")}</span>
                            </label>
                            <label class="align-option">
                                <input
                                    type="radio"
                                    bind:group={imageAlignment}
                                    value="center"
                                />
                                <span>◆ {t("admin.theme.align_center")}</span>
                            </label>
                            <label class="align-option">
                                <input
                                    type="radio"
                                    bind:group={imageAlignment}
                                    value="right"
                                />
                                <span>▶ {t("admin.theme.align_right")}</span>
                            </label>
                        </div>
                    </div>

                    <!-- 이미지 링크 설정 UI 영역 -->
                    <div class="form-group checkbox-group mt-3 border-t pt-3">
                        <input
                            type="checkbox"
                            id="useLink"
                            bind:checked={useLink}
                        />
                        <label for="useLink" class="font-semibold text-slate-700"
                            >{t("admin.editor.use_link", {
                                default: "이미지에 링크 걸기",
                            })}</label
                        >
                    </div>

                    {#if useLink}
                        <div class="form-group">
                            <label class="block-label" for="linkUrl"
                                >{t("admin.editor.link_url_label", {
                                    default: "링크 URL",
                                })}</label
                            >
                            <input
                                id="linkUrl"
                                type="text"
                                bind:value={linkUrl}
                                class="text-input"
                                placeholder="https://example.com"
                            />
                        </div>

                        <div class="form-group checkbox-group">
                            <input
                                type="checkbox"
                                id="linkTargetBlank"
                                bind:checked={linkTargetBlank}
                            />
                            <label for="linkTargetBlank"
                                >{t("admin.editor.link_target_blank", {
                                    default: "새 창으로 열기",
                                })}</label
                            >
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="modal-footer">
                <button
                    onclick={onClose}
                    class="btn btn-secondary"
                    disabled={isProcessing}
                >
                    {t("admin.common.cancel")}
                </button>
                <button
                    onclick={handleUpload}
                    class="btn btn-primary"
                    disabled={selectedFiles.length === 0 || isProcessing}
                >
                    {#if isProcessing}
                        {t("blog.auth.processing")}
                    {:else}
                        {t("admin.editor.tooltip_image_upload")}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-container {
        background: white;
        border-radius: 8px;
        box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
        width: 100%;
        max-width: 500px;
        padding: 1.5rem;
        margin: 1rem;
    }

    .modal-title {
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 1rem;
        color: #111827;
    }

    .modal-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .upload-area {
        border: 2px dashed #d1d5db;
        border-radius: 0.375rem;
        padding: 1rem;
        text-align: center;
        background-color: #f9fafb;
    }

    .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 0.5rem;
        max-height: 12rem;
        overflow-y: auto;
        padding: 0.25rem;
        margin-bottom: 0.5rem;
    }

    .preview-image {
        width: 100%;
        height: 60px;
        object-fit: cover;
        border-radius: 0.25rem;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }

    .change-btn {
        font-size: 0.75rem;
        color: #ef4444;
        text-decoration: underline;
        background: none;
        border: none;
        cursor: pointer;
    }

    .file-input-wrapper {
        position: relative;
        padding: 1rem;
    }

    .placeholder-text {
        color: #6b7280;
        font-size: 0.875rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .label-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .range-input {
        width: 100%;
        height: 0.5rem;
        background-color: #e5e7eb;
        border-radius: 0.5rem;
        outline: none;
        cursor: pointer;
    }

    .checkbox-group {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
    }

    .checkbox-group input[type="checkbox"] {
        width: 1rem;
        height: 1rem;
    }

    .checkbox-group label {
        font-size: 0.875rem;
        color: #374151;
    }

    .block-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .text-input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        padding: 0.5rem;
        font-size: 0.875rem;
    }

    .text-input:focus {
        border-color: #3b82f6;
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: 0 0 0 2px #bfdbfe;
    }

    .alignment-options {
        display: flex;
        gap: 1rem;
    }

    .align-option {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .align-option input[type="radio"] {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
    }

    .modal-footer {
        margin-top: 1.5rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    .btn {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: 0.375rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        color: #374151;
        background-color: white;
        border: 1px solid #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #f9fafb;
    }

    .btn-primary {
        color: white;
        background-color: #2563eb;
        border: 1px solid transparent;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #1d4ed8;
    }
</style>
