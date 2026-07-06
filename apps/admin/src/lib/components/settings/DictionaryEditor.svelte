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
    import { enhance } from "$app/forms";
    import { Save, Languages, Download, Upload } from "lucide-svelte";
    import { invalidateAll } from "$app/navigation";
    import { t } from "$lib/i18n.svelte";
    import { untrack } from "svelte";

    let { languages = [], ui_dictionary = {} } = $props();

    let saving = $state(false);
    let localDict = $state(untrack(() => JSON.parse(JSON.stringify(ui_dictionary))));

    let keys = $derived(Object.keys(localDict).sort());
    let groupedKeys = $derived(keys.reduce((acc, key) => {
        const parts = key.split('.');
        let groupName = 'common';
        if (parts.length > 1) {
            groupName = parts.slice(0, 2).join('.');
        }
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(key);
        return acc;
    }, {} as Record<string, string[]>));

    let expandedGroups = $state<Record<string, boolean>>({});
    let formElement: HTMLFormElement;

    $effect(() => {
        const newDictStr = JSON.stringify(ui_dictionary); // trigger on ui_dictionary change
        if (!saving) {
            untrack(() => {
                if (JSON.stringify(localDict) !== newDictStr) {
                    localDict = JSON.parse(newDictStr);
                }
            });
        }
    });

    const handleSubmit = () => {
        saving = true;
        return async ({ result }: { result: any }) => {
            saving = false;
            if (result.type === 'success') {
                await invalidateAll();
                alert(t('admin.lang.dict_success_saved', { default: '저장되었습니다.' }));
            } else {
                alert(t('admin.lang.dict_error_save_failed', { default: '저장 실패' }));
            }
        };
    };

    function ensureLangKey(key: string, langCode: string) {
        if (!localDict[key][langCode]) {
            localDict[key][langCode] = "";
        }
    }

    function exportDictionary() {
        const dataStr = JSON.stringify(localDict, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const exportFileDefaultName = `dictionary_backup_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', url);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        URL.revokeObjectURL(url);
    }

    let fileInput: HTMLInputElement;

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (typeof json !== 'object' || json === null) {
                    alert(t('admin.lang.dict_import_invalid', { default: '잘못된 파일' }));
                    return;
                }

                // 업로드 데이터에 포함된 언어 코드 수집
                const incomingLangs = new Set<string>();
                for (const translations of Object.values(json) as any[]) {
                    if (typeof translations === 'object' && translations !== null) {
                        for (const lang of Object.keys(translations)) {
                            incomingLangs.add(lang);
                        }
                    }
                }

                // 기존 데이터에 포함된 언어 코드 수집
                const existingLangs = new Set<string>();
                for (const translations of Object.values(localDict) as any[]) {
                    if (typeof translations === 'object' && translations !== null) {
                        for (const lang of Object.keys(translations)) {
                            existingLangs.add(lang);
                        }
                    }
                }

                // 중복 언어 감지
                const overlapping = [...incomingLangs].filter(l => existingLangs.has(l));

                let overwriteOverlapping = false;
                if (overlapping.length > 0) {
                    overwriteOverlapping = confirm(
                        t('admin.lang.dict_import_overlap', {
                            default: `중복되는 언어가 있습니다: ${overlapping.join(', ')}\n\n확인 → 기존 데이터를 덮어씁니다\n취소 → 기존 데이터를 유지하고 새 언어만 추가합니다`
                        })
                    );
                }

                // 머지 수행
                for (const [key, translations] of Object.entries(json) as [string, Record<string, string>][]) {
                    if (!localDict[key]) {
                        localDict[key] = translations;
                    } else {
                        for (const [lang, text] of Object.entries(translations)) {
                            if (overlapping.includes(lang)) {
                                if (overwriteOverlapping) {
                                    localDict[key][lang] = text;
                                }
                                // skip: 기존 값 유지
                            } else {
                                localDict[key][lang] = text; // 새 언어는 항상 추가
                            }
                        }
                    }
                }

                setTimeout(() => {
                    if (formElement) formElement.requestSubmit();
                }, 50);
            } catch (err) {
                alert(t('admin.lang.dict_import_fail', { default: '가져오기 실패' }) + err);
            }
        };
        reader.readAsText(file);
        input.value = '';
    }
</script>

<div class="card mt-8">
    <div class="header-flex">
        <div>
            <h2><Languages size={20} class="inline-icon" /> {t('admin.lang.dict_title')}</h2>
            <p class="description">{t('admin.lang.dict_desc')}</p>
        </div>
        <div class="backup-actions">
            <input 
                type="file" 
                accept=".json" 
                style="display: none" 
                bind:this={fileInput} 
                onchange={handleFileChange}
            />
            <button type="button" class="btn outline" onclick={() => fileInput.click()}>
                <Upload size={16} /> <span class="btn-text">{t('admin.lang.dict_import_json')}</span>
            </button>
            <button type="button" class="btn outline" onclick={exportDictionary}>
                <Download size={16} /> <span class="btn-text">{t('admin.lang.dict_export_json')}</span>
            </button>
        </div>
    </div>

    <form method="POST" action="?/saveDictionary" use:enhance={handleSubmit} class="dictionary-form" bind:this={formElement}>
        <input type="hidden" name="ui_dictionary" value={JSON.stringify(localDict)} />
        
        <div class="accordion-container">
            {#each Object.entries(groupedKeys) as [groupName, groupKeys]}
                <details class="dictionary-group" open={expandedGroups[groupName] === true} ontoggle={(e) => expandedGroups[groupName] = (e.currentTarget as HTMLDetailsElement).open}>
                    <summary class="group-header">
                        <span class="font-mono font-semibold text-slate-700">{groupName}</span>
                        <span class="badge">{t('admin.lang.dict_items_count', { count: groupKeys.length.toString() })}</span>
                    </summary>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th class="key-col">{t('admin.lang.dict_key_header')}</th>
                                    {#each languages as lang}
                                        <th class="lang-col">
                                            <div class="lang-header">
                                                <span class="font-mono text-sm uppercase">{lang.code}</span>
                                                <span class="lang-name">{lang.name}</span>
                                            </div>
                                        </th>
                                    {/each}
                                </tr>
                            </thead>
                            <tbody>
                                {#each groupKeys as key}
                                    <tr>
                                        <td class="key-cell font-mono text-[0.8rem] text-slate-600">
                                            {key}
                                        </td>
                                        {#each languages as lang}
                                            <td class="input-cell">
                                                <input 
                                                    type="text" 
                                                    class="dict-input"
                                                    bind:value={localDict[key][lang.code]} 
                                                    placeholder={t('admin.lang.dict_input_placeholder', { code: lang.code })}
                                                    oninput={() => ensureLangKey(key, lang.code)}
                                                />
                                            </td>
                                        {/each}
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </details>
            {/each}
        </div>

        <div class="actions mt-4">
            <button type="submit" class="btn primary" disabled={saving}>
                <Save size={16} /> {saving ? t('admin.settings.saving') : t('admin.lang.dict_save_btn')}
            </button>
        </div>
    </form>
</div>

<style>
    .card {
        background: white;
        border-radius: 0.75rem;
        border: 1px solid #e2e8f0;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .mt-8 { margin-top: 2rem; }
    
    .header-flex { 
        margin-bottom: 1.5rem; 
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }
    h2 { font-size: 1.25rem; margin: 0 0 0.5rem 0; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
    .description { font-size: 0.875rem; color: #64748b; margin: 0; }
    .inline-icon { color: #3b82f6; }

    .backup-actions {
        display: flex;
        gap: 0.5rem;
    }

    .dictionary-group {
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        overflow: hidden;
        background: #f8fafc;
    }
    
    .group-header {
        padding: 1rem 1.25rem;
        background: #f1f5f9;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-size: 1rem;
        user-select: none;
        transition: background 0.2s;
    }
    .group-header:hover {
        background: #e2e8f0;
    }
    .badge {
        background: #cbd5e1;
        color: #334155;
        font-size: 0.75rem;
        padding: 0.1rem 0.5rem;
        border-radius: 99px;
        font-weight: 600;
    }

    .dictionary-group[open] .group-header {
        border-bottom: 1px solid #e2e8f0;
    }

    .table-container {
        width: 100%;
        overflow-x: auto;
        background: white;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
    }

    th {
        background: #f8fafc;
        padding: 0.75rem 1rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
        white-space: nowrap;
    }
    th:last-child {
        border-right: none;
    }
    
    .lang-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .lang-name { color: #94a3b8; font-weight: 400; }

    td {
        padding: 0.5rem 1rem;
        border-bottom: 1px solid #f1f5f9;
        border-right: 1px solid #f1f5f9;
    }
    td:last-child { border-right: none; }
    tr:last-child td { border-bottom: none; }
    
    tr:hover td { background: #f8fafc; }

    .key-col { width: 180px; }
    
    .dict-input {
        width: 100%;
        padding: 0.4rem 0.5rem;
        border: 1px solid transparent;
        background: transparent;
        border-radius: 0.375rem;
        transition: all 0.2s;
        font-size: 0.875rem;
    }
    .dict-input:hover {
        background: #f1f5f9;
    }
    .dict-input:focus {
        background: #fff;
        border-color: #3b82f6;
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    
    .mt-4 { margin-top: 1rem; }
    .actions { display: flex; justify-content: flex-end; }
    
    .btn {
        padding: 0.6rem 1.5rem;
        border-radius: 0.375rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        border: none;
        font-size: 0.875rem;
        transition: all 0.2s;
    }
    .btn.primary {
        background: #10b981;
        color: white;
    }
    .btn.primary:hover:not(:disabled) {
        background: #059669;
        transform: translateY(-1px);
    }
    .btn.primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn.outline {
        background: white;
        border: 1px solid #e2e8f0;
        color: #475569;
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
        min-height: 2.2rem;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        word-break: keep-all;
    }
    .btn.outline .btn-text {
        display: inline-block;
        max-width: 90px;
    }
    .btn.outline:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #0f172a;
    }
</style>
