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
    import { t } from "$lib/i18n";
    let { isOpen = $bindable(false), imageUrl = $bindable(''), imageAlt = '' } = $props();

    function close() {
        isOpen = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            close();
        }
    }

    $effect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <div 
        class="modal-backdrop"
        onclick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
    >
        <!-- Close button -->
        <button 
            class="close-btn"
            onclick={close}
            aria-label="Close modal"
            type="button"
        >
            ×
        </button>

        <!-- Image -->
        <div class="image-container">
            <img 
                src={imageUrl} 
                alt={imageAlt}
                class="modal-image"
            />
        </div>

        <!-- Instructions -->
        <div class="instructions">
            {$t("blog.image_modal.close_hint", { default: "바깥을 클릭하거나 ESC를 눌러 닫기" })}
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease-out;
    }

    .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        color: white;
        font-size: 2.5rem;
        font-weight: 300;
        background: none;
        border: none;
        cursor: pointer;
        z-index: 10;
        line-height: 1;
        transition: color 0.2s;
    }
    .close-btn:hover {
        color: #ccc;
    }

    .image-container {
        max-width: 95vw;
        max-height: 95vh;
        padding: 1rem;
    }

    .modal-image {
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    .instructions {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.875rem;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
</style>
