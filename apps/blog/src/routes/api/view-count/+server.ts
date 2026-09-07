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

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// 서버 측 중복 제거 안전망: 브라우저당 포스트별 10분 창
const VIEW_WINDOW_MS = 1000 * 60 * 10;

/**
 * 한글/특수문자 slug가 포함되어도 RFC 6265 쿠키 규격을 위반하지 않도록
 * 안전한 단축 영숫자 쿠키 키를 생성합니다.
 */
function getCookieKey(slug: string, lang: string): string {
    let hash = 5381;
    const key = `${lang}:${slug}`;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 33) ^ key.charCodeAt(i);
    }
    return `skbe_v_${(hash >>> 0).toString(36)}`;
}

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    const dbDefaultLang = locals.dbDefaultLang || 'ko';
    const { slug, lang = dbDefaultLang } = await request.json() as { slug: string, lang?: string };
    const db = locals.db;

    if (!slug || !db) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }

    // 포스트별 쿠키: 새 탭/새로고침/JS 미실행으로 sessionStorage(탭당 30분)를 우회하는 것을 차단
    const cookieName = getCookieKey(slug, lang);
    const lastViewed = cookies.get(cookieName);
    const now = Date.now();

    if (lastViewed && now - parseInt(lastViewed, 10) < VIEW_WINDOW_MS) {
        // 창 내 이미 집계됨 → 증가 없이 현재 값만 반환
        const count = await db.getViewCount(slug, lang);
        return json({ views: count });
    }

    try {
        await db.incrementViewCount(slug, lang);
        cookies.set(cookieName, now.toString(), {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: Math.floor(VIEW_WINDOW_MS / 1000)
        });
        const count = await db.getViewCount(slug, lang);
        return json({ views: count });
    } catch (e) {
        console.error('Error incrementing view count:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const GET: RequestHandler = async ({ url, locals }) => {
    const slug = url.searchParams.get('slug');
    const dbDefaultLang = locals.dbDefaultLang || 'ko';
    const lang = url.searchParams.get('lang') || dbDefaultLang;
    const db = locals.db;

    if (!slug || !db) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }

    try {
        const count = await db.getViewCount(slug, lang);
        return json({ views: count });
    } catch (e) {
        console.error('Error fetching view count:', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
