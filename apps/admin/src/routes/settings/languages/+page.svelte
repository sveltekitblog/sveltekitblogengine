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
    import type { PageData } from "./$types";
    import { enhance } from "$app/forms";
    import { Save, Plus, Trash2, Globe, AlertCircle } from "lucide-svelte";
    import Categoryi18nManager from "$lib/components/settings/Categoryi18nManager.svelte";
    import DictionaryEditor from "$lib/components/settings/DictionaryEditor.svelte";
    import { t } from "$lib/i18n.svelte";

    let { data } = $props<{ data: PageData }>();
    let languages = $derived(data.languages);
    let categories = $derived(data.categories);
    let ui_dictionary = $derived(data.ui_dictionary);

    let isAdding = $state(false);
</script>

<div class="header">
    <h1><Globe size={32} /> {t("admin.lang.title")}</h1>
    <p>{t("admin.lang.subtitle")}</p>
</div>

<div class="card">
    <div class="flex justify-between items-center mb-4">
        <h2>{t("admin.lang.list_title")}</h2>
        <div class="flex gap-2">
            <form method="POST" action="?/forceSync" use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === 'success') {
                        alert(t('admin.languages.sync_success_alert'));
                    } else if (result.type === 'failure') {
                        alert(t('admin.languages.sync_fail_alert'));
                    } else if (result.type === 'error') {
                        alert(t('admin.languages.sync_fail_alert') + ': ' + result.error.message);
                    }
                };
            }}>
                <button type="submit" class="btn warning flex items-center gap-1.5" title={t("admin.languages.force_sync_tooltip")}>
                    <span>🔄</span>
                    {t("admin.languages.force_sync_btn")}
                </button>
            </form>
            <button class="btn primary" onclick={() => (isAdding = !isAdding)}>
                <Plus size={16} />
                {t("admin.lang.add_btn")}
            </button>
        </div>
    </div>

    {#if isAdding}
        <div class="edit-box fade-in">
            <h3>{t("admin.lang.add_form_title")}</h3>
            <form method="POST" action="?/save" use:enhance>
                <input type="hidden" name="action" value="add" />
                <div class="form-grid">
                    <div class="form-group">
                        <label>{t("admin.lang.code_label")}</label>
                        <input
                            type="text"
                            name="code"
                            required
                            placeholder={t("admin.lang.code_placeholder")}
                        />
                    </div>
                    <div class="form-group">
                        <label>{t("admin.lang.name_label")}</label>
                        <input type="text" name="name" required />
                    </div>
                    <div class="form-group full-width">
                        <label>{t("admin.lang.fallback_label")}</label>
                        <input
                            type="text"
                            name="fallback_message"
                            required
                            placeholder={t("admin.languages.fallback_message_placeholder", { default: "예: This post has not been translated yet. Displaying the original text." })}
                        />
                    </div>
                    <div class="form-group check">
                        <label>
                            <input
                                type="checkbox"
                                name="is_default"
                                value="true"
                            />
                            {t("admin.lang.set_default")}
                        </label>
                    </div>
                </div>
                <div class="actions mt-4">
                    <button
                        type="button"
                        class="btn text"
                        onclick={() => (isAdding = false)}
                        >{t("admin.common.cancel")}</button
                    >
                    <button type="submit" class="btn primary"
                        ><Save size={16} /> {t("admin.lang.add_submit")}</button
                    >
                </div>
            </form>
        </div>
    {/if}

    <div class="lang-list">
        {#each languages as lang}
            <div class="lang-item">
                <form
                    method="POST"
                    action="?/save"
                    use:enhance
                    class="flex-form"
                >
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="code" value={lang.code} />
                    <div class="lang-info">
                        <div
                            class="lang-code font-mono text-xl text-center w-full"
                        >
                            {lang.code}
                        </div>
                        {#if lang.is_default}<div class="badge-wrapper">
                                <span class="badge"
                                    >{t("admin.lang.default_badge")}</span
                                >
                            </div>{/if}
                    </div>
                    <div class="lang-fields">
                        <div class="field">
                            <label>{t("admin.lang.field_name")}</label>
                            <input
                                type="text"
                                name="name"
                                bind:value={lang.name}
                                required
                            />
                        </div>
                        <div class="field expand">
                            <label>{t("admin.lang.field_fallback")}</label>
                            <input
                                type="text"
                                name="fallback_message"
                                bind:value={lang.fallback_message}
                                required
                                title="Fallback Message"
                            />
                        </div>
                        <div class="field center-chk">
                            <label>{t("admin.lang.field_default")}</label>
                            <input
                                type="checkbox"
                                name="is_default"
                                value="true"
                                checked={lang.is_default === 1}
                                disabled={lang.is_default === 1}
                                title={t("admin.lang.field_default")}
                            />
                        </div>
                    </div>
                    <div class="lang-actions">
                        <button
                            type="submit"
                            class="btn icon"
                            title={t("admin.lang.save_title")}
                            ><Save size={18} /></button
                        >
                    </div>
                </form>
                <form method="POST" action="?/save" use:enhance>
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="code" value={lang.code} />
                    <button
                        type="submit"
                        class="btn icon danger"
                        title={t("admin.lang.delete_title")}
                        disabled={lang.is_default === 1}
                        onclick={(e) => {
                            if (!confirm(t("admin.lang.delete_confirm")))
                                e.preventDefault();
                        }}
                    >
                        <Trash2 size={18} />
                    </button>
                </form>
            </div>
        {/each}
        {#if languages.length === 0}
            <div
                class="p-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-lg"
            >
                {t("admin.lang.empty")}
            </div>
        {/if}
    </div>
</div>

<Categoryi18nManager {languages} {categories} />
<DictionaryEditor {languages} {ui_dictionary} />

<style>
    .header {
        margin-bottom: 2rem;
    }
    .header h1 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 0.5rem 0;
        color: #1e293b;
    }
    .header p {
        color: #64748b;
        margin: 0;
    }

    .card {
        background: white;
        border-radius: 0.75rem;
        border: 1px solid #e2e8f0;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    h2 {
        font-size: 1.25rem;
        margin: 0;
        color: #0f172a;
    }
    h3 {
        font-size: 1.1rem;
        margin: 0 0 1rem 0;
        color: #334155;
    }

    .edit-box {
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 0.5rem;
        padding: 1.5rem;
        margin-bottom: 2rem;
    }
    .fade-in {
        animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
    .full-width {
        grid-column: 1 / -1;
    }
    .form-group label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #475569;
        margin-bottom: 0.5rem;
    }
    .form-group input[type="text"] {
        width: 100%;
        padding: 0.6rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
    }
    .form-group input[type="text"]:focus {
        outline: 2px solid #3b82f6;
        border-color: transparent;
    }
    .form-group.check label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
    }

    .lang-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .lang-item {
        display: flex;
        align-items: stretch;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        transition: border-color 0.2s;
    }
    .lang-item:hover {
        border-color: #cbd5e1;
    }
    .flex-form {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex: 1;
    }
    .lang-info {
        width: 90px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.4rem;
        border-right: 1px solid #e2e8f0;
        padding-right: 1rem;
    }
    .lang-code {
        font-weight: 700;
        font-size: 1.25rem;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .badge-wrapper {
        text-align: center;
    }
    .badge {
        background: #3b82f6;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .lang-fields {
        display: flex;
        gap: 1rem;
        flex: 1;
        align-items: flex-end;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .field label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }
    .field.expand {
        flex: 1;
    }
    .field.center-chk {
        align-items: center;
        justify-content: center;
        padding-bottom: 0.6rem;
    }
    .lang-fields input[type="text"] {
        padding: 0.6rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        background: #f8fafc;
        transition: all 0.2s;
    }
    .lang-fields input[type="text"]:focus {
        background: #fff;
        border-color: #3b82f6;
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    .lang-fields input[type="text"]:disabled {
        background: #e2e8f0;
        color: #94a3b8;
        cursor: not-allowed;
    }
    .lang-fields input[type="checkbox"] {
        width: 1.1rem;
        height: 1.1rem;
        cursor: pointer;
    }
    .lang-fields input[type="checkbox"]:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .lang-actions {
        display: flex;
        align-items: flex-end;
        padding-bottom: 0.2rem;
    }

    .btn {
        padding: 0.5rem 1rem;
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
    .btn.primary:hover {
        background: #059669;
        transform: translateY(-1px);
    }
    .btn.primary:active {
        transform: translateY(0);
    }
    .btn.text {
        background: transparent;
        color: #475569;
    }
    .btn.text:hover {
        background: #f1f5f9;
        color: #0f172a;
    }
    .btn.icon {
        padding: 0.6rem;
        background: #f1f5f9;
        color: #475569;
        border-radius: 0.375rem;
    }
    .btn.icon:hover {
        background: #e2e8f0;
        color: #0f172a;
    }
    .btn.icon:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .btn.icon.danger {
        color: #ef4444;
        background: #fef2f2;
    }
    .btn.icon.danger:hover:not(:disabled) {
        background: #fee2e2;
        color: #b91c1c;
    }
    .mt-4 {
        margin-top: 1rem;
    }
    .flex {
        display: flex;
    }
    .justify-between {
        justify-content: space-between;
    }
    .items-center {
        align-items: center;
    }
    .mb-4 {
        margin-bottom: 1rem;
    }
    .font-mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
    }
    .gap-2 {
        gap: 0.5rem;
    }
    .btn.warning {
        background: #f59e0b;
        color: white;
    }
    .btn.warning:hover {
        background: #d97706;
        transform: translateY(-1px);
    }
    .btn.warning:active {
        transform: translateY(0);
    }
</style>
