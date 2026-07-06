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

export const load: PageServerLoad = async ({ platform, locals }) => {
    const db = locals.blogDb;

    if (!db) {
        throw error(500, 'Database not found');
    }

    try {
        // Fetch all posts to extract media URLs
        const { results: posts } = await db.prepare(
            'SELECT id, title, slug, content FROM posts WHERE content IS NOT NULL'
        ).all();

        // Extract media URLs from post content
        const linkedMedia: Array<{
            postId: string;
            postTitle: string;
            postSlug: string;
            type: 'image' | 'video' | 'iframe' | 'file';
            url: string;
            isInternal: boolean;
        }> = [];

        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const videoRegex = /<video[^>]+src=["']([^"']+)["']/gi;
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        const fileRegex = /<a[^>]+href=["']([^"']+)["']/gi;

        for (const post of posts as any[]) {
            const content = post.content || '';

            // Extract images
            let match;
            while ((match = imgRegex.exec(content)) !== null) {
                linkedMedia.push({
                    postId: post.id,
                    postTitle: post.title,
                    postSlug: post.slug,
                    type: 'image',
                    url: match[1],
                    isInternal: match[1].includes('/images/') || match[1].startsWith('/images/'),
                });
            }

            // Extract videos
            while ((match = videoRegex.exec(content)) !== null) {
                linkedMedia.push({
                    postId: post.id,
                    postTitle: post.title,
                    postSlug: post.slug,
                    type: 'video',
                    url: match[1],
                    isInternal: match[1].includes('/images/'),
                });
            }

            // Extract iframes (YouTube, etc.)
            while ((match = iframeRegex.exec(content)) !== null) {
                linkedMedia.push({
                    postId: post.id,
                    postTitle: post.title,
                    postSlug: post.slug,
                    type: 'iframe',
                    url: match[1],
                    isInternal: false, // iframes are always external
                });
            }

            // Extract file attachments (<a> links referencing /images/)
            while ((match = fileRegex.exec(content)) !== null) {
                if (match[1].includes('/images/')) {
                    linkedMedia.push({
                        postId: post.id,
                        postTitle: post.title,
                        postSlug: post.slug,
                        type: 'file',
                        url: match[1],
                        isInternal: true,
                    });
                }
            }
        }

        // Get storage_type from blog_settings (default to r2)
        const row = await db.prepare('SELECT value FROM blog_settings WHERE key = ?').bind('storage_type').first();
        const storageType = (row?.value as string) || 'r2';

        // Get siteUrl for image proxy
        const siteUrlRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").first();
        const siteUrl = ((siteUrlRow?.value as string) || '').replace(/\/$/, '');

        return {
            linkedMedia,
            storageType,
            siteUrl,
            bucketInfo: {
                name: 'blog-images',
                folderStructure: 'posts/{slug}/{variant}/',
                variants: ['desktop', 'mobile', 'original'],
            },
        };
    } catch (err: any) {
        console.error('Failed to load media page:', err);
        throw error(500, 'Failed to load media data');
    }
};
