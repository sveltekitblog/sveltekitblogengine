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

import type { D1Database } from '@cloudflare/workers-types';

interface BufferedView {
    postId: string;
    lang: string;
    count: number;
}

const buffer = new Map<string, BufferedView>();
let totalPendingViews = 0;
let lastFlushTime = Date.now();

// Threshold: 10 accumulated views OR 30 seconds elapsed
const BATCH_FLUSH_THRESHOLD = 10;
const FLUSH_INTERVAL_MS = 30 * 1000;

/**
 * Return any views accumulated in memory that have not yet been written to D1.
 */
export function getPendingViews(postId: string): number {
    let pending = 0;
    for (const item of buffer.values()) {
        if (item.postId === postId) {
            pending += item.count;
        }
    }
    return pending;
}

/**
 * Flush accumulated views in batch to both USER_DB (daily statistics) and BLOG_DB (post view_count).
 */
export async function flushViewBuffer(blogD1?: D1Database, userD1?: D1Database): Promise<void> {
    if (buffer.size === 0) {
        lastFlushTime = Date.now();
        return;
    }

    const itemsToFlush = Array.from(buffer.values());
    buffer.clear();
    totalPendingViews = 0;
    lastFlushTime = Date.now();

    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Batch flush to USER_DB (post_views) for daily historical statistics
        if (userD1 && itemsToFlush.length > 0) {
            const userStatements = itemsToFlush.map(item =>
                userD1.prepare(`
                    INSERT INTO post_views (post_id, lang, date, views)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(post_id, date) DO UPDATE SET
                        views = post_views.views + excluded.views,
                        lang = excluded.lang
                `).bind(item.postId, item.lang, today, item.count)
            );
            await userD1.batch(userStatements);
        }

        // 2. Batch flush to BLOG_DB (posts) for normalized total view count column
        if (blogD1 && itemsToFlush.length > 0) {
            const blogStatements = itemsToFlush.map(item =>
                blogD1.prepare(`
                    UPDATE posts
                    SET view_count = COALESCE(view_count, 0) + ?
                    WHERE id = ?
                `).bind(item.count, item.postId)
            );
            await blogD1.batch(blogStatements);
        }
    } catch (err) {
        console.error('[ViewBuffer] Failed to batch flush buffered views:', err);
    }
}

/**
 * Record a page view in the in-memory buffer.
 * Automatically flushes in batch when reaching 10 views or after 30 seconds.
 */
export async function recordView(
    blogD1: D1Database,
    userD1: D1Database,
    postId: string,
    lang: string
): Promise<void> {
    const key = `${postId}:${lang}`;
    const existing = buffer.get(key);
    if (existing) {
        existing.count += 1;
    } else {
        buffer.set(key, { postId, lang, count: 1 });
    }
    totalPendingViews += 1;

    const now = Date.now();
    const shouldFlush = totalPendingViews >= BATCH_FLUSH_THRESHOLD || (now - lastFlushTime >= FLUSH_INTERVAL_MS);

    if (shouldFlush) {
        await flushViewBuffer(blogD1, userD1);
    }
}
