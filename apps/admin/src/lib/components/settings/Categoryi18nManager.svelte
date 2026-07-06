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
    import { Save, Plus, Trash2, Edit2, Check, X } from 'lucide-svelte';
    import { t } from "$lib/i18n.svelte";
    
    let { categories = [], languages = [] } = $props<{ categories: any[], languages: any[] }>();

    // Group categories by slug
    // Format: { slug: { translations: { ko: name, en: name } } }
    let categoryGroups = $derived.by(() => {
        const newGroups: Record<string, { translations: Record<string, string> }> = {};
        for (const cat of categories) {
            if (!newGroups[cat.slug]) {
                newGroups[cat.slug] = { translations: {} };
            }
            newGroups[cat.slug].translations[cat.lang] = cat.name;
        }
        return newGroups;
    });

    let isAdding = $state(false);
    let newSlug = $state("");
    let newTranslations = $state<Record<string, string>>({});

    let editingSlug = $state<string | null>(null);
    let editTranslations = $state<Record<string, string>>({});

    let saving = $state(false);
    let errorMessage = $state("");
    let successMessage = $state("");

    function startAdd() {
        isAdding = true;
        newSlug = "";
        newTranslations = {};
        for (const lang of languages) {
            newTranslations[lang.code] = "";
        }
    }

    function cancelAdd() {
        isAdding = false;
    }

    function startEdit(slug: string) {
        editingSlug = slug;
        editTranslations = { ...categoryGroups[slug].translations };
        // Ensure all language keys exist
        for (const lang of languages) {
            if (!editTranslations[lang.code]) {
                editTranslations[lang.code] = "";
            }
        }
    }

    function cancelEdit() {
        editingSlug = null;
    }

    async function saveCategoryGroup(slug: string, translations: Record<string, string>, isNew: boolean = false) {
        if (!slug || slug.trim() === '') {
            errorMessage = t('admin.lang.cat_error_slug_required');
            return;
        }

        saving = true;
        errorMessage = "";
        successMessage = "";

        // Prepare payload: array of {lang, name}
        const payloadTrans = Object.entries(translations)
            .map(([lang, name]) => ({ lang, name: name.trim() }))
            .filter(t => t.name !== '');

        if (payloadTrans.length === 0) {
            errorMessage = t('admin.lang.cat_error_at_least_one');
            saving = false;
            return;
        }

        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_category_group',
                    payload: { slug, translations: payloadTrans }
                })
            });

            if (res.ok) {
                successMessage = t('admin.lang.cat_success_saved');
                if (isNew) {
                    isAdding = false;
                } else {
                    editingSlug = null;
                }
                setTimeout(() => window.location.reload(), 1000);
            } else {
                const data = await res.json();
                errorMessage = data.error || t('admin.lang.cat_error_save_failed');
            }
        } catch (e: any) {
            errorMessage = e.message;
        } finally {
            saving = false;
        }
    }

    async function deleteCategoryGroup(slug: string) {
        if (!confirm(t('admin.lang.cat_delete_confirm', { slug }))) return;

        saving = true;
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_category_group',
                    payload: { slug }
                })
            });

            if (res.ok) {
                // Remove from local state
                const copy = { ...categoryGroups };
                delete copy[slug];
                categoryGroups = copy;
            } else {
                const data = await res.json();
                alert(data.error || t('admin.lang.cat_error_delete_failed'));
            }
        } catch(e: any) {
            alert(e.message);
        } finally {
            saving = false;
        }
    }
</script>

