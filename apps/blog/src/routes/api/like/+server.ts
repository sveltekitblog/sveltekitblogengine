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
import { postLikes } from '@blog/shared/db/user-schema';
import { eq, and, count } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
    // 1. Auth Check
    const currentUser = locals.user;
    if (!currentUser) {
        return json({ error: 'Unauthorized - 로그인이 필요합니다' }, { status: 401 });
    }

    const db = locals.userDb;
    if (!db) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        const { postId } = await request.json() as { postId: string };
        if (!postId) {
            return json({ error: 'Missing postId' }, { status: 400 });
        }

        const userId = currentUser.id;

        // 2. Check if already liked
        const existingLike = await db
            .select()
            .from(postLikes)
            .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
            .get();

        let liked = false;

        if (existingLike) {
            // 3. Unlike
            await db
                .delete(postLikes)
                .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
            liked = false;
        } else {
            // 4. Like
            await db.insert(postLikes).values({
                postId,
                userId,
                createdAt: new Date(),
            });
            liked = true;
        }

        // 5. Get updated count
        const result = await db
            .select({ count: count() })
            .from(postLikes)
            .where(eq(postLikes.postId, postId))
            .get();

        const totalLikes = result?.count || 0;

        return json({ liked, count: totalLikes });
    } catch (e: any) {
        console.error('Like toggle failed:', e);
        return json({ error: e.message }, { status: 500 });
    }
};
