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

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    // Get USER_DB for view counts
    const userDb = platform?.env?.USER_DB;

    try {
        // Posts 목록 (작성자 JOIN 제거, 단일 관리자 가정)
        const { results: postsRaw } = await db.prepare(`
            SELECT * FROM posts ORDER BY created_at DESC
        `).all();

        // Aggregate view counts from USER_DB
        let viewCountMap: Record<string, number> = {};
        if (userDb) {
            try {
                const { results: viewResults } = await userDb.prepare(`
                    SELECT post_id, SUM(views) as total_views FROM post_views GROUP BY post_id
                `).all();

                for (const row of viewResults as any[]) {
                    viewCountMap[row.post_id] = row.total_views || 0;
                }
            } catch (e) {
                console.warn('Failed to load view counts:', e);
            }
        }

        const posts = postsRaw.map((p: any) => ({
            ...p,
            author_name: 'Admin',
            view_count: viewCountMap[p.id] || 0
        }));

        return {
            posts
        };
    } catch (err) {
        console.error('Failed to load posts:', err);
        throw error(500, 'Failed to load posts');
    }
};

export const actions: Actions = {
    delete: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const id = data.get('id') as string;

        if (!id) {
            return fail(400, { error: 'Post ID is required' });
        }

        try {
            const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
            if (!post) {
                return fail(404, { error: 'Post not found' });
            }

            // 1. Delete associated images using StorageAdapter
            const slug = (post as any).slug;
            if (slug && platform) {
                try {
                    const { getStorageAdapter } = await import('$lib/server/storageAdapter');
                    const adapter = await getStorageAdapter(platform, db);

                    const prefix = `posts/${slug}/`;
                    // R2 lists recursively, but Supabase/ImageKit only list the exact folder.
                    // We must list known subfolders to ensure all variants are deleted.
                    const pathsToCheck = [prefix, `${prefix}original/`, `${prefix}desktop/`, `${prefix}mobile/`, `${prefix}thumbnail/`];
                    const keysToDelete: string[] = [];
                    let isDisabled = false;

                    for (const p of pathsToCheck) {
                        const list = await adapter.list(p);
                        if (list.disabled) {
                            isDisabled = true;
                            break;
                        }
                        keysToDelete.push(...list.objects.map(obj => obj.key));
                        keysToDelete.push(p); // 폴더 삭제를 지원하는 어댑터를 위해 폴더 키 자체도 추가
                    }

                    // Deduplicate keys (R2 might return the same key multiple times if it's recursive)
                    const uniqueKeys = Array.from(new Set(keysToDelete));

                    if (uniqueKeys.length > 0) {
                        await adapter.delete(uniqueKeys);
                        console.log(`Deleted ${uniqueKeys.length} images for post: ${slug} using configured storage type`);
                    } else if (isDisabled) {
                        // KV: list isn't supported to save costs.
                        // We must parse the post content to find image URLs
                        const content = (post as any).content || '';
                        const matches = [...content.matchAll(/src=["'](.*?)["']/g)];
                        const parsedKeys: string[] = [];

                        for (const match of matches) {
                            const url = match[1];
                            if (url.includes(`/images/posts/${slug}/`)) {
                                // Extract the relative key, e.g., 'posts/slug/filename.webp'
                                const keyMatch = url.match(new RegExp(`(posts/${slug}/.*)`));
                                if (keyMatch) parsedKeys.push(keyMatch[1]);
                            }
                        }

                        const uniqueParsedKeys = Array.from(new Set(parsedKeys));
                        if (uniqueParsedKeys.length > 0) {
                            await adapter.delete(uniqueParsedKeys);
                            console.log(`KV mode: parsed ${uniqueParsedKeys.length} keys from content and deleted them`);
                        }
                    }
                } catch (storageError) {
                    console.error('Failed to cleanup images during post deletion:', storageError);
                    // Don't block post deletion, just log it
                }
            }

            // 2. Delete from BLOG_DB
            // Try to disable foreign keys to bypass 'no such table: main.user' error
            try {
                // This might not work in all D1 environments but good to try.
                await db.prepare('PRAGMA foreign_keys = OFF').run();
            } catch (pragmaErr) {
                console.warn('Failed to disable foreign keys:', pragmaErr);
            }

            await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();

            try {
                const cacheRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'enable_cdn_cache'").first();
                if (cacheRow?.value === 'true') {
                    const { purgeCdnCache } = await import('$lib/server/cachePurge');
                    const pSlug = (post as any).slug;
                    const pCategory = (post as any).category_slug;
                    // category가 없을 경우 기본값으로 '일반'을 사용합니다.
                    purgeCdnCache(platform, db, {
                        categorySlug: pCategory || '일반',
                        slug: pSlug
                    }).catch(e => console.error('[Purge Error]', e));
                }
            } catch (e) {
                console.error('[Purge Error]', e);
            }

            // 2.5. Cleanup orphaned categories
            try {
                await db.prepare(`
                    DELETE FROM categories 
                    WHERE slug NOT IN (
                        SELECT DISTINCT category_slug 
                        FROM posts 
                        WHERE category_slug IS NOT NULL
                    )
                `).run();
            } catch (catErr) {
                console.warn('Failed to cleanup categories:', catErr);
            }

            // 3. Delete from USER_DB (post_views) safely
            const userDb = platform?.env?.USER_DB;
            if (userDb) {
                try {
                    await userDb.prepare('DELETE FROM post_views WHERE post_id = ?').bind(id).run();
                } catch (e) {
                    console.warn('Failed to delete post views:', e);
                }
            } else {
                console.warn('USER_DB not available for deleting views');
            }

            return { success: true };
        } catch (err: any) {
            console.error('Failed to delete post:', err);

            // Debugging: Check for ANY table referencing 'user'
            if (err.message?.includes('user')) {
                try {
                    const suspiciousTables = await db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%user%'").all();
                    console.log('DEBUG: Tables referencing "user":', suspiciousTables);
                } catch (schemaErr) {
                    console.error('Failed to fetch debug info:', schemaErr);
                }
            }

            // Return actual error message for debugging
            return fail(500, { error: err.message || 'Failed to delete post' });
        }
    }
};
