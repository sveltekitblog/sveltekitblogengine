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

export const prerender = false;

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
                SELECT slug, category_slug, updated_at, lang, translation_group_id 
                FROM posts 
                WHERE status = 'published' AND type = 'post'
                ORDER BY updated_at DESC
            `)
            .all();

        // Fetch all categories
        const { results: categories } = await db
            .prepare('SELECT slug, lang FROM categories')
            .all();

        // Fetch all active languages configured in admin DB
        const { results: dbLanguages } = await db
            .prepare('SELECT code FROM languages ORDER BY sort_order ASC')
            .all();
        const activeLangs = (dbLanguages && dbLanguages.length > 0) ? dbLanguages.map((l: any) => l.code) : [dbDefaultLang];

        // Group posts by translation_group_id for alternates
        const groupMap = new Map<string, Array<{ lang: string; slug: string; category_slug: string }>>();
        (posts || []).forEach((p: any) => {
            if (p.translation_group_id) {
                const list = groupMap.get(p.translation_group_id) || [];
                list.push({ lang: p.lang, slug: p.slug, category_slug: p.category_slug });
                groupMap.set(p.translation_group_id, list);
            }
        });

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    <url>
        <loc>${siteUrl}/</loc>
${activeLangs.map((code: string) => `        <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${code === dbDefaultLang ? '' : `/${code}`}/" />`).join('\n')}
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${siteUrl}/guestbook</loc>
        <changefreq>weekly</changefreq>
        <priority>0.5</priority>
    </url>
${categories.map((cat: any) => `    <url>
        <loc>${siteUrl}${cat.lang !== dbDefaultLang ? `/${cat.lang}` : ''}/${cat.slug}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`).join('\n')}
${(posts || []).map((post: any) => {
    const translations = post.translation_group_id ? (groupMap.get(post.translation_group_id) || []) : [];
    const alternateLinks = translations.map((tr: any) => 
        `        <xhtml:link rel="alternate" hreflang="${tr.lang}" href="${siteUrl}${tr.lang !== dbDefaultLang ? `/${tr.lang}` : ''}/${tr.category_slug}/${tr.slug}" />`
    ).join('\n');
    return `    <url>
        <loc>${siteUrl}${post.lang !== dbDefaultLang ? `/${post.lang}` : ''}/${post.category_slug}/${post.slug}</loc>
${alternateLinks ? alternateLinks + '\n' : ''}        <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
}).join('\n')}
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
            }
        });
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return new Response('Error generating sitemap', { status: 500 });
    }
};
