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
    import { Palette, Check, Dices, X } from "lucide-svelte";
    import { onMount } from "svelte";
    import { t } from "$lib/i18n";

    interface DesignSlotInfo {
        allowVisitorSelection: boolean;
        currentSlotId: string;
        activeMode: string;
        availableSlots: Array<{ id: string; name: string }>;
    }

    let { designSlotInfo }: { designSlotInfo?: DesignSlotInfo } = $props();

    let isOpen = $state(false);
    let selectedModeOrSlot = $state<string>("1");
    let currentAppliedSlotId = $state<string>("1");

    function getCookie(name: string): string | null {
        if (typeof document === "undefined") return null;
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    onMount(() => {
        let saved = "";
        let isRandom = false;
        try {
            saved = localStorage.getItem("skbe_design_slot") || "";
            isRandom = localStorage.getItem("skbe_design_is_random") === "true";
        } catch (e) {}

        if (!saved) {
            saved = getCookie("skbe_design_slot") || "";
        }

        const available = designSlotInfo?.availableSlots?.map(s => s.id) || [];
        currentAppliedSlotId = saved && available.includes(saved) ? saved : (designSlotInfo?.currentSlotId || "1");

        if (isRandom || saved === "random") {
            selectedModeOrSlot = "random";
        } else if (saved && available.includes(saved)) {
            selectedModeOrSlot = saved;
        } else {
            selectedModeOrSlot = designSlotInfo?.currentSlotId || "1";
        }
    });

    function selectSlot(slotId: string) {
        if (slotId === "random") {
            const available = designSlotInfo?.availableSlots?.map(s => s.id) || ["1"];
            const randomId = available[Math.floor(Math.random() * available.length)];
            try {
                localStorage.setItem("skbe_design_slot", randomId);
                localStorage.setItem("skbe_design_is_random", "true");
            } catch (e) {}
            document.cookie = `skbe_design_slot=${randomId}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        } else {
            try {
                localStorage.setItem("skbe_design_slot", slotId);
                localStorage.removeItem("skbe_design_is_random");
            } catch (e) {}
            document.cookie = `skbe_design_slot=${slotId}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        selectedModeOrSlot = slotId;
        isOpen = false;
        // Clean reload: 애드센스 스크립트 라이프사이클과 DOM 메모리를 클린 리셋
        window.location.reload();
    }

    function toggleOpen() {
        isOpen = !isOpen;
    }

    // 바깥 클릭 시 닫기
    function handleBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains("switcher-backdrop")) {
            isOpen = false;
        }
    }
</script>

