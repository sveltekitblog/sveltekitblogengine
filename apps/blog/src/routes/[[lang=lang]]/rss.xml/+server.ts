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

export const GET: RequestHandler = async ({ platform, url, params, locals }) => {
    const db = platform?.env?.BLOG_DB;
    if (!db) {
        return new Response('Database not available', { status: 500 });
    }

    try {
        const siteUrl = url.origin;

        // Fetch settings for site title/description
        const { results: settings } = await db
            .prepare('SELECT key, value FROM blog_settings WHERE key IN (?, ?)')
            .bind('site_title', 'description')
            .all();

        const settingsMap = settings.reduce((acc: any, curr: any) => {
            try {
                acc[curr.key] = JSON.parse(curr.value);
            } catch {
                acc[curr.key] = curr.value;
            }
            return acc;
        }, {});

        const dbDefaultLang = locals.dbDefaultLang || 'ko';
        const lang = params.lang || dbDefaultLang;

        const getLocalized = (val: any) => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            return val[lang] || val[dbDefaultLang] || '';
        };

        const siteTitle = getLocalized(settingsMap.site_title) || 'Blog';
        const siteDescription = getLocalized(settingsMap.description) || 'Blog RSS Feed';

        // Fetch recent 20 published posts with category info strictly for specific language
        const { results: posts } = await db
            .prepare(`
                SELECT p.title, p.slug, p.category_slug, p.content, p.excerpt, 
                       p.featured_image, p.published_at, c.name as category_name
                FROM posts p
                LEFT JOIN categories c ON p.category_slug = c.slug AND c.lang = p.lang
                WHERE p.status = 'published' AND p.lang = ?
                ORDER BY p.published_at DESC
                LIMIT 20
            `)
            .bind(lang)
            .all();

        // Helper to determine MIME type from URL extension
        const getMimeType = (imageUrl: string) => {
            const ext = imageUrl.split('.').pop()?.toLowerCase();
            switch (ext) {
                case 'webp': return 'image/webp';
                case 'png': return 'image/png';
                case 'gif': return 'image/gif';
                case 'svg': return 'image/svg+xml';
                default: return 'image/jpeg';
            }
        };

        // Helper to escape CDATA content safely by coercing to string
        const escapeForCDATA = (val: any) => val ? String(val).replace(/]]>/g, ']]&gt;') : '';

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/rss.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
    <channel>
        <title>${escapeForCDATA(siteTitle)}</title>
        <link>${siteUrl}</link>
        <description>${escapeForCDATA(siteDescription)}</description>
        <language>${lang}</language>
        <atom:link href="${siteUrl}${lang !== dbDefaultLang ? `/${lang}` : ''}/rss.xml" rel="self" type="application/rss+xml"/>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((post: any) => `        <item>
            <title><![CDATA[${escapeForCDATA(post.title)}]]></title>
            <link>${siteUrl}${lang === dbDefaultLang ? '' : `/${lang}`}/${post.category_slug}/${post.slug}</link>
            <guid isPermaLink="true">${siteUrl}${lang === dbDefaultLang ? '' : `/${lang}`}/${post.category_slug}/${post.slug}</guid>
            <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
            <description><![CDATA[${escapeForCDATA(post.excerpt || '')}]]></description>
            <content:encoded><![CDATA[${escapeForCDATA(post.content)}]]></content:encoded>${post.category_name ? `
            <category>${escapeForCDATA(post.category_name)}</category>` : ''}${post.featured_image ? `
            <enclosure url="${post.featured_image}" length="0" type="${getMimeType(post.featured_image)}"/>` : ''}
        </item>`).join('\n')}
    </channel>
</rss>`;

        return new Response(rss, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate' // Bust Cloudflare cache
            }
        });
    } catch (error: any) {
        console.error('Error generating RSS feed:', error);
        return new Response(`Error generating RSS feed: ${error?.message || error}`, { status: 500 });
    }
};
