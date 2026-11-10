<!--
 Copyright (C) 2026 SvelteKit Blog Engine

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
-->

<script lang="ts">
    import { enhance } from "$app/forms";
    import { t, adminLang } from "$lib/i18n.svelte";
    import { LayoutDashboard, Lock, ArrowRight, AlertCircle } from "lucide-svelte";
    import type { PageData, ActionData } from "./$types";

    let { data, form }: { data: PageData; form: ActionData } = $props();
    let clientError = $state('');
    let isSubmitting = $state(false);
    let activeError = $derived(clientError || form?.error);
</script>

<svelte:head>
    <title>{t('admin.dashboard.login.title')} - SKBE</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="dash-login-wrapper">
    <div class="dash-login-card">
        <div class="card-top-bar">
            <select bind:value={adminLang.value} class="login-lang-select" aria-label="Language">
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
            </select>
        </div>

        <div class="card-header">
            <div class="icon-bubble">
                <LayoutDashboard size={28} class="text-blue-600" />
            </div>
            <h1>{t('admin.dashboard.login.title')}</h1>
            <p class="subtitle">{t('admin.dashboard.login.subtitle')}</p>
        </div>

        {#if !data.isConfigured}
            <div class="alert warning">
                <AlertCircle size={18} />
                <span>{t('admin.dashboard.login.not_configured')}</span>
            </div>
        {:else}
            <form
                method="POST"
                action="?/login"
                use:enhance={() => {
                    isSubmitting = true;
                    clientError = '';
                    return async ({ result, update }) => {
                        isSubmitting = false;
                        if (result.type === 'failure') {
                            clientError = (result.data as any)?.error || 'admin.dashboard.login.invalid';
                        } else {
                            await update();
                        }
                    };
                }}
            >
                <div class="input-group">
                    <label for="password">{t('admin.dashboard.login.password')}</label>
                    <div class="input-wrapper">
                        <Lock size={18} class="input-icon" />
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            placeholder="••••••••"
                            autocomplete="current-password"
                        />
                    </div>
                </div>

                {#if activeError}
                    <div class="alert error">
                        <AlertCircle size={18} />
                        <span>{t(activeError, { default: "비밀번호가 올바르지 않습니다." })}</span>
                    </div>
                {/if}

                <button type="submit" class="submit-btn" disabled={isSubmitting}>
                    <span>{isSubmitting ? t('admin.dashboard.login.logging_in') : t('admin.dashboard.login.submit')}</span>
                    <ArrowRight size={18} />
                </button>
            </form>
        {/if}
    </div>
</div>

<style>
    .dash-login-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f172a;
        padding: 1rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .dash-login-card {
        width: 100%;
        max-width: 380px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 1.25rem;
        padding: 1.5rem 1.5rem 2rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .card-top-bar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.75rem;
    }

    .login-lang-select {
        background: #0f172a;
        color: #94a3b8;
        border: 1px solid #334155;
        border-radius: 0.5rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        outline: none;
        cursor: pointer;
    }

    .login-lang-select:focus {
        border-color: #3b82f6;
        color: #f8fafc;
    }

    .card-header {
        text-align: center;
        margin-bottom: 1.75rem;
    }

    .icon-bubble {
        width: 56px;
        height: 56px;
        margin: 0 auto 1rem;
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    h1 {
        font-size: 1.35rem;
        font-weight: 700;
        color: #f8fafc;
        margin: 0 0 0.35rem;
    }

    .subtitle {
        font-size: 0.85rem;
        color: #94a3b8;
        margin: 0;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.85rem;
        margin-bottom: 1.25rem;
    }

    .alert.error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    .alert.warning {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #fcd34d;
    }

    .input-group {
        margin-bottom: 1.25rem;
    }

    label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        color: #cbd5e1;
        margin-bottom: 0.5rem;
    }

    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    :global(.input-wrapper .input-icon) {
        position: absolute;
        left: 0.9rem;
        color: #64748b;
        pointer-events: none;
    }

    input {
        width: 100%;
        padding: 0.8rem 1rem 0.8rem 2.6rem;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 0.75rem;
        color: #f8fafc;
        font-size: 0.95rem;
        box-sizing: border-box;
        transition: all 0.2s;
    }

    input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    }

    .submit-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.85rem 1rem;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 0.75rem;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
        background: #1d4ed8;
    }

    .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>

