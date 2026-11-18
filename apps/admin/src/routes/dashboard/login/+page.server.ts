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
import { ADMIN_SESSION_MAX_AGE, createAdminSession, revokeAdminSession } from '$lib/server/adminSession';
import { hashDashboardPassword, verifyDashboardPassword } from '$lib/server/dashboardPassword';

export const load: PageServerLoad = async ({ locals }) => {
    // DB에서 대시보드 비밀번호가 설정되어 있는지 확인
    const db = locals.blogDb;
    let isConfigured = false;
    if (db) {
        try {
            const row = await db.prepare("SELECT value FROM blog_settings WHERE key = 'dashboard_password'").first();
            const stored = (row?.value as string || '').trim();
            isConfigured = Boolean(stored);
        } catch (e) {
            console.error('Failed to check dashboard_password setting:', e);
        }
    }

    return {
        isConfigured
    };
};

export const actions: Actions = {
    login: async ({ request, cookies, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) {
            return fail(500, { error: 'Database not available' });
        }

        const kv = platform?.env?.IMAGES_KV;
        const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
        const rlKey = `rl:dash-login:${clientIp}`;
        let failCount = 0;

        if (kv) {
            try {
                failCount = parseInt((await kv.get(rlKey)) || '0', 10) || 0;
                if (failCount >= 5) {
                    return fail(429, { error: 'admin.dashboard.login.too_many_attempts' });
                }
            } catch {}
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

        if (!storedHash) {
            return fail(403, { error: 'admin.dashboard.login.not_configured' });
        }

        const verification = await verifyDashboardPassword(inputPassword, storedHash);
        if (!verification.valid) {
            if (kv) {
                try {
                    await kv.put(rlKey, String(failCount + 1), { expirationTtl: 900 });
                } catch {}
            }
            return fail(401, { error: 'admin.dashboard.login.invalid' });
        }

        if (kv && failCount > 0) {
            try { await kv.delete(rlKey); } catch {}
        }

        if (verification.needsUpgrade) {
            await db.prepare("UPDATE blog_settings SET value = ?, updated_at = ? WHERE key = 'dashboard_password'")
                .bind(await hashDashboardPassword(inputPassword), new Date().toISOString()).run();
        }

        // Persist a digest of the token before issuing its cookie.
        const sessionToken = await createAdminSession(db, 'dashboard');
        cookies.set('dashboard_session', sessionToken, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: ADMIN_SESSION_MAX_AGE
        });

        // try-catch 바깥에서 리다이렉트 실행 (SvelteKit 프레임워크 가로챔 방지)
        throw redirect(303, '/dashboard');
    },

    logout: async ({ cookies, locals }) => {
        await Promise.all([
            revokeAdminSession(locals.blogDb, cookies.get('dashboard_session')),
            revokeAdminSession(locals.blogDb, cookies.get('admin_session'))
        ]);
        cookies.delete('dashboard_session', { path: '/' });
        cookies.delete('admin_session', { path: '/' });
        throw redirect(303, '/dashboard/login');
    }
};
