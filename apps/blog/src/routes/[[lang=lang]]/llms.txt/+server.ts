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

export const prerender = false;

import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getTrans(val: any, lang: string = 'ko', dbDefaultLang: string = 'ko'): string {
    if (!val) return '';
    if (typeof val === 'string') {
        if (val.startsWith('{')) {
            try {
                const parsed = JSON.parse(val);
                return parsed[lang] || parsed[dbDefaultLang] || Object.values(parsed)[0] || val;
            } catch (e) {
                return val;
            }
        }
        return val;
    }
    if (typeof val === 'object' && val !== null) {
        return val[lang] || val[dbDefaultLang] || Object.values(val)[0] || '';
    }
    return String(val);
}

function cleanExcerpt(content: string | null | undefined): string {
    if (!content) return '';
    return content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
    const dbDefaultLang = locals.dbDefaultLang || 'ko';
    const db = locals.db;
    const languages: Array<{ code: string; name: string; is_default: number }> = locals.languages || [];

    // URL 파라미터(/en/llms.txt) 또는 쿼리스트링(?lang=en)에서 요청 언어 확인
    const requestedLang = params.lang || url.searchParams.get('lang');
    const currentLang = (requestedLang && languages.some((l) => l.code === requestedLang))
        ? requestedLang
        : (locals.lang || dbDefaultLang);

    let siteTitle = 'Blog';
    let siteDescription = 'A technology and knowledge sharing blog.';
    let siteUrl = url.origin;

    let categories: any[] = [];
    let recentPosts: any[] = [];
    let pages: any[] = [];

    if (db) {
        try {
            const settings = await db.getSettings(currentLang, dbDefaultLang);
            siteTitle = getTrans(settings.header?.logoText, currentLang, dbDefaultLang)
                     || getTrans(settings.site_title, currentLang, dbDefaultLang)
                     || siteTitle;
            siteDescription = getTrans(settings.description, currentLang, dbDefaultLang) || siteDescription;
            if (settings.siteUrl) {
                siteUrl = settings.siteUrl;
            }

            [categories, recentPosts, pages] = await Promise.all([
                db.getCategories(currentLang, dbDefaultLang).catch(() => []),
                db.getRecentPosts(30, undefined, 1, 30, currentLang, dbDefaultLang).catch(() => []),
                db.getPages(currentLang, dbDefaultLang).catch(() => [])
            ]);
        } catch (e) {
            console.error('[llms.txt] Error fetching data from db:', e);
        }
    }

    const cleanBase = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const langPrefix = currentLang === dbDefaultLang ? '' : `/${currentLang}`;

    const lines: string[] = [];

    // 1. H1 Header & Blockquote summary (llmstxt.org specification)
    lines.push(`# ${siteTitle}`);
    lines.push('');
    lines.push(`> ${siteDescription}`);
    lines.push('');
    lines.push(`Welcome to ${siteTitle}. This document provides a structured summary of our blog articles, categories, and resources for Large Language Models (LLMs) and AI search agents.`);
    lines.push('');

    // 2. Multilingual navigation
    if (languages && languages.length > 1) {
        lines.push('## Available Languages');
        lines.push('');
        for (const langObj of languages) {
            const isCurrent = langObj.code === currentLang;
            const linkUrl = `${cleanBase}${langObj.code === dbDefaultLang ? '' : `/${langObj.code}`}/llms.txt`;
            lines.push(`- [${langObj.name || langObj.code}](${linkUrl})${isCurrent ? ' (Active)' : ''}`);
        }
        lines.push('');
    }

    // 3. Categories
    if (categories && categories.length > 0) {
        lines.push('## Categories');
        lines.push('');
        for (const cat of categories) {
            const catUrl = `${cleanBase}${langPrefix}/${cat.slug}`;
            const countText = cat.postCount ? ` (${cat.postCount} articles)` : '';
            lines.push(`- [${cat.name}](${catUrl}): ${cat.name} category topics${countText}`);
        }
        lines.push('');
    }

    // 4. Recent Articles
    if (recentPosts && recentPosts.length > 0) {
        lines.push('## Recent Articles');
        lines.push('');
        for (const post of recentPosts) {
            const postUrl = `${cleanBase}${langPrefix}/${post.categorySlug || 'all'}/${post.slug}`;
            const excerpt = cleanExcerpt(post.excerpt) || cleanExcerpt(post.title);
            lines.push(`- [${post.title}](${postUrl})${excerpt ? `: ${excerpt}` : ''}`);
        }
        lines.push('');
    }

    // 5. Pages
    if (pages && pages.length > 0) {
        lines.push('## Pages');
        lines.push('');
        for (const page of pages) {
            const pageUrl = `${cleanBase}${langPrefix}/${page.slug}`;
            lines.push(`- [${page.title}](${pageUrl})`);
        }
        lines.push('');
    }

    // 6. Feeds & Meta
    lines.push('## Feeds & Meta');
    lines.push('');
    lines.push(`- [RSS Feed](${cleanBase}/rss.xml): Latest blog updates in RSS format`);
    lines.push(`- [Sitemap](${cleanBase}/sitemap.xml): Complete XML sitemap for crawlers`);
    lines.push('');

    const canonicalSelfUrl = `${cleanBase}${currentLang === dbDefaultLang ? '' : `/${currentLang}`}/llms.txt`;

    return text(lines.join('\n'), {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=600',
            'Cloudflare-CDN-Cache-Control': 'public, max-age=600',
            'Link': `<${canonicalSelfUrl}>; rel="canonical"`
        }
    });
};
