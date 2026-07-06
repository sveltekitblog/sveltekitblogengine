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
    import { Plus, Trash2 } from "lucide-svelte";
    import { t } from "$lib/i18n.svelte";

    let {
        state = $bindable({ stops: [] as string[], angle: 180 }),
        onUpdate = () => {},
    } = $props<{
        state: { stops: string[]; angle: number };
        onUpdate?: () => void;
    }>();

    import ColorControl from "./ColorControl.svelte";

    function addStop() {
        if (state.stops.length < 4) {
            // Default new stops to OKLCH White
            state.stops = [...state.stops, "oklch(100% 0 0)"];
            triggerUpdate();
        }
    }

    function removeStop(index: number) {
        if (state.stops.length > 2) {
            state.stops = state.stops.filter(
                (_: string, i: number) => i !== index,
            );
            triggerUpdate();
        }
    }

    function triggerUpdate() {
        onUpdate();
    }
</script>

<div class="gradient-builder">
    <div class="stops-list">
        {#each state.stops as stop, i}
            <div class="stop-row">
                <div class="stop-control">
                    <ColorControl
                        label="Stop {i + 1}"
                        bind:value={state.stops[i]}
                        showPresets={false}
                        compact={true}
                        onchange={triggerUpdate}
                    />
                </div>
                <button
                    class="btn-icon-mini"
                    onclick={() => removeStop(i)}
                    disabled={state.stops.length <= 2}
                    aria-label="Remove stop"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        {/each}
        {#if state.stops.length < 4}
            <button
                class="btn-add-stop"
                onclick={addStop}
                aria-label="Add stop"
            >
                <Plus size={14} />
                <span>Add Stop</span>
            </button>
        {/if}
    </div>

    <div class="angle-control">
        <label for="angle-range">{t("admin.theme.gradient_angle", { default: "각도" })}</label>
        <div class="angle-inputs">
            <input
                id="angle-range"
                type="range"
                min="0"
                max="360"
                value={state?.angle || 0}
                oninput={(e) => { if(state) state.angle = parseInt(e.currentTarget.value); triggerUpdate(); }}
            />
            <input
                type="number"
                min="0"
                max="360"
                value={state?.angle || 0}
                oninput={(e) => { if(state) state.angle = parseInt(e.currentTarget.value); triggerUpdate(); }}
                class="angle-num"
            />
            <span>°</span>
        </div>
    </div>
</div>

<style>
    .gradient-builder {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem;
        background: #f8fafc;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
    }
    .stops-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
        min-width: 0;
        width: 100%;
    }
    .stop-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.5rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
    }
    .stop-control {
        flex: 1;
        min-width: 0;
    }
    .btn-icon-mini {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 0;
        height: 38px;
        width: 38px;
        margin-top: 1.35rem; /* Align with input row */
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
        box-sizing: border-box;
        flex-shrink: 0;
    }
    .btn-icon-mini:hover {
        color: #ef4444;
    }
    .btn-icon-mini:disabled {
        opacity: 0.3;
        pointer-events: none;
    }
    .btn-add-stop {
        width: 100%;
        padding: 0.5rem;
        border: 1px dashed #cbd5e1;
        background: white;
        color: #64748b;
        border-radius: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
        box-sizing: border-box;
    }
    .btn-add-stop:hover {
        border-color: #3b82f6;
        color: #3b82f6;
    }
    .angle-control {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .angle-control label {
        font-size: 0.85rem;
        color: #64748b;
        min-width: 30px;
        flex-shrink: 0;
    }
    .angle-inputs {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        box-sizing: border-box;
    }
    input[type="range"] {
        flex: 1;
        width: 100%;
        min-width: 0;
        margin: 0;
    }
    .angle-num {
        width: 50px;
        padding: 0.25rem;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 0.9rem;
        text-align: center;
        box-sizing: border-box;
        flex-shrink: 0;
    }
</style>
