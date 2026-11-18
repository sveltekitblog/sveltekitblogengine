/**
 * Copyright (C) 2026 SvelteKit Blog Engine
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ADMIN_SESSION_MAX_AGE, createAdminSession } from '$lib/server/adminSession';

async function constantTimePasswordMatch(input: string, expected: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [aBuf, bBuf] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(input)),
        crypto.subtle.digest('SHA-256', enc.encode(expected))
    ]);
    const a = new Uint8Array(aBuf);
    const b = new Uint8Array(bBuf);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export const actions = {
    default: async ({ request, cookies, platform }: RequestEvent) => {
        const kv = platform?.env?.IMAGES_KV;
        const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
        const rlKey = `rl:admin-login:${clientIp}`;
        let failCount = 0;

        if (kv) {
            try {
                failCount = parseInt((await kv.get(rlKey)) || '0', 10) || 0;
                if (failCount >= 5) {
                    return fail(429, { error: 'admin.login.too_many_attempts' });
                }
            } catch {}
        }

        const data = await request.formData();
        const password = String(data.get('password') ?? '');

        // 환경 변수에서 비밀번호 가져오기
        const correctPassword = platform?.env?.ADMIN_PASSWORD;

        if (!correctPassword) {
            console.error('ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다!');
            return fail(500, { error: 'admin.login.server_config_error' });
        }

        if (!(await constantTimePasswordMatch(password, correctPassword))) {
            if (kv) {
                try {
                    await kv.put(rlKey, String(failCount + 1), { expirationTtl: 900 });
                } catch {}
            }
            return fail(401, { error: 'admin.login.incorrect_password' });
        }

        if (kv && failCount > 0) {
            try { await kv.delete(rlKey); } catch {}
        }

        const db = platform?.env?.BLOG_DB;
        if (!db) {
            console.error('BLOG_DB binding is not configured');
            return fail(500, { error: 'admin.login.server_config_error' });
        }

        // Persist a digest of the token before issuing its cookie.  A supplied
        // cookie must therefore correspond to a live server-side session.
        const sessionToken = await createAdminSession(db, 'admin');

        // HTTPS deployments must never send an administrator cookie over HTTP.
        cookies.set('admin_session', sessionToken, {
            path: '/',
            httpOnly: true,
            secure: new URL(request.url).protocol === 'https:',
            sameSite: 'strict',
            maxAge: ADMIN_SESSION_MAX_AGE
        });

        throw redirect(303, '/');
    }
};
