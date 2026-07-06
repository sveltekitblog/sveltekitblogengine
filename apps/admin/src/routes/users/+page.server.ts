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

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
    const db = locals.userDb;
    if (!db) throw error(500, 'User Database not found');

    try {
        const { results } = await db.prepare(`
            SELECT id, name, email, image, role, banned, ban_reason, ban_expires, created_at 
            FROM user 
            ORDER BY created_at DESC
        `).all();

        return {
            users: Array.from(results || [])
        };
    } catch (err) {
        console.error('Failed to load users:', err);
        return { users: [], error: 'Failed to fetch users' };
    }
};
