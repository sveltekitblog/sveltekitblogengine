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
import {
    generateSidebarSnapshot,
    purgeEverything,
    syncCategoryPostCounts,
    syncNextScheduledAt
} from '@blog/shared';
import { getOrSetCache, deleteCache, deleteCacheByPrefix } from './cache';

const NEXT_SCHEDULED_CACHE_KEY = 'hook:next_scheduled_at';
let inFlightPublish: Promise<void> | null = null;

async function runDuePublish(blogD1: D1Database, platform: any, nowIso: string): Promise<void> {
    const { results } = await blogD1
        .prepare(`
            UPDATE posts
            SET status = 'published', updated_at = ?
            WHERE status = 'scheduled'
              AND published_at IS NOT NULL
              AND published_at != ''
              AND published_at <= ?
            RETURNING id, type
        `)
        .bind(nowIso, nowIso)
        .all();

    const publishedPosts = (results || []) as any[];
    if (publishedPosts.length === 0) {
        deleteCache(NEXT_SCHEDULED_CACHE_KEY);
        return;
    }

    const hasBlogPost = publishedPosts.some((p) => (p.type || 'post') === 'post');

    await syncNextScheduledAt(blogD1);
    if (hasBlogPost) {
        await syncCategoryPostCounts(blogD1);
        await generateSidebarSnapshot(blogD1);
    }

    deleteCache(NEXT_SCHEDULED_CACHE_KEY);
    deleteCacheByPrefix('categories:');
    deleteCacheByPrefix('settings:');

    const backgroundWork = (async () => {
        try {
            const cacheRow = await blogD1
                .prepare("SELECT value FROM blog_settings WHERE key = 'enable_cdn_cache'")
                .first<{ value?: string }>();
            const zoneId = platform?.env?.CLOUDFLARE_ZONE_ID;
            const apiToken = platform?.env?.CLOUDFLARE_API_TOKEN;
            if (cacheRow?.value === 'true' && zoneId && apiToken) {
                await purgeEverything(zoneId, apiToken);
            }
        } catch (purgeErr) {
            console.error('[Scheduled Purge Error]:', purgeErr);
        }
    })();

    if (platform?.context?.waitUntil) {
        platform.context.waitUntil(backgroundWork);
    } else {
        backgroundWork.catch((e) => console.error('[Scheduled Background Error]:', e));
    }
}

/**
 * 예약 공개 시각이 경과한 포스트를 원자적으로 published 상태로 전환하고,
 * 카테고리 카운트·사이드바 스냅샷·캐시·Hub 신디케이션을 갱신합니다.
 */
export async function processDueScheduledPosts(
    blogD1: D1Database,
    platform: any
): Promise<void> {
    try {
        const nextScheduledAt = await getOrSetCache<string | null>(
            NEXT_SCHEDULED_CACHE_KEY,
            60,
            async () => {
                const row = await blogD1
                    .prepare("SELECT value FROM blog_settings WHERE key = 'next_scheduled_at'")
                    .first<{ value?: string }>();
                return row?.value?.trim() || null;
            }
        );

        if (!nextScheduledAt) return;

        const nowIso = new Date().toISOString();
        if (nowIso < nextScheduledAt) return;

        if (!inFlightPublish) {
            inFlightPublish = runDuePublish(blogD1, platform, nowIso).finally(() => {
                inFlightPublish = null;
            });
        }
        await inFlightPublish;
    } catch (err) {
        console.error('[Scheduled Publish Error]:', err);
    }
}
