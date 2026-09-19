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

export interface SidebarSnapshotItem {
    id: string;
    title: string;
    slug: string;
    categorySlug?: string;
    categoryName?: string;
    displayDate?: string;
    createdAt?: string;
    publishedAt?: string;
    viewCount?: number;
    likeCount?: number;
}

export interface SidebarCategoryItem {
    id: string;
    name: string;
    slug: string;
    count: number;
}

export interface SidebarSnapshot {
    updatedAt: string;
    recentPosts: Record<string, SidebarSnapshotItem[]>;
    popularPosts: Record<string, SidebarSnapshotItem[]>;
    categories: Record<string, SidebarCategoryItem[]>;
}

/**
 * Pre-computes and caches recent posts, popular posts, and category counts
 * into a single static JSON snapshot in blog_settings (key = 'sidebar_snapshot').
 * Triggered on post publish/update/delete and batch view count flushes.
 */
export async function generateSidebarSnapshot(d1: any): Promise<SidebarSnapshot | null> {
    if (!d1 || typeof d1.prepare !== 'function') {
        return null;
    }

    try {
        // 1. Get all supported languages
        let langCodes: string[] = ['ko'];
        try {
            const { results } = await d1.prepare("SELECT code FROM languages ORDER BY sort_order ASC").all();
            if (results && results.length > 0) {
                langCodes = results.map((r: any) => r.code);
            }
        } catch {
            langCodes = ['ko', 'en', 'ja'];
        }

        const recentPosts: Record<string, SidebarSnapshotItem[]> = {};
        const popularPosts: Record<string, SidebarSnapshotItem[]> = {};
        const categories: Record<string, SidebarCategoryItem[]> = {};

        for (const lang of langCodes) {
            // Recent posts (Top 10)
            try {
                const { results: recents } = await d1.prepare(`
                    SELECT p.id, p.title, p.slug, p.category_slug as categorySlug,
                           c.name as categoryName, p.created_at as createdAt, p.published_at as publishedAt,
                           COALESCE(p.published_at, p.created_at) as displayDate,
                           p.view_count as viewCount, p.like_count as likeCount
                    FROM posts p
                    LEFT JOIN categories c ON c.slug = p.category_slug AND c.lang = p.lang
                    WHERE p.status = 'published' AND p.type = 'post' AND p.lang = ?
                    ORDER BY COALESCE(p.published_at, p.created_at) DESC
                    LIMIT 10
                `).bind(lang).all();

                recentPosts[lang] = (recents || []).map((r: any) => ({
                    id: String(r.id),
                    title: String(r.title || ''),
                    slug: String(r.slug || ''),
                    categorySlug: r.categorySlug || undefined,
                    categoryName: r.categoryName || undefined,
                    displayDate: r.displayDate || r.createdAt,
                    createdAt: r.createdAt,
                    publishedAt: r.publishedAt,
                    viewCount: Number(r.viewCount || 0),
                    likeCount: Number(r.likeCount || 0)
                }));
            } catch (e) {
                console.error(`[Snapshot] Failed to fetch recent posts for lang ${lang}:`, e);
                recentPosts[lang] = [];
            }

            // Popular posts (Top 10)
            try {
                const { results: populars } = await d1.prepare(`
                    SELECT p.id, p.title, p.slug, p.category_slug as categorySlug,
                           c.name as categoryName, p.created_at as createdAt, p.published_at as publishedAt,
                           COALESCE(p.published_at, p.created_at) as displayDate,
                           p.view_count as viewCount, p.like_count as likeCount
                    FROM posts p
                    LEFT JOIN categories c ON c.slug = p.category_slug AND c.lang = p.lang
                    WHERE p.status = 'published' AND p.type = 'post' AND p.lang = ?
                    ORDER BY p.view_count DESC, COALESCE(p.published_at, p.created_at) DESC
                    LIMIT 10
                `).bind(lang).all();

                popularPosts[lang] = (populars || []).map((r: any) => ({
                    id: String(r.id),
                    title: String(r.title || ''),
                    slug: String(r.slug || ''),
                    categorySlug: r.categorySlug || undefined,
                    categoryName: r.categoryName || undefined,
                    displayDate: r.displayDate || r.createdAt,
                    createdAt: r.createdAt,
                    publishedAt: r.publishedAt,
                    viewCount: Number(r.viewCount || 0),
                    likeCount: Number(r.likeCount || 0)
                }));
            } catch (e) {
                console.error(`[Snapshot] Failed to fetch popular posts for lang ${lang}:`, e);
                popularPosts[lang] = [];
            }

            // Categories (with post counts)
            try {
                const { results: cats } = await d1.prepare(`
                    SELECT c.slug, c.name, COUNT(p.id) as count
                    FROM categories c
                    INNER JOIN posts p ON p.category_slug = c.slug AND p.lang = c.lang AND p.status = 'published' AND p.type = 'post'
                    WHERE c.lang = ?
                    GROUP BY c.slug, c.name
                    HAVING count > 0
                    ORDER BY c.name ASC
                `).bind(lang).all();

                categories[lang] = (cats || []).map((c: any) => ({
                    id: String(c.slug),
                    name: String(c.name || ''),
                    slug: String(c.slug || ''),
                    count: Number(c.count || 0)
                }));
            } catch (e) {
                console.error(`[Snapshot] Failed to fetch categories for lang ${lang}:`, e);
                categories[lang] = [];
            }
        }

        const snapshot: SidebarSnapshot = {
            updatedAt: new Date().toISOString(),
            recentPosts,
            popularPosts,
            categories
        };

        const snapshotJson = JSON.stringify(snapshot);

        // Store into blog_settings table
        await d1.prepare(`
            INSERT INTO blog_settings (key, value, updated_at)
            VALUES ('sidebar_snapshot', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).bind(snapshotJson).run();

        return snapshot;
    } catch (err) {
        console.error('[Snapshot] Failed to generate sidebar snapshot:', err);
        return null;
    }
}
