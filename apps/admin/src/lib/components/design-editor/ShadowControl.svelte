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
    import ColorControl from "./ColorControl.svelte";

    let {
        value = $bindable("none"),
        label = "Box Shadow",
        defaultY = 4,
    } = $props();

    function normalizeShadow(shadow: string) {
        if (!shadow || shadow === "none") {
            return {
                x: 0,
                y: 0,
                blur: 4,
                spread: 2,
                color: "#3b82f6",
            };
        }

        const partsStr = shadow.trim().split(/\s+(?![^(]*\))/);
        const numbers = partsStr.filter((p) =>
            /^[-]?[\d.]+(px|em|rem)?$/.test(p),
        );
        const colorPart = partsStr.find(
            (p) => !/^[-]?[\d.]+(px|em|rem)?$/.test(p) && p !== "inset",
        );

        return {
            x: parseInt(numbers[0]) || 0,
            y: parseInt(numbers[1]) || 0,
            blur: parseInt(numbers[2]) || 0,
            spread: parseInt(numbers[3]) || 0,
            color: colorPart || "#3b82f6",
        };
    }

    function assembleShadow(parts: any) {
        const { x, y, blur, spread, color } = parts;
        return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }

    let parts = $state(normalizeShadow(value));

    $effect(() => {
        value = assembleShadow(parts);
    });

    $effect(() => {
        const currentString = assembleShadow(parts);
        if (value && value !== currentString && value !== "none") {
            parts = normalizeShadow(value);
        }
    });
</script>

<div class="shadow-editor-box shadow-control-container">
    <h4 class="section-title">
        {label}
    </h4>
    <div class="shadow-grid">
        <div class="input-group">
            <label class="detail-label">X (Horizontal)</label>
            <input
                type="number"
                bind:value={parts.x}
                class="shadow-input"
            />
        </div>
        <div class="input-group">
            <label class="detail-label">Y (Vertical)</label>
            <input
                type="number"
                bind:value={parts.y}
                class="shadow-input"
            />
        </div>
        <div class="input-group">
            <label class="detail-label">Blur</label>
            <input
                type="number"
                bind:value={parts.blur}
                class="shadow-input"
            />
        </div>
        <div class="input-group">
            <label class="detail-label">Spread</label>
            <input
                type="number"
                bind:value={parts.spread}
                class="shadow-input"
            />
        </div>
    </div>

    <div class="color-picker-section">
        <ColorControl label="Shadow Color" bind:value={parts.color} />
    </div>
</div>

<style>
    /* 컴포넌트 전체 컨테이너 */
    .shadow-editor-box {
        margin-top: 1rem;
        padding: 0.85rem;
        background-color: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
    }

    /* 섹션 제목 */
    .section-title {
        font-size: 0.7rem; /* depth-4 기준 */
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.75rem;
    }

    /* 2단 그리드 레이아웃 */
    .shadow-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        min-width: 0;
        overflow: hidden;
    }

    /* 입력 필드 그룹 */
    .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
    }

    /* 상세 레이블 (0.6rem) */
    .detail-label {
        font-size: 0.6rem;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    /* 입력 필드 스타일 */
    .shadow-input {
        width: 100%;
        padding: 0.4rem;
        font-size: 0.8rem;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background-color: #ffffff;
        min-width: 0;
    }

    /* 하단 색상 선택 섹션 */
    .color-picker-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
    }
</style>