<div class="category-manager card">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h2>{t('admin.lang.cat_title')}</h2>
            <p class="text-slate-500 text-sm mt-1">{t('admin.lang.cat_subtitle')}</p>
        </div>
        <button class="btn primary" onclick={startAdd}>
            <Plus size={16} /> {t('admin.lang.cat_add_group')}
        </button>
    </div>

    {#if errorMessage}
        <div class="alert error mb-4">{errorMessage}</div>
    {/if}
    {#if successMessage}
        <div class="alert success mb-4">{successMessage}</div>
    {/if}

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="slug-col">{t('admin.lang.cat_slug_header')}</th>
                    {#each languages as lang}
                        <th>
                            <span class="lang-code">{lang.code.toUpperCase()}</span>
                            <span class="lang-name">{lang.name}</span>
                        </th>
                    {/each}
                    <th class="actions-col">{t('admin.interactions.col_actions')}</th>
                </tr>
            </thead>
            <tbody>
                {#if isAdding}
                    <tr class="add-row fade-in">
                        <td>
                            <input type="text" bind:value={newSlug} placeholder={t('admin.lang.cat_slug_placeholder')} class="w-full" />
                        </td>
                        {#each languages as lang}
                            <td>
                                <input type="text" bind:value={newTranslations[lang.code]} placeholder={t('admin.lang.cat_name_placeholder', { name: lang.name })} class="w-full" />
                            </td>
                        {/each}
                        <td class="actions-cell">
                            <button class="btn icon primary" disabled={saving} onclick={() => saveCategoryGroup(newSlug, newTranslations, true)} title={t('admin.common.save')}>
                                <Check size={16} />
                            </button>
                            <button class="btn icon danger" disabled={saving} onclick={cancelAdd} title={t('blog.common.cancel')}>
                                <X size={16} />
                            </button>
                        </td>
                    </tr>
                {/if}

                {#each Object.entries(categoryGroups) as [slug, group]}
                    <tr>
                        <td class="slug-cell">
                            <code>{slug}</code>
                        </td>
                        {#each languages as lang}
                            <td>
                                {#if editingSlug === slug}
                                    <input type="text" bind:value={editTranslations[lang.code]} class="w-full" />
                                {:else}
                                    <span class={group.translations[lang.code] ? 'text-slate-800' : 'text-slate-400 italic font-light'}>
                                        {group.translations[lang.code] || t('admin.lang.cat_untranslated')}
                                    </span>
                                {/if}
                            </td>
                        {/each}
                        <td class="actions-cell">
                            {#if editingSlug === slug}
                                <button class="btn icon primary" disabled={saving} onclick={() => saveCategoryGroup(slug, editTranslations)} title={t('admin.common.save')}>
                                    <Save size={16} />
                                </button>
                                <button class="btn icon danger" disabled={saving} onclick={cancelEdit} title={t('blog.common.cancel')}>
                                    <X size={16} />
                                </button>
                            {:else}
                                <button class="btn icon" disabled={saving} onclick={() => startEdit(slug)} title={t('admin.lang.cat_edit_tooltip')}>
                                    <Edit2 size={16} />
                                </button>
                                <button class="btn icon danger" disabled={saving} onclick={() => deleteCategoryGroup(slug)} title={t('admin.lang.cat_delete_tooltip')}>
                                    <Trash2 size={16} />
                                </button>
                            {/if}
                        </td>
                    </tr>
                {/each}
                {#if Object.keys(categoryGroups).length === 0 && !isAdding}
                    <tr>
                        <td colspan={languages.length + 2} class="text-center p-8 text-slate-500">
                            {t('admin.lang.cat_empty_msg')}
                        </td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
</div>

<style>
    .card { background: white; border-radius: 0.75rem; border: 1px solid #e2e8f0; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 2rem; }
    h2 { font-size: 1.25rem; margin: 0; color: #0f172a; }
    
    .table-container { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: 1rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    th { background: #f8fafc; font-size: 0.8rem; font-weight: 600; color: #64748b; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #fcfcfc; }
    
    .slug-col { width: 15%; }
    .actions-col { width: 100px; text-align: center; }
    
    .slug-cell code { background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; color: #0f172a; border: 1px solid #e2e8f0; }
    
    .lang-code { background: #e0e7ff; color: #3730a3; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700; margin-right: 0.25rem; }
    
    input[type="text"] { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    input[type="text"]:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
    
    .actions-cell { display: flex; gap: 0.5rem; justify-content: center; }
    
    .btn { padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; border: none; font-size: 0.875rem; transition: all 0.2s; }
    .btn.primary { background: #10b981; color: white; }
    .btn.primary:hover { background: #059669; }
    .btn.icon { padding: 0.5rem; background: #f1f5f9; color: #475569; }
    .btn.icon:hover { background: #e2e8f0; color: #0f172a; }
    .btn.icon.primary { background: #ecfdf5; color: #10b981; }
    .btn.icon.primary:hover { background: #d1fae5; color: #059669; }
    .btn.icon.danger { color: #ef4444; background: #fef2f2; }
    .btn.icon.danger:hover { background: #fee2e2; color: #b91c1c; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .alert { padding: 1rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; }
    .alert.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .alert.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    
    .add-row { background: #fffbeb !important; }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; background-color: #fcd34d; } to { opacity: 1; background-color: #fffbeb; } }
</style>
