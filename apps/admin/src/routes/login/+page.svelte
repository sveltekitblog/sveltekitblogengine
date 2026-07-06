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
    import { t, adminLang } from "$lib/i18n.svelte";
    import { onMount } from "svelte";

    let { form } = $props();

    onMount(() => {
        // 최초 접속 시 별도의 브라우저 언어 강제 세팅을 하지 않음으로써,
        // adminLang.value가 데이터베이스의 기본 언어(dbDefaultLang)를 자연스럽게 사용하도록 유도합니다.
        // 사용자가 명시적으로 언어를 바꿨을 경우에만 localStorage 설정을 따릅니다.
    });
</script>

<div class="login-container">
    <div class="login-card">
        <div class="lang-selector-container">
            <select bind:value={adminLang.value} class="login-lang-select">
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
            </select>
        </div>

        <h1>{t("admin.login.title", { default: "관리자 로그인" })}</h1>
        <p class="subtitle">
            {t("admin.login.subtitle", { default: "admin 관리 패널" })}
        </p>

        <form method="POST" use:enhance>
            <div class="form-group">
                <label for="password"
                    >{t("admin.login.password", { default: "비밀번호" })}</label
                >
                <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    autocomplete="current-password"
                    placeholder={t("admin.login.password_placeholder", {
                        default: "비밀번호를 입력하세요",
                    })}
                />
            </div>

            {#if form?.error}
                <p class="error">{t(form.error, { default: form.error })}</p>
            {/if}

            <button type="submit"
                >{t("admin.login.submit", { default: "로그인" })}</button
            >
        </form>
    </div>
</div>

<style>
    .login-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .login-card {
        background: white;
        padding: 3rem;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 400px;
        position: relative;
    }

    .lang-selector-container {
        position: absolute;
        top: 1rem;
        right: 1.5rem;
    }

    .login-lang-select {
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
        color: #4b5563;
        cursor: pointer;
        outline: none;
        transition: all 0.2s ease-in-out;
    }

    .login-lang-select:hover {
        background: #e5e7eb;
        color: #1f2937;
        border-color: #d1d5db;
    }

    h1 {
        margin: 0 0 0.5rem;
        font-size: 2rem;
        color: #333;
        text-align: center;
    }

    .subtitle {
        margin: 0 0 2rem;
        color: #666;
        text-align: center;
        font-size: 0.9rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        color: #333;
        font-weight: 500;
    }

    input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.3s;
        box-sizing: border-box;
    }

    input:focus {
        outline: none;
        border-color: #667eea;
    }

    button {
        width: 100%;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }

    button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }

    button:active {
        transform: translateY(0);
    }

    .error {
        background: #fee;
        color: #c33;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
        text-align: center;
    }
</style>