{#if designSlotInfo?.allowVisitorSelection && (designSlotInfo?.availableSlots?.length || 0) > 1}
    <div class="design-switcher-container">
        <!-- Floating Trigger Button -->
        <button
            type="button"
            class="floating-trigger"
            class:active={isOpen}
            onclick={toggleOpen}
            aria-label={$t("blog.design.aria_change", { default: "디자인 테마 변경" })}
            title={$t("blog.design.aria_change", { default: "디자인 테마 변경" })}
        >
            <Palette size={20} class="trigger-icon" />
            <span class="trigger-text">{$t("blog.design.trigger", { default: "디자인" })}</span>
        </button>

        <!-- Dropdown / Popover -->
        {#if isOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="switcher-backdrop" onclick={handleBackdropClick}></div>
            <div class="switcher-popover" role="dialog" aria-modal="true">
                <div class="popover-header">
                    <div class="header-title-wrap">
                        <Palette size={16} class="popover-title-icon" />
                        <span class="popover-title">{$t("blog.design.title", { default: "디자인 스타일 선택" })}</span>
                    </div>
                    <button
                        type="button"
                        class="btn-close"
                        onclick={() => (isOpen = false)}
                        aria-label={$t("blog.common.close", { default: "닫기" })}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div class="slots-list">
                    {#each designSlotInfo.availableSlots as slot}
                        {@const isCurrent = (selectedModeOrSlot === "random" && currentAppliedSlotId === slot.id) || selectedModeOrSlot === slot.id}
                        <button
                            type="button"
                            class="slot-option-btn"
                            class:selected={selectedModeOrSlot === slot.id}
                            onclick={() => selectSlot(slot.id)}
                        >
                            <div class="option-label-wrap">
                                <span class="slot-badge">{$t("blog.design.slot_prefix", { default: "슬롯" })} {slot.id}</span>
                                <span class="slot-name">{slot.name}</span>
                            </div>
                            {#if selectedModeOrSlot === slot.id}
                                <Check size={16} class="check-icon" />
                            {:else if isCurrent && selectedModeOrSlot === "random"}
                                <span class="current-indicator" title={$t("blog.design.active_badge", { default: "적용 중" })}>{$t("blog.design.active_badge", { default: "적용 중" })}</span>
                            {/if}
                        </button>
                    {/each}

                    <!-- 랜덤 선택 옵션 -->
                    <button
                        type="button"
                        class="slot-option-btn random-btn"
                        class:selected={selectedModeOrSlot === "random"}
                        onclick={() => selectSlot("random")}
                    >
                        <div class="option-label-wrap">
                            <Dices size={16} class="dices-icon" />
                            <span class="slot-name">{$t("blog.design.random", { default: "🎲 랜덤 디자인" })}</span>
                        </div>
                        {#if selectedModeOrSlot === "random"}
                            <Check size={16} class="check-icon" />
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .design-switcher-container {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .floating-trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 9999px;
        color: #1e293b;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05);
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
    }

    .floating-trigger:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        background: rgba(255, 255, 255, 0.95);
        border-color: #cbd5e1;
    }

    .floating-trigger.active {
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
        box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
    }

    .trigger-icon {
        flex-shrink: 0;
        transition: transform 0.3s ease;
    }

    .floating-trigger:hover .trigger-icon {
        transform: rotate(15deg);
    }

    .trigger-text {
        white-space: nowrap;
    }

    .switcher-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: transparent;
    }

    .switcher-popover {
        position: absolute;
        bottom: calc(100% + 0.75rem);
        right: 0;
        width: 250px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(226, 232, 240, 0.85);
        border-radius: 1rem;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(0, 0, 0, 0.04);
        padding: 0.75rem;
        z-index: 9999;
        animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popoverFadeIn {
        from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .popover-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.5rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid #f1f5f9;
    }

    .header-title-wrap {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        color: #475569;
    }

    .popover-title-icon {
        color: #3b82f6;
    }

    .popover-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #1e293b;
    }

    .btn-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 0.25rem;
        border-radius: 0.375rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
    }

    .btn-close:hover {
        background: #f1f5f9;
        color: #475569;
    }

    .slots-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .slot-option-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.5rem 0.625rem;
        border-radius: 0.5rem;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
        color: #334155;
    }

    .slot-option-btn:hover {
        background: #f8fafc;
        border-color: #e2e8f0;
    }

    .slot-option-btn.selected {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
        font-weight: 600;
    }

    .option-label-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        overflow: hidden;
    }

    .slot-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        background: #e2e8f0;
        color: #475569;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        white-space: nowrap;
    }

    .slot-option-btn.selected .slot-badge {
        background: #dbeafe;
        color: #1d4ed8;
    }

    .slot-name {
        font-size: 0.8125rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .dices-icon {
        color: #8b5cf6;
        flex-shrink: 0;
    }

    .check-icon {
        color: #3b82f6;
        flex-shrink: 0;
    }

    .current-indicator {
        font-size: 0.6875rem;
        color: #64748b;
        background: #f1f5f9;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        white-space: nowrap;
    }

    @media (max-width: 640px) {
        .design-switcher-container {
            bottom: 1rem;
            right: 1rem;
        }

        .floating-trigger {
            padding: 0.5rem 0.75rem;
            font-size: 0.8125rem;
        }

        .switcher-popover {
            width: 220px;
        }
    }
</style>
