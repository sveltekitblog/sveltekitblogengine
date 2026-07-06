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

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    const { id } = params;
    const db = locals.userDb;
    if (!db) throw error(500, 'User Database not found');

    try {
        const body = (await request.json()) as any;
        const { banned, reason, expires, show_ban_reason } = body;

        // banned: boolean
        // reason: string (optional)
        // expires: number (timestamp_ms, optional)
        // show_ban_reason: boolean (optional)

        if (banned === undefined) {
            return json({ error: 'banned status is required' }, { status: 400 });
        }

        if (banned) {
            // 차단 설정
            await db.prepare(`
                UPDATE user 
                SET banned = 1, ban_reason = ?, ban_expires = ?, show_ban_reason = ?, updated_at = ?
                WHERE id = ?
            `).bind(
                reason || null, 
                expires || null, 
                show_ban_reason ? 1 : 0,
                Date.now(),
                id
            ).run();
        } else {
            // 차단 해제
            await db.prepare(`
                UPDATE user 
                SET banned = 0, ban_reason = NULL, ban_expires = NULL, show_ban_reason = 0, updated_at = ?
                WHERE id = ?
            `).bind(
                Date.now(),
                id
            ).run();
        }

        return json({ success: true });
    } catch (err) {
        console.error('PATCH /api/users/[id]/ban error:', err);
        return json({ error: 'Failed to update ban status' }, { status: 500 });
    }
};
