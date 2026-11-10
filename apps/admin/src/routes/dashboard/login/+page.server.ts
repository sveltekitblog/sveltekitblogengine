/**
 * Copyright (C) 2026 SvelteKit Blog Engine
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

// 타이밍 공격(Timing Attack) 방지를 위한 고정 시간 문자열 비교 함수
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export const load: PageServerLoad = async ({ locals }) => {
    // DB에서 대시보드 비밀번호가 설정되어 있는지 확인
    const db = locals.blogDb;
    let isConfigured = false;
    if (db) {
        try {
            const row = await db.prepare("SELECT value FROM blog_settings WHERE key = 'dashboard_password'").first();
            const stored = (row?.value as string || '').trim();
            isConfigured = Boolean(stored && stored.length === 64);
        } catch (e) {
            console.error('Failed to check dashboard_password setting:', e);
        }
    }

    return {
        isConfigured
    };
};

export const actions: Actions = {
    login: async ({ request, cookies, locals }) => {
        const db = locals.blogDb;
        if (!db) {
            return fail(500, { error: 'Database not available' });
        }

        const data = await request.formData();
        const inputPassword = (data.get('password') as string || '').trim();

        // 입력값 검증 (비어있거나 128자 초과 비정상 입력 차단)
        if (!inputPassword || inputPassword.length > 128) {
            return fail(400, { error: 'admin.dashboard.login.invalid' });
        }

        let storedHash = '';
        try {
            const row = await db.prepare("SELECT value FROM blog_settings WHERE key = 'dashboard_password'").first();
            storedHash = (row?.value as string || '').trim();
        } catch (e) {
            console.error('Failed to read dashboard_password setting:', e);
            return fail(500, { error: 'admin.dashboard.login.invalid' });
        }

        // 비밀번호가 설정되어 있지 않거나 비정상적인 경우 외부 접속 원천 차단
        if (!storedHash || storedHash.length !== 64) {
            return fail(403, { error: 'admin.dashboard.login.not_configured' });
        }

        // 입력된 비밀번호의 SHA-256 해시 계산
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inputPassword));
        const inputHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

        // 타이밍 공격 방지 비교 검증
        if (!constantTimeCompare(inputHash, storedHash)) {
            return fail(401, { error: 'admin.dashboard.login.invalid' });
        }

        // 대시보드 전용 세션 토큰 발급 (암호학적 128비트 UUID)
        const sessionToken = crypto.randomUUID();
        cookies.set('dashboard_session', sessionToken, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30일
        });

        // try-catch 바깥에서 리다이렉트 실행 (SvelteKit 프레임워크 가로챔 방지)
        throw redirect(303, '/dashboard');
    },

    logout: async ({ cookies }) => {
        cookies.delete('dashboard_session', { path: '/' });
        cookies.delete('admin_session', { path: '/' });
        throw redirect(303, '/dashboard/login');
    }
};
