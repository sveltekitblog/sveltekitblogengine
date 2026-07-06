/**
 * Copyright (C) 2026 kimteamjang
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
import { purgeCdnCache } from '$lib/server/cachePurge';

export const POST: RequestHandler = async ({ locals, platform, cookies }) => {
    // 보안 검사: 어드민 세션 쿠키가 존재할 때만 수행
    const session = cookies.get('admin_session');
    if (!session) {
        return json({ success: false, error: 'Unauthorized. Login required' }, { status: 401 });
    }

    const db = locals.blogDb;

    if (!db) {
        return json({ success: false, error: 'Database connection not found' }, { status: 500 });
    }

    // 수동 퍼지이므로 전체 캐시 삭제(purgeEverything: true) 호출
    const result = await purgeCdnCache(platform, db, { purgeEverything: true });

    if (result.success) {
        return json({ success: true });
    } else {
        // Cloudflare 에러 객체 배열일 경우 실제 메시지만 추출하여 가독성 개선
        const errMsg = Array.isArray(result.error)
            ? result.error.map(e => e.message || JSON.stringify(e)).join(', ')
            : (typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
        return json({ success: false, error: errMsg }, { status: 500 });
    }
};
