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
    import GradientBuilder from "./GradientBuilder.svelte";
    import { processImage } from "$lib/utils/image";
    import { Upload } from "lucide-svelte";
    import { t } from "$lib/i18n.svelte";

    let {
        title = "배경 설정",
        typeLabel = "",
        config = $bindable(),
        gradientState = $bindable({ stops: ["#3b82f6", "#1e3a8a"], angle: 180 }),
        allowInherit = false,
        compact = false,
        isMobileSection = false,
    } = $props<{
        title: string;
        typeLabel?: string;
        config: any;
        gradientState: { stops: string[]; angle: number };
        allowInherit?: boolean;
        compact?: boolean;
        isMobileSection?: boolean;
    }>();

    import { untrack } from "svelte";
    let isInitialized = $state(false);

    // 각 컴포넌트 영역별 배경 격리 보존을 위한 메모리 맵 $state 선언
    let bgMemoryMap = $state({
        solid: config.type === "solid" ? config.value : "#ffffff",
        gradient: config.type === "gradient" ? config.value : "linear-gradient(90deg, #3b82f6, #06b6d4)",
        gradientState: config.type === "gradient" 
            ? { angle: gradientState.angle, stops: [...gradientState.stops] } 
            : { angle: 90, stops: ["#3b82f6", "#06b6d4"] },
        image: config.type === "image" ? config.value : ""
    });

    function updateGradientValue() {
        if (!isInitialized) return;
        untrack(() => {
            if (config.type === "gradient") {
                const stopsStr = gradientState.stops.join(", ");
                config.value = `linear-gradient(${gradientState.angle}deg, ${stopsStr})`;
                // Svelte 5 $effect 무한루프 방지를 위해 명시적 이벤트 갱신 시점에 백업 (딥카피 포함)
                bgMemoryMap.gradient = config.value;
                bgMemoryMap.gradientState = { angle: gradientState.angle, stops: [...gradientState.stops] };
            }
        });
    }

    // Svelte 5 initialization effect
    $effect(() => {
        if (!isInitialized) {
            untrack(() => {
                // Initialize state from config if it exists
                if (
                    config.type === "gradient" &&
                    config.value &&
                    config.value.includes("linear-gradient")
                ) {
                    try {
                        const match = config.value.match(
                            /linear-gradient\(([\d.]+)deg,\s*(.+)\)/,
                        );
                        if (match) {
                            const angle = parseFloat(match[1]);
                            const stops = match[2].split(",").map((s) => s.trim());
                            gradientState = { angle, stops };
                        }
                    } catch (e) {
                        console.warn("Failed to parse gradient config:", e);
                    }
                }
                isInitialized = true;
            });
        }
    });

    let isUploading = $state(false);

    async function handleFileUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];
        // Simple prompt for filename to ensure semantic naming
        const filename = prompt(
            t("admin.theme.bg_filename_prompt"),
            file.name.split(".")[0],
        );
        if (!filename) return;

        isUploading = true;

        try {
            // Client-side processing
            const { desktop, mobile, original } = await processImage(file);

            // Parallel uploads to 'design' folder
            const uploadVariant = async (blob: Blob, variant: string) => {
                const formData = new FormData();
                formData.append("file", blob);
                formData.append("folder", `design/${variant}`);
                formData.append("filename", `${filename}.webp`); // All converted to webp

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) throw new Error(`${variant} upload failed`);
                return res.json();
            };

            const [desktopRes] = await Promise.all([
                uploadVariant(desktop, "desktop"),
                uploadVariant(mobile, "mobile"),
                // uploadVariant(original, "original"), // Design assets don't need original
            ]);

            // Set the desktop URL as the value
            config.value = desktopRes.url;
            bgMemoryMap.image = desktopRes.url;
        } catch (err) {
            console.error(err);
            alert((t('admin.theme.bg_upload_fail', { default: "이미지 업로드 실패: " }) || "이미지 업로드 실패: ") + err);
        } finally {
            isUploading = false;
            input.value = ""; // Reset
        }
    }

    function handleTypeChange() {
        const prevColor = (config.value && String(config.value).startsWith("#")) ? config.value : null;

        if (config.type === "solid") {
            config.value = bgMemoryMap.solid;
        } else if (config.type === "gradient") {
            config.value = bgMemoryMap.gradient;
            // 복구 시에도 stops 배열 참조가 공유되지 않도록 딥카피(배열 복제)하여 할당
            gradientState = { angle: bgMemoryMap.gradientState.angle, stops: [...bgMemoryMap.gradientState.stops] };
        } else if (config.type === "image") {
            config.value = bgMemoryMap.image;
        } else if (config.type === "js") {
            config.value = "js"; // Flag or placeholder
            if (config.jsCode === undefined) config.jsCode = "";
            if (config.fallbackColor === undefined) {
                config.fallbackColor = prevColor || "#ffffff";
            }
        } else if (config.type === "inherit") {
            config.value = "";
        }

        // Initialize effects if missing
        if (config.opacity === undefined) config.opacity = 1;
        if (config.blur === undefined) config.blur = 0;
    }

    // solid와 image 속성은 config.value로부터 안전하게 맵에 백업하기 위해 단순 단방향 추적 $effect 적용
    $effect(() => {
        if (config.type === "solid") {
            bgMemoryMap.solid = config.value;
        } else if (config.type === "image") {
            bgMemoryMap.image = config.value;
        }
    });
