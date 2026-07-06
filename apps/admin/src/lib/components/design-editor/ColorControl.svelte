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
    import { RefreshCw, Sliders } from "lucide-svelte";
    import { hexToOklch, oklchToHex } from "$lib/utils/color";

    let {
        label = "색상",
        value = $bindable("#000000"),
        showPresets = true,
        compact = false,
        onchange,
    } = $props<{
        label?: string;
        value?: string;
        showPresets?: boolean;
        compact?: boolean;
        onchange?: () => void;
    }>();

    // Mode: 'simple' (Hex) or 'oklch' (Advanced)
    let mode = $state(value?.startsWith("oklch") ? "oklch" : "simple");

    // Optional callback for immediate updates

    // OKLCH State (for sliders)
    let l = $state(70);
    let c = $state(0.1);
    let h = $state(0);
    let a = $state(1); // Alpha (0 to 1)
    let showAdvanced = $state(false);

    // Sync sliders from value if it's OKLCH
    $effect(() => {
        if (value?.startsWith("oklch")) {
            mode = "oklch";
            // Match oklch(L C H) or oklch(L C H / A)
            const match = value.match(
                /oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/,
            );
            if (match) {
                l = parseFloat(match[1]);
                c = parseFloat(match[2]);
                h = parseFloat(match[3]);
                if (match[4] !== undefined) {
                    a = parseFloat(match[4]);
                } else {
                    a = 1;
                }
            }
        }
    });

    function updateOkLch() {
        if (a < 1) {
            value = `oklch(${l}% ${c} ${h} / ${a})`;
        } else {
            value = `oklch(${l}% ${c} ${h})`;
        }
        onchange?.();
    }

    function setMode(newMode: "simple" | "oklch") {
        if (mode === newMode) return;
        if (newMode === "oklch") {
            // Hex -> OKLCH
            if (!value?.startsWith("oklch")) {
                const {
                    l: newL,
                    c: newC,
                    h: newH,
                } = hexToOklch(value || "#000000");
                l = newL;
                c = newC;
                h = newH;
                a = 1; // Reset alpha when coming from simple hex
                value = `oklch(${l}% ${c} ${h})`;
            }
            mode = "oklch";
        } else {
            // OKLCH -> Hex
            if (value?.startsWith("oklch")) {
                value = oklchToHex(l, c, h);
            }
            mode = "simple";
        }
        onchange?.(); // Notify change after conversion
    }

    // OKLCH Presets (converted to Hex for input type="color")
    // Values derived from a standard OKLCH palette
    const presets = [
        { hex: "#3b82f6", name: "Blue" }, // oklch(60% 0.15 250) approx
        { hex: "#10b981", name: "Green" }, // oklch(65% 0.15 150) approx
        { hex: "#f59e0b", name: "Amber" }, // oklch(75% 0.15 70) approx
        { hex: "#ef4444", name: "Red" }, // oklch(60% 0.18 25) approx
        { hex: "#8b5cf6", name: "Violet" }, // oklch(60% 0.18 290) approx
        { hex: "#ec4899", name: "Pink" }, // oklch(65% 0.18 330) approx
        { hex: "#0f172a", name: "Slate" }, // oklch(25% 0.05 260) approx
        { hex: "#ffffff", name: "White" },
    ];
</script>

<div class="color-control">
    <div class="header-row">
        <span class="control-label">{label}</span>
        <div class="mode-selector">
            <button
                type="button"
                class="mode-btn"
                class:active={mode === "simple"}
                onclick={() => setMode("simple")}
                title="Convert to Hex"
            >
                Hex
            </button>
            <button
                type="button"
                class="mode-btn"
                class:active={mode === "oklch"}
                onclick={() => setMode("oklch")}
                title="Convert to OKLCH"
            >
                OKLCH
            </button>
        </div>
    </div>

    {#if showPresets && mode === "simple"}
        <div class="color-presets">
            {#each presets as preset}
                <button
                    class="preset-btn"
                    style="background-color: {preset.hex}; border: 2px solid {value ===
                    preset.hex
                        ? '#000'
                        : 'transparent'}"
                    onclick={() => {
                        value = preset.hex;
                        onchange?.();
                    }}
                    title={preset.name}
                    aria-label={`Select ${preset.name}`}
                ></button>
            {/each}
        </div>
    {/if}

    <div class="input-row">
        {#if mode === "simple"}
            <input type="color" value={value || "#000000"} oninput={(e) => { value = e.currentTarget.value; onchange?.(); }} />
        {:else}
            <div class="oklch-preview" style="background-color: {value};"></div>
        {/if}
        <input type="text" bind:value oninput={() => onchange?.()} />
        {#if mode === "oklch"}
            <button
                class="advanced-toggle"
                onclick={() => (showAdvanced = !showAdvanced)}
                title="Toggle Advanced Sliders"
            >
                <Sliders size={16} class={showAdvanced ? "text-blue-500" : "text-slate-400"} />
            </button>
        {/if}
    </div>

    {#if mode === "oklch" && showAdvanced}
        <div class="oklch-sliders">
            <div class="slider-group">
                <label>
                    <span>L ({l}%)</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        bind:value={l}
                        oninput={updateOkLch}
                    />
                </label>
            </div>
            <div class="slider-group">
                <label>
                    <span>C ({c})</span>
                    <input
                        type="range"
                        min="0"
                        max="0.4"
                        step="0.01"
                        bind:value={c}
                        oninput={updateOkLch}
                    />
                </label>
            </div>
            <div class="slider-group">
                <label>
                    <span>H ({h})</span>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        bind:value={h}
                        oninput={updateOkLch}
                    />
                </label>
            </div>
            <div class="slider-group">
                <label>
                    <span>Alpha ({Math.round(a * 100)}%)</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        bind:value={a}
                        oninput={updateOkLch}
                    />
                </label>
            </div>
        </div>
    {/if}
</div>

<style>
    .color-control {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .control-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #64748b;
    }
    .mode-selector {
        display: flex;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 2px;
        gap: 2px;
    }
    .mode-btn {
        background: none;
        border: none;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        padding: 2px 8px;
        transition: all 0.15s ease;
        line-height: 1.2;
    }
    .mode-btn:hover {
        color: #334155;
    }
    .mode-btn.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .color-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-bottom: 0.25rem;
    }
    .preset-btn {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.1s;
    }
    .preset-btn:hover {
        transform: scale(1.1);
    }
    .input-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    input[type="color"] {
        flex: 0 0 40px;
        height: 38px;
        padding: 0;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        cursor: pointer;
        box-sizing: border-box;
    }
    .oklch-preview {
        flex: 0 0 40px;
        height: 38px;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        box-sizing: border-box;
    }
    input[type="text"] {
        flex: 1;
        height: 38px;
        padding: 0 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 0.9rem;
        font-family: monospace;
        min-width: 0;
        box-sizing: border-box;
    }
    .advanced-toggle {
        background: none;
        border: none;
        height: 38px;
        width: 38px;
        padding: 0.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        transition: all 0.2s;
        box-sizing: border-box;
    }
    .advanced-toggle:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
    }
    .oklch-sliders {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem;
        background: #f8fafc;
        border-radius: 4px;
    }
    .slider-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
    }
    .slider-group label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        font-size: 0.75rem;
        color: #64748b;
    }
    .slider-group label span {
        width: 50px;
    }
    .slider-group input {
        flex: 1;
    }
</style>
