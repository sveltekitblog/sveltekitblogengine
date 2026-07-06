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

export const DELETE: RequestHandler = async ({ params, request, locals, cookies }) => {
    const { id } = params;
    const db = locals.userDb;
    if (!db) throw error(500, 'User Database not found');

    // Double check admin authorization
    if (!cookies.get('admin_session')) {
        throw error(401, 'Unauthorized');
    }

    try {
        const body = await request.json();
        const { deleteBehavior } = body; // 'cascade' | 'anonymize'

        if (!deleteBehavior || (deleteBehavior !== 'cascade' && deleteBehavior !== 'anonymize')) {
            return json({ error: 'Valid deleteBehavior (cascade or anonymize) is required' }, { status: 400 });
        }

        // 1. Fetch user data for archiving
        const userResult: any = await db.prepare(`
            SELECT * FROM user WHERE id = ?
        `).bind(id).first();

        if (!userResult) {
            return json({ error: 'User not found' }, { status: 404 });
        }

        // 관리자 계정은 회원 관리 목록이나 API를 통해 직접 삭제할 수 없도록 강제 차단
        if (userResult.role === 'admin') {
            return json({ error: 'Cannot delete the admin account' }, { status: 400 });
        }

        // Fetch accounts data for archiving
        const { results: accountsResult } = await db.prepare(`
            SELECT id, account_id, provider_id, created_at FROM account WHERE user_id = ?
        `).bind(id).all();

        // 2. Prepare archiving JSON
        const originalData = JSON.stringify({
            user: userResult,
            accounts: accountsResult || []
        });

        // 3. Insert into deleted_users table
        await db.prepare(`
            INSERT INTO deleted_users (id, name, email, role, image, deleted_by, delete_behavior, original_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            userResult.name || null,
            userResult.email || null,
            userResult.role || null,
            userResult.image || null,
            'admin',
            deleteBehavior,
            originalData
        ).run();

        // 4. Handle deletion behavior
        if (deleteBehavior === 'cascade') {
            // Delete all entries (comments/guestbook) written by this user
            await db.prepare(`
                DELETE FROM entries WHERE user_id = ?
            `).bind(id).run();

            // Delete all post likes by this user
            await db.prepare(`
                DELETE FROM post_likes WHERE user_id = ?
            `).bind(id).run();
        }

        // 5. Delete Better Auth sessions and accounts
        await db.prepare(`
            DELETE FROM session WHERE user_id = ?
        `).bind(id).run();

        await db.prepare(`
            DELETE FROM account WHERE user_id = ?
        `).bind(id).run();

        // 6. Delete user
        await db.prepare(`
            DELETE FROM user WHERE id = ?
        `).bind(id).run();

        return json({ success: true });
    } catch (err) {
        console.error('DELETE /api/users/[id] error:', err);
        return json({ error: 'Failed to delete user' }, { status: 500 });
    }
};
