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

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, url, locals }) => {
    const db = platform?.env?.BLOG_DB;
    if (!db) {
        return new Response('Database not available', { status: 500 });
    }

    try {
        const siteUrl = url.origin;
        const dbDefaultLang = locals.dbDefaultLang || 'ko';

        // Fetch all published posts
        const { results: posts } = await db
            .prepare(`
                SELECT slug, category_slug, updated_at, lang 
                FROM posts 
                WHERE status = 'published' 
                ORDER BY updated_at DESC
            `)
            .all();

        // Fetch all categories
        const { results: categories } = await db
            .prepare('SELECT slug, lang FROM categories')
            .all();

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${siteUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
${categories.map((cat: any) => `    <url>
        <loc>${siteUrl}${cat.lang !== dbDefaultLang ? `/${cat.lang}` : ''}/${cat.slug}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`).join('\n')}
${posts.map((post: any) => `    <url>
        <loc>${siteUrl}${post.lang !== dbDefaultLang ? `/${post.lang}` : ''}/${post.category_slug}/${post.slug}</loc>
        <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`).join('\n')}
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'max-age=3600' // Cache for 1 hour
            }
        });
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return new Response('Error generating sitemap', { status: 500 });
    }
};
