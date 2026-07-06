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
    import { authClient } from "$lib/auth-client";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { SOCIAL_PROVIDER_META } from "@blog/shared";
    import { t } from "$lib/i18n";

    const { data } = $props();
    const enabledProviders = $derived(data.enabledProviders || []);
    const enableEmailLogin = $derived(data.enableEmailLogin);
    const isEmailOnly = $derived(enabledProviders.length === 0);

    // Show email form immediately if no social providers exist
    let showEmailForm = $state(false);

    $effect(() => {
        showEmailForm = isEmailOnly;
    });
    let errorMessage = $state("");
    let successMessage = $state("");
    let mode = $state<'login' | 'signup'>('login');
    let email = $state("");
    let password = $state("");
    let name = $state("");
    let isLoading = $state(false);

    onMount(() => {
        const urlError = $page.url.searchParams.get("error");
        if (urlError === "account_not_linked") {
            errorMessage = $t("blog.auth.error_social_linked");
        } else if (urlError) {
            errorMessage = $t("blog.auth.error_login_failed_prefix") + urlError;
        }
    });

    async function loginWithProvider(provider: string) {
        await authClient.signIn.social({
            provider: provider as any,
            callbackURL: "/",
            errorURL: "/login"
        });
    }

    async function handleEmailAuth() {
        if (!email || !password) {
            errorMessage = $t("blog.auth.error_input_required");
            return;
        }
        if (mode === 'signup' && !name) {
            errorMessage = $t("blog.auth.error_name_required");
            return;
        }

        isLoading = true;
        errorMessage = "";
        try {
            if (mode === 'signup') {
                const result = await authClient.signUp.email({
                    email,
                    password,
                    name: name || email.split('@')[0],
                    callbackURL: "/"
                });
                if (result.error) {
                    const signupErrorKey = `blog.auth.error_${result.error.code?.toLowerCase()}`;
                    errorMessage = $t(signupErrorKey) !== signupErrorKey 
                        ? $t(signupErrorKey) 
                        : ($t("blog.auth.error_signup_failed") || result.error.message);
                    return;
                }
                
                // 가입 성공! 즉시 피드백 및 리다이렉트
                successMessage = $t("blog.auth.signup_success");
                isLoading = true;
                window.location.href = "/";
                return;
            } else {
                const result = await authClient.signIn.email({
                    email,
                    password,
                    dontRedirect: true
                });
                if (result.error) {
                    errorMessage = $t("blog.auth.error_invalid_credentials") || result.error.message;
                    isLoading = false;
                    return;
                }
                
                // 로그인 성공! 물리 새로고침으로 세션 쿠키를 동반하여 100% 안전하게 리다이렉트
                isLoading = true;
                window.location.href = "/";
                return;
            }
        } catch (e: any) {
            errorMessage = e.message || $t("blog.guestbook.error");
        } finally {
            isLoading = false;
        }
    }
</script>


