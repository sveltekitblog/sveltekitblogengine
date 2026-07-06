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

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    const { id } = params;
    const db = locals.userDb;
    if (!db) throw error(500, 'User Database not found');

    try {
        // 특정 유저의 활동 내역 (댓글 & 방명록) 조회
        // target_id가 있으면 댓글, 없으면 방명록으로 구분 가능 (UI에서 처리)
        const { results: entries } = await db.prepare(`
            SELECT * FROM entries 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).bind(id).all();

        return json({ entries });
    } catch (err) {
        console.error('GET /api/users/[id]/activity error:', err);
        return json({ error: 'Failed to fetch user activity' }, { status: 500 });
    }
};