</script>

<section class="config-section" class:compact>
    <h3>{title}</h3>
    <div class="bg-settings">
        <!-- Type Selection -->
        <div class="form-group-mini">
            <label for="bg-type-select">{typeLabel || t('admin.theme.bg_type')}</label>
            <select
                id="bg-type-select"
                value={config.type}
                onchange={(e) => { config.type = e.currentTarget.value; handleTypeChange(); }}
            >
                {#if allowInherit}
                    <option value="inherit">{t('admin.theme.bg_inherit')}</option>
                {/if}
                <option value="solid">{t('admin.theme.bg_solid')}</option>
                <option value="gradient">{t('admin.theme.bg_gradient')}</option>
                <option value="image">{t('admin.theme.bg_image_url')}</option>
                <option value="js">Custom JavaScript</option>
            </select>
        </div>

        <!-- Effects (Always show if not inherit) -->
        {#if config.type !== "inherit"}
            <!-- 1. 비주얼 레이어 그룹 -->
            <div class="settings-card">
                <h4 class="settings-card-title">{t('admin.theme.visual_layer_group') || "비주얼 레이어 설정"}</h4>
                <div class="settings-grid">
                    <div class="form-group-mini">
                        <label class="label-flex">
                            <span>{t('admin.theme.opacity') || "레이어 불투명도"}</span>
                            <span class="text-mono">{Math.round((config.opacity ?? 1) * 100)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.01" 
                            bind:value={config.opacity} 
                            class="range-slider"
                        />
                    </div>
                    <div class="form-group-mini">
                        <label class="label-flex">
                            <span>{t('admin.theme.layer_blur') || "레이어 블러"}</span>
                            <span class="text-mono">{config.layerBlur ?? 0}px</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" max="20" step="1" 
                            bind:value={config.layerBlur} 
                            class="range-slider"
                        />
                    </div>
                </div>
            </div>

            <!-- 2. 유리창 효과 그룹 -->
            <div class="settings-card">
                <h4 class="settings-card-title">{t('admin.theme.glass_layer_group') || "유리창 효과 설정"}</h4>
                <div class="settings-grid margin-bottom">
                    <div class="form-group-mini">
                        <label class="label-flex">
                            <span>{t('admin.theme.blur') || "배경 블러"}</span>
                            <span class="text-mono">{config.blur ?? 0}px</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" max="20" step="1" 
                            bind:value={config.blur} 
                            class="range-slider"
                        />
                    </div>
                    <div class="form-group-mini">
                        <label class="label-flex">
                            <span>{t('admin.theme.overlay_opacity') || "유리창 틴트 농도"}</span>
                            <span class="text-mono">{Math.round((config.overlayOpacity ?? 0) * 100)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.01" 
                            bind:value={config.overlayOpacity} 
                            class="range-slider"
                        />
                    </div>
                </div>
                <ColorControl 
                    label={t('admin.theme.overlay_color') || "유리창 틴트 색상"} 
                    bind:value={config.overlayColor} 
                    showPresets={false} 
                />
            </div>
        {/if}

        <div class="form-group-mini">
            <label>
                {#if config.type === "inherit"}
                    {t('admin.theme.bg_no_setting')}
                {:else if config.type === "solid"}
                    {t('admin.theme.bg_color')}
                {:else if config.type === "gradient"}
                    {t('admin.theme.bg_gradient_builder')}
                {:else}
                    {t('admin.theme.bg_image_url')}
                {/if}
            </label>

            {#if config.type === "inherit"}
                <p class="hint">{t('admin.theme.bg_inherit_hint')}</p>
            {:else if config.type === "solid"}
                <ColorControl
                    label=""
                    bind:value={config.value}
                    showPresets={false}
                />
            {:else if config.type === "gradient"}
                <GradientBuilder
                    bind:state={gradientState}
                    onUpdate={updateGradientValue}
                />
                <div class="css-preview">
                    <code>{config.value}</code>
                </div>
            {:else if config.type === "js"}
                <div class="js-hint-box">
                    <p class="js-hint-title">JavaScript Background</p>
                    <p class="js-hint-desc">{t('admin.theme.bg_js_desc', { default: "배경 설정 탭 하단의 코드 에디터에서 JS 코드를 작성하고 관리할 수 있습니다." })}</p>
                    
                    <div style="margin-bottom: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                        <ColorControl 
                            label={t('admin.theme.fallback_color', { default: "애니메이션 대체/배경 색상" })} 
                            bind:value={config.fallbackColor} 
                            showPresets={false} 
                        />
                    </div>

                </div>
            {:else}
                <div class="url-input-group">
                    <input
                        type="text"
                        bind:value={config.value}
                        placeholder="https://example.com/image.jpg"
                        class="url-input"
                    />
                    <button
                        class="btn-upload"
                        onclick={() =>
                            document.getElementById(`upload-${title}`)?.click()}
                        disabled={isUploading}
                    >
                        {#if isUploading}
                            ...
                        {:else}
                            <Upload size={16} />
                        {/if}
                    </button>
                    <input
                        type="file"
                        id={`upload-${title}`}
                        style="display: none;"
                        accept="image/*"
                        onchange={handleFileUpload}
                    />
                </div>
            {/if}
        </div>
        
    </div>
</section>

<style>
    .config-section {
        margin-bottom: 1.25rem;
        padding-bottom: 1.25rem;
        border-bottom: 1px solid #e2e8f0;
    }
    .config-section.compact {
        margin-bottom: 0.5rem;
        padding-bottom: 0.5rem;
        border-bottom: none;
    }
    .config-section h3 {
        font-size: 0.9rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 0.75rem;
    }
    .config-section.compact h3 {
        font-size: 0.85rem;
        margin-bottom: 0.4rem;
    }
    .bg-settings {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .form-group-mini {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .form-group-mini label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #64748b;
    }
    select,
    .url-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        background-color: white;
        font-size: 0.9rem;
    }
    .url-input-group {
        display: flex;
        gap: 0.5rem;
    }
    .btn-upload {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        cursor: pointer;
        color: #64748b;
    }
    .btn-upload:hover {
        background: #e2e8f0;
    }
    .hint {
        font-size: 0.85rem;
        color: #94a3b8;
        font-style: italic;
    }
    .css-preview {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: #f1f5f9;
        border-radius: 4px;
        font-size: 0.75rem;
        color: #64748b;
        word-break: break-all;
    }

    /* Settings Cards & Visual Layer styling to replace Tailwind */
    .settings-card {
        margin-bottom: 1rem;
        padding: 1rem;
        background: #f8fafc; /* bg-gray-50 */
        border: 1px solid #e2e8f0; /* border-gray-200 */
        border-radius: 0.5rem; /* rounded-lg */
    }
    .settings-card-title {
        font-size: 0.875rem; /* text-sm */
        font-weight: 700; /* font-bold */
        color: #334155; /* text-gray-700 */
        margin-bottom: 0.75rem; /* mb-3 */
        margin-top: 0;
    }
    .settings-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr); /* grid-cols-2 */
        gap: 1rem; /* gap-4 */
    }
    .settings-grid.margin-bottom {
        margin-bottom: 1rem; /* mb-4 */
    }
    .label-flex {
        display: flex;
        justify-content: space-between; /* flex justify-between */
        align-items: center;
        width: 100%;
    }
    .text-mono {
        font-family: monospace; /* font-mono */
        font-size: 0.75rem; /* text-xs */
        color: #64748b;
    }
    .range-slider {
        width: 100%; /* w-full */
        height: 6px; /* h-1.5 */
        background-color: #e2e8f0; /* bg-gray-200 */
        border-radius: 0.25rem; /* rounded-lg */
        appearance: none;
        cursor: pointer;
        outline: none;
    }
    /* Simple styling to customize range input track and thumb */
    .range-slider::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 0.25rem;
    }
    .range-slider::-webkit-slider-thumb {
        appearance: none;
        height: 14px;
        width: 14px;
        border-radius: 50%;
        background: #3b82f6; /* accent-blue-600 / blue-600 */
        border: 1px solid #2563eb;
        margin-top: -4px; /* center it */
        cursor: pointer;
        transition: transform 0.1s;
    }
    .range-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
    }
    .range-slider::-moz-range-thumb {
        height: 14px;
        width: 14px;
        border-radius: 50%;
        background: #3b82f6;
        border: 1px solid #2563eb;
        cursor: pointer;
        transition: transform 0.1s;
    }
    .range-slider::-moz-range-thumb:hover {
        transform: scale(1.15);
    }
    
    /* JS Background Hint Styling */
    .js-hint-box {
        padding: 0.75rem; /* p-3 */
        background-color: #eff6ff; /* bg-blue-50 */
        border: 1px solid #dbeafe; /* border-blue-100 */
        border-radius: 0.5rem; /* rounded-lg */
        color: #1d4ed8; /* text-blue-700 */
        font-size: 0.75rem; /* text-xs */
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .js-hint-title {
        font-weight: 700; /* font-bold */
        margin-bottom: 0.25rem; /* mb-1 */
        margin-top: 0;
    }
    .js-hint-desc {
        margin: 0;
    }
    
    /* Checkbox & Labels */
    .checkbox-label {
        display: flex;
        align-items: center; /* flex items-center */
        gap: 0.5rem; /* gap-2 */
        font-weight: 600; /* font-semibold */
        font-size: 0.75rem; /* text-xs */
        color: #334155; /* text-gray-700 */
        cursor: pointer; /* cursor-pointer */
        user-select: none;
    }
    .checkbox-label.text-blue {
        color: #1e40af; /* text-blue-800 */
        margin-top: 0.5rem; /* mt-2 */
    }
    .checkbox-input {
        width: 14px;
        height: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 0.25rem; /* rounded */
        cursor: pointer;
        accent-color: #2563eb; /* text-blue-600 focus:ring-blue-500 */
    }
    
    /* Mobile Background Toggle Section */
    .mobile-toggle-section {
        margin-top: 1rem; /* mt-4 */
        padding-top: 1rem; /* pt-4 */
        border-top: 1px dashed #e2e8f0; /* border-t border-dashed border-gray-200 */
    }
    .mobile-settings-wrapper {
        margin-top: 1rem; /* mt-4 */
        padding: 1rem; /* p-4 */
        background-color: #f8fafc; /* bg-gray-50 */
        border: 1px solid #e2e8f0; /* border-gray-200 */
        border-radius: 0.5rem; /* rounded-lg */
    }
</style>
