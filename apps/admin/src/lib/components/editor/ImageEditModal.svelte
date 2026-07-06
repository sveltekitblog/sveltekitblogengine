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
    interface Props {
        isOpen?: boolean;
        currentSrc?: string;
        currentCaption?: string;
        currentAlignment?: string;
        onSave: (caption: string, alignment: string) => void;
        onDelete: () => void;
        onClose: () => void;
    }

    let {
        isOpen = $bindable(false),
        currentSrc = "",
        currentCaption = "",
        currentAlignment = "center",
        onSave,
        onDelete,
        onClose,
    }: Props = $props();

    let editCaption = $state("");
    let editAlignment = $state("center");
    let isDeleting = $state(false);

    // Sync props to local state when modal opens
    $effect(() => {
        if (isOpen) {
            editCaption = currentCaption || "";
            editAlignment = currentAlignment || "center";
            isDeleting = false;
        }
    });

    function handleSave() {
        onSave(editCaption, editAlignment);
    }

    function handleDelete() {
        if (confirm(t('admin.editor.confirm_delete', { default: "이미지를 삭제하시겠습니까?\n서버에서도 삭제됩니다." }))) {
            isDeleting = true;
            onDelete();
        }
    }
</script>

{#if isOpen}
    <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal-container" onclick={(e) => e.stopPropagation()}>
            <h2 class="modal-title">{t('admin.editor.modal_edit_title', { default: "이미지 설정 편집" })}</h2>

            <div class="modal-body">
                <!-- Preview -->
                <div class="preview-area">
                    <img
                        src={currentSrc}
                        alt={t('admin.editor.editing_alt', { default: "편집 중인 이미지" })}
                        class="preview-image"
                    />
                </div>

                <!-- Caption -->
                <div class="form-group">
                    <label class="block-label">{t('admin.editor.caption_label', { default: "캡션 (선택사항)" })}</label>
                    <input
                        type="text"
                        bind:value={editCaption}
                        class="text-input"
                        placeholder={t('admin.editor.caption_placeholder', { default: "이미지 아래에 표시될 설명" })}
                    />
                </div>

                <!-- Alignment -->
                <div class="form-group">
                    <label class="block-label">{t('admin.editor.alignment_label', { default: "이미지 정렬" })}</label>
                    <div class="alignment-options">
                        <label class="align-option">
                            <input
                                type="radio"
                                bind:group={editAlignment}
                                value="left"
                            />
                            <span>◀ {t('admin.theme.align_left')}</span>
                        </label>
                        <label class="align-option">
                            <input
                                type="radio"
                                bind:group={editAlignment}
                                value="center"
                            />
                            <span>◆ {t('admin.theme.align_center')}</span>
                        </label>
                        <label class="align-option">
                            <input
                                type="radio"
                                bind:group={editAlignment}
                                value="right"
                            />
                            <span>▶ {t('admin.theme.align_right')}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button
                    onclick={handleDelete}
                    class="btn btn-danger"
                    disabled={isDeleting}
                >
                    {#if isDeleting}
                        {t('admin.editor.deleting')}
                    {:else}
                        {t('admin.editor.delete_image', { default: "🗑️ 이미지 삭제" })}
                    {/if}
                </button>
                <div class="footer-right">
                    <button
                        onclick={onClose}
                        class="btn btn-secondary"
                        disabled={isDeleting}
                    >
                        {t('admin.common.cancel')}
                    </button>
                    <button
                        onclick={handleSave}
                        class="btn btn-primary"
                        disabled={isDeleting}
                    >
                        {t('admin.common.save')}
                    </button>
                </div>
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

    .preview-area {
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.5rem;
        text-align: center;
        background-color: #f9fafb;
    }

    .preview-image {
        max-height: 10rem;
        margin: 0 auto;
        border-radius: 0.25rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
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
        justify-content: space-between;
        align-items: center;
    }

    .footer-right {
        display: flex;
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

    .btn-danger {
        color: white;
        background-color: #ef4444;
        border: 1px solid transparent;
    }

    .btn-danger:hover:not(:disabled) {
        background-color: #dc2626;
    }
</style>
