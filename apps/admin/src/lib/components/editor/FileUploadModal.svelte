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
    import { onMount, tick } from "svelte";
    import { t } from "$lib/i18n.svelte";

    let {
        isOpen = $bindable(false),
        slug,
        onClose,
        onInsert
    } = $props<{
        isOpen?: boolean;
        slug: string;
        onClose: () => void;
        onInsert: (fileData: { url: string; name: string; size: number }) => void;
    }>();

    let selectedFile = $state<File | null>(null);
    let isProcessing = $state(false);
    let storageType = $state("kv");
    let maxSizeLimit = $state(2 * 1024 * 1024); // Default 2MB (KV)
    let errorMessage = $state("");
    let fileInput = $state<HTMLInputElement>();

    // Svelte 5 커스텀 액션: 파일 입력창 마운트 시 탐색기 즉시 실행
    function autoClick(node: HTMLInputElement) {
        tick().then(() => {
            node.click();
        });
    }

    // Restricted extension list (executable files)
    const RESTRICTED_EXTENSIONS = [
        "exe", "bat", "cmd", "sh", "msi", "dmg",
        "scr", "vbs", "com", "jar", "bin", "app"
    ];

    async function loadStorageSettings() {
        try {
            const res = await fetch("/api/storage-settings");
            if (res.ok) {
                const data = await res.json();
                storageType = data.settings?.storage_type || "kv";
                if (storageType === "kv") {
                    maxSizeLimit = 2 * 1024 * 1024; // 2MB
                } else {
                    maxSizeLimit = 5 * 1024 * 1024; // 5MB
                }
            }
        } catch (e) {
            console.error("Failed to load storage settings:", e);
            // Default fallback
            storageType = "kv";
            maxSizeLimit = 2 * 1024 * 1024;
        }
    }

    onMount(() => {
        loadStorageSettings();
    });

    function reset() {
        selectedFile = null;
        errorMessage = "";
        isProcessing = false;
        isDragOver = false;
        if (fileInput) fileInput.value = "";
    }

    function validateFile(file: File): boolean {
        errorMessage = "";
        const ext = file.name.split('.').pop()?.toLowerCase() ?? "";

        // 1. Executable file restriction check
        if (RESTRICTED_EXTENSIONS.includes(ext)) {
            errorMessage = t('admin.editor.err_security_exec', { ext });
            return false;
        }

        // 2. Size limit check
        if (file.size > maxSizeLimit) {
            const limitMb = maxSizeLimit / (1024 * 1024);
            errorMessage = t('admin.editor.err_size_limit', {
                limit: String(limitMb),
                size: (file.size / (1024 * 1024)).toFixed(2)
            });
            return false;
        }

        return true;
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (validateFile(file)) {
                selectedFile = file;
            } else {
                selectedFile = null;
                input.value = "";
            }
        }
    }

    // DND handlers removed

    async function handleUpload() {
        if (!selectedFile) return;

        const safeSlug = slug ? slug.trim() : "";
        if (!safeSlug || safeSlug === "new-post") {
            alert(t('admin.editor.err_slug_required'));
            return;
        }

        isProcessing = true;
        errorMessage = "";

        try {
            const timestamp = Date.now();
            const safeFilename = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const folder = `posts/${safeSlug}/files`;
            const uniqueFilename = `${timestamp}-${safeFilename}`;

            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("folder", folder);
            formData.append("filename", uniqueFilename);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }

            const data = await res.json();

            // Insert to Editor
            onInsert({
                url: data.url,
                name: selectedFile.name,
                size: selectedFile.size
            });

            onClose();
            reset();
        } catch (e: any) {
            console.error(e);
            errorMessage = t('admin.editor.err_upload_fail', { msg: e.message });
        } finally {
            isProcessing = false;
        }
    }

    function formatBytes(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
</script>

{#if isOpen}
    <div class="modal-backdrop" role="dialog" aria-modal="true" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }} tabindex="-1">
        <div class="modal-container" onclick={(e) => e.stopPropagation()} role="presentation">
            <h2 class="modal-title">{t('admin.editor.modal_file_title')}</h2>

            <div class="modal-body">
                <!-- Info Banner -->
                <div class="storage-info-banner">
                    <span class="info-icon">ℹ️</span>
                    <span class="info-text">
                        {t('admin.editor.current_storage')}: <strong>{storageType.toUpperCase()}</strong> | 
                        {t('admin.editor.max_limit')}: <strong>{maxSizeLimit / (1024 * 1024)}MB</strong>
                    </span>
                </div>

                <!-- File Selection Area -->
                <div class="upload-area">
                    {#if selectedFile}
                        <div class="file-selected-info">
                            <span class="file-icon">📎</span>
                            <span class="file-name">{selectedFile.name}</span>
                            <span class="file-size">({formatBytes(selectedFile.size)})</span>
                            <button class="change-btn" onclick={reset}>{t('admin.editor.change_btn', { default: '변경' })}</button>
                        </div>
                    {:else}
                        <div class="file-input-wrapper">
                            <input
                                type="file"
                                accept="*"
                                bind:this={fileInput}
                                onchange={handleFileSelect}
                                style="display: none;"
                                use:autoClick
                            />
                            <button type="button" class="btn btn-secondary" onclick={() => fileInput?.click()}>
                                {t('admin.editor.select_file', { default: '파일 선택' })}
                            </button>
                            <p class="helper-text" style="margin-top: 0.5rem;">
                                {t('admin.editor.security_warning')}
                            </p>
                        </div>
                    {/if}
                </div>

                <!-- Error Message -->
                {#if errorMessage}
                    <div class="error-banner">
                        ⚠️ {errorMessage}
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button
                    onclick={onClose}
                    class="btn btn-secondary"
                    disabled={isProcessing}
                >
                    {t('admin.common.cancel')}
                </button>
                <button
                    onclick={handleUpload}
                    class="btn btn-primary"
                    disabled={!selectedFile || isProcessing}
                >
                    {#if isProcessing}
                        {t('blog.auth.processing')}
                    {:else}
                        {t('admin.editor.insert_to_body')}
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

    .storage-info-banner {
        background-color: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e3a8a;
        padding: 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .upload-area {
        border: 2px dashed #d1d5db;
        border-radius: 0.375rem;
        padding: 2rem 1rem;
        text-align: center;
        background-color: #f9fafb;
        transition: all 0.2s ease;
    }

    .upload-area.dragover {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }

    .file-selected-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .file-selected-info .file-icon {
        font-size: 2rem;
    }

    .file-selected-info .file-name {
        font-weight: 600;
        font-size: 0.95rem;
        color: #1f2937;
        word-break: break-all;
    }

    .file-selected-info .file-size {
        font-size: 0.85rem;
        color: #6b7280;
    }

    .change-btn {
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: #ef4444;
        text-decoration: underline;
        background: none;
        border: none;
        cursor: pointer;
    }

    .file-input-wrapper {
        position: relative;
        cursor: pointer;
    }

    .file-input-wrapper input[type="file"] {
        position: absolute;
        inset: 0;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }

    .placeholder-text {
        color: #374151;
        font-size: 0.9rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .helper-text {
        color: #6b7280;
        font-size: 0.75rem;
    }

    .error-banner {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        line-height: 1.4;
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
