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

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStorageAdapter } from '$lib/server/storageAdapter';

/**
 * Regex matching image URLs that belong to our storage engines:
 * 1. Domain proxy URLs: /images/uploads/... or https?://domain/images/uploads/...
 * 2. ImageKit URLs: https?://ik.imagekit.io/.../uploads/...
 * 3. R2 direct URLs: https?://...r2.dev/uploads/...
 * 4. Supabase direct URLs: https?://.../storage/v1/object/public/.../uploads/...
 *
 * Capture group 1: The key path starting with "uploads/"
 */
const IMAGE_URL_REGEX = /(?:(?:https?:\/\/[^\/"'\s<>)]+)?\/images\/|https?:\/\/ik\.imagekit\.io\/[^\/"'\s<>)]+\/|https?:\/\/[^\/"'\s<>)]+\.r2\.dev\/|https?:\/\/[^\/"'\s<>)]+\/storage\/v1\/object\/public\/[^\/"'\s<>)]+\/)(uploads\/[^\s"'<>\)]+\.(?:webp|png|jpg|jpeg|gif|svg|avif))/gi;

interface MigrateRequestBody {
    keys?: string[]; // Optional: list of specific keys restored
}

export const POST: RequestHandler = async ({ request, platform, locals, url }) => {
    const db = locals.blogDb ?? platform?.env?.BLOG_DB;
    if (!db) {
        return json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        let body: MigrateRequestBody = {};
        try {
            body = await request.json();
        } catch {
            // Body is optional
        }

        const restoredKeysSet = body.keys && body.keys.length > 0 ? new Set(body.keys) : null;

        // 1. Resolve siteUrl
        let siteUrl = url.origin;
        try {
            const row = await db
                .prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'")
                .first<{ value: string }>();
            if (row?.value) {
                siteUrl = row.value.replace(/\/$/, '');
            }
        } catch (e) {
            console.warn('[Migrate URLs] Failed to fetch siteUrl from DB, using origin:', e);
        }

        // 2. Obtain active storage adapter
        const adapter = await getStorageAdapter(platform!, db);

        // 3. Query all posts with possible image references
        const posts = await db
            .prepare(`
                SELECT id, content, content_markdown, featured_image 
                FROM posts 
                WHERE content LIKE '%uploads/%' 
                   OR content_markdown LIKE '%uploads/%' 
                   OR featured_image LIKE '%uploads/%'
            `)
            .all<{
                id: string;
                content: string | null;
                content_markdown: string | null;
                featured_image: string | null;
            }>();

        const postList = posts.results || [];
        let updatedPostsCount = 0;
        let totalReplacedUrls = 0;

        const statements: any[] = [];

        for (const post of postList) {
            let postModified = false;
            let newContent = post.content || '';
            let newMarkdown = post.content_markdown || '';
            let newFeatured = post.featured_image || '';

            // Helper to replace URLs in a string
            const replaceInString = (input: string): string => {
                if (!input) return input;
                return input.replace(IMAGE_URL_REGEX, (fullMatch, key) => {
                    // If a specific set of restored keys was provided, ensure key is in set
                    if (restoredKeysSet && !restoredKeysSet.has(key)) {
                        return fullMatch;
                    }

                    const targetUrl = adapter.getPublicUrl(key, siteUrl);
                    if (targetUrl && targetUrl !== fullMatch) {
                        postModified = true;
                        totalReplacedUrls++;
                        return targetUrl;
                    }
                    return fullMatch;
                });
            };

            if (post.content) {
                newContent = replaceInString(post.content);
            }
            if (post.content_markdown) {
                newMarkdown = replaceInString(post.content_markdown);
            }
            if (post.featured_image) {
                newFeatured = replaceInString(post.featured_image);
            }

            if (postModified) {
                updatedPostsCount++;
                statements.push(
                    db.prepare(`
                        UPDATE posts 
                        SET content = ?, content_markdown = ?, featured_image = ? 
                        WHERE id = ?
                    `).bind(newContent, newMarkdown || null, newFeatured || null, post.id)
                );
            }
        }

        // 4. Batch execute in chunks of 50 to respect D1 limits
        const CHUNK_SIZE = 50;
        for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
            const chunk = statements.slice(i, i + CHUNK_SIZE);
            await db.batch(chunk);
        }

        return json({
            success: true,
            updatedPosts: updatedPostsCount,
            replacedImages: totalReplacedUrls,
        });

    } catch (e: any) {
        console.error('[Migrate URLs] Error:', e);
        return json({ error: 'Migration failed', details: e.message }, { status: 500 });
    }
};