<div class="login-container">
    <h1>{showEmailForm ? (mode === 'login' ? $t('blog.nav.login') : $t('blog.auth.signup')) : $t('blog.nav.login')}</h1>
    <p>{showEmailForm ? $t('blog.auth.email_promo') : $t('blog.auth.social_promo')}</p>

    {#if errorMessage}
        <div class="error-msg">
            {errorMessage}
        </div>
    {/if}

    {#if showEmailForm}
        {#if !enableEmailLogin && enabledProviders.length > 0}
            <div class="error-msg" style="margin-bottom: 1rem;">
                {$t("blog.login.email_disabled", { default: "이메일 로그인이 비활성화되어 있습니다." })}
            </div>
            <button class="back-btn" onclick={() => { showEmailForm = false; errorMessage = ''; }}>
                ← {$t('blog.auth.back_to_social')}
            </button>
        {:else}
            <div class="email-auth">
                <div class="auth-tabs">
                    <button class:active={mode === 'login'} onclick={() => { mode = 'login'; errorMessage = ''; }}>{$t('blog.nav.login')}</button>
                    <button class:active={mode === 'signup'} onclick={() => { mode = 'signup'; errorMessage = ''; }}>{$t('blog.auth.signup')}</button>
                </div>
                
                <form onsubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} class="email-form">
                    {#if mode === 'signup'}
                        <div class="password-warning">
                            {$t('blog.auth.password_warning')}
                        </div>
                        <div class="form-group">
                            <input type="text" placeholder={$t('blog.auth.name_label')} bind:value={name} disabled={isLoading} />
                        </div>
                    {/if}
                    <div class="form-group">
                        <input type="email" placeholder={$t('blog.auth.email_label')} bind:value={email} disabled={isLoading} />
                    </div>
                    <div class="form-group">
                        <input type="password" placeholder={$t('blog.auth.password_label')} bind:value={password} disabled={isLoading} />
                    </div>
                    
                    <button type="submit" class="submit-btn" disabled={isLoading}>
                        {successMessage ? successMessage : (isLoading ? $t('blog.auth.processing') : (mode === 'login' ? $t('blog.nav.login') : $t('blog.auth.signup')))}
                    </button>
                </form>

                {#if !isEmailOnly}
                    <button class="back-btn" onclick={() => { showEmailForm = false; errorMessage = ''; }}>
                        ← {$t('blog.auth.back_to_social')}
                    </button>
                {/if}
            </div>
        {/if}
    {:else}
        <div class="social-buttons">
            {#each enabledProviders as provider}
                {@const meta = SOCIAL_PROVIDER_META[provider]}
                {#if meta}
                    <button 
                        onclick={() => loginWithProvider(provider)} 
                        class="social-btn"
                        style="background: {meta.color}; color: {meta.textColor}; border: 1px solid {meta.border};"
                    >
                        {$t('blog.auth.login_with', { provider: meta.label })}
                    </button>
                {/if}
            {/each}

            {#if enableEmailLogin}
                <div class="divider">
                    <span>{$t('blog.auth.or')}</span>
                </div>

                <button class="social-btn email-toggle-btn" onclick={() => showEmailForm = true}>
                    {$t('blog.auth.email_login_btn')}
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .login-container {
        max-width: 400px;
        margin: 4rem auto;
        padding: 2.5rem;
        border: none;
        border-radius: 16px;
        text-align: center;
        background: white;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    h1 {
        margin-bottom: 0.5rem;
        font-size: 1.8rem;
        font-weight: 700;
        color: #333;
    }
    p {
        color: #666;
        margin-bottom: 2.5rem;
        font-size: 0.95rem;
    }
    .error-msg {
        background-color: #fee2e2;
        color: #dc2626;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        font-size: 0.95rem;
        font-weight: 500;
        word-break: keep-all;
        line-height: 1.5;
    }
    .password-warning {
        background-color: #fff7ed;
        color: #c2410c;
        padding: 0.85rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.85rem;
        font-weight: 500;
        text-align: left;
        border: 1px solid #ffedd5;
        line-height: 1.4;
    }
    
    /* Social Buttons */
    .social-buttons {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .social-btn {
        padding: 0.9rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .social-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .email-toggle-btn {
        background: #f8fafc;
        color: #475569;
        border: 1px solid #e2e8f0;
    }
    .email-toggle-btn:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
    }

    .divider {
        display: flex;
        align-items: center;
        margin: 0.5rem 0;
        color: #94a3b8;
        font-size: 0.85rem;
    }
    .divider::before, .divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: #e2e8f0;
    }
    .divider span {
        margin: 0 1rem;
    }

    /* Email Auth */
    .auth-tabs {
        display: flex;
        margin-bottom: 2rem;
        border-bottom: 1px solid #e2e8f0;
    }
    .auth-tabs button {
        flex: 1;
        padding: 0.75rem;
        background: none;
        border: none;
        font-size: 1rem;
        font-weight: 600;
        color: #94a3b8;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 2px solid transparent;
    }
    .auth-tabs button.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
    }
    .email-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .form-group input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }
    .form-group input:focus {
        border-color: #3b82f6;
    }
    .submit-btn {
        padding: 0.75rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .submit-btn:hover:not(:disabled) {
        background: #2563eb;
    }
    .submit-btn:disabled {
        background: #93c5fd;
        cursor: not-allowed;
    }

    .back-btn {
        margin-top: 1.5rem;
        background: none;
        border: none;
        color: #64748b;
        font-size: 0.9rem;
        cursor: pointer;
        transition: color 0.2s;
    }
    .back-btn:hover {
        color: #3b82f6;
        text-decoration: underline;
    }
</style>
