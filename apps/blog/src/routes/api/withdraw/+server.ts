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

export const POST: RequestHandler = async ({ locals, cookies, platform }) => {
    // Cloudflare D1 Raw Database 바인딩 취득 (.prepare 함수 사용 목적)
    const db = platform?.env?.USER_DB || (locals.userDb as any)?.$client;
    const currentUser = locals.user;

    if (!db) throw error(500, 'User Database not found');
    if (!currentUser || !currentUser.id) {
        throw error(401, 'Unauthorized');
    }

    const userId = currentUser.id;

    try {
        // 1. Fetch user data for archiving
        const userResult: any = await db.prepare(`
            SELECT * FROM user WHERE id = ?
        `).bind(userId).first();

        if (!userResult) {
            return json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch accounts data for archiving
        const { results: accountsResult } = await db.prepare(`
            SELECT id, account_id, provider_id, created_at FROM account WHERE user_id = ?
        `).bind(userId).all();

        // 2. Prepare archiving JSON
        const originalData = JSON.stringify({
            user: userResult,
            accounts: accountsResult || []
        });

        // 3. Insert into deleted_users table (behavior: anonymize, by: user)
        await db.prepare(`
            INSERT INTO deleted_users (id, name, email, role, image, deleted_by, delete_behavior, original_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId,
            userResult.name || null,
            userResult.email || null,
            userResult.role || null,
            userResult.image || null,
            'user',
            'anonymize',
            originalData
        ).run();

        // 4. Delete sessions and accounts associated with this user in Better Auth tables
        await db.prepare(`
            DELETE FROM session WHERE user_id = ?
        `).bind(userId).run();

        await db.prepare(`
            DELETE FROM account WHERE user_id = ?
        `).bind(userId).run();

        // 5. Delete the user
        await db.prepare(`
            DELETE FROM user WHERE id = ?
        `).bind(userId).run();

        // 6. Dynamically clear all Better Auth cookies
        const allCookies = cookies.getAll();
        for (const cookie of allCookies) {
            if (cookie.name.includes('better-auth')) {
                cookies.delete(cookie.name, { path: '/' });
            }
        }

        return json({ success: true });
    } catch (err) {
        console.error('POST /api/withdraw error:', err);
        return json({ error: 'Withdrawal failed' }, { status: 500 });
    }
};
