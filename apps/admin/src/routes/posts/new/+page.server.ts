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
import { error, fail, redirect } from '@sveltejs/kit';
import { marked } from 'marked';
import { processContentHtml } from '$lib/utils/contentProcessor';

// Configure marked
marked.setOptions({
    gfm: true,
    breaks: true
});

// Helper: Extract first image src or YouTube thumbnail from HTML content
function extractFirstImageSrc(html: string): string | undefined {
    if (!html) return undefined;

    // 1. Try to find the first <img> tag
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];

    // 2. Try to find a YouTube video ID (from iframe src or link)
    // Supports: youtube.com/embed/ID, youtube.com/watch?v=ID, youtu.be/ID
    const youtubeMatch = html.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) {
        return `https://img.youtube.com/vi/${youtubeMatch[1]}/0.jpg`;
    }

    return undefined;
}

export const load: PageServerLoad = async ({ locals }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    try {
        const { results: languages } = await db.prepare('SELECT * FROM languages ORDER BY sort_order ASC, code ASC').all();
        const { results: categories } = await db.prepare('SELECT slug, name, lang FROM categories WHERE tenant_id = ? ORDER BY name ASC').bind(locals.tenantId).all();
        const { results: settingsRows } = await db.prepare("SELECT key, value FROM blog_settings WHERE tenant_id = ? AND key IN ('board_api_key', 'board_hub_url', 'board_auto_syndicate')").bind(locals.tenantId).all();
        const settingsMap = (settingsRows || []).reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {});

        return { 
            groupId: crypto.randomUUID(),
            languages: languages || [],
            categories: categories || [],
            settings: settingsMap
        };
    } catch (err) {
        throw error(500, 'Failed to load editor resources');
    }
};

export const actions: Actions = {
    default: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const groupDataStr = data.get('groupData') as string;
        
        if (!groupDataStr) {
            return fail(400, { error: 'Group data is missing' });
        }

        let groupData: any[];
        try {
            groupData = JSON.parse(groupDataStr);
        } catch(e) {
            return fail(400, { error: 'Invalid group data' });
        }

        try {
            const adminIdRow = await db.prepare(
                "SELECT value FROM blog_settings WHERE tenant_id = ? AND key = 'admin_user_id'"
            ).bind(locals.tenantId).first();
            const defaultAuthorId = adminIdRow?.value as string || 'admin';

            for (const item of groupData) {
                // Skip tabs with empty title (e.g. unused language tabs)
                if (!item.title?.trim()) continue;

                const id = crypto.randomUUID();
                const title = item.title;
                const slug = item.slug;
                const contentType = item.contentType || item.content_type || 'html';
                const contentMarkdown = item.contentMarkdown || item.content_markdown || '';
                let content = item.content || '';

                if (contentType === 'markdown') {
                    // Extract body if Front-Matter is present
                    const parts = contentMarkdown.split(/^---\s*$/m);
                    const mdBody = parts.length >= 3 ? parts.slice(2).join('---').trim() : contentMarkdown.trim();
                    content = (await marked.parse(mdBody)) as string;
                }

                // 저장 시점 파싱 (Save-Time Parsing) 적용
                content = processContentHtml(content);

                const excerpt = item.excerpt;
                const category = item.categorySlug || item.category_slug || '';
                const categoryName = item.categoryName || item.category_name || '';
                const status = item.status || 'draft';
                const type = item.type || 'post';
                const author_id = item.authorId || item.author_id || defaultAuthorId;
                const lang = item.lang || 'ko';
                const tagsJson = Array.isArray(item.tags) ? JSON.stringify(item.tags) : JSON.stringify(item.tags ? item.tags.split(',').map((t:string)=>t.trim()) : []);
                const featured_image = extractFirstImageSrc(content) || '';
                const thumbnail_fit = item.thumbnailFit || item.thumbnail_fit || 'cover';
                const groupId = item.translation_group_id;

                if (!title || !slug) continue;

                if (category) {
                    await db.prepare(`
                        INSERT OR REPLACE INTO categories (tenant_id, slug, name, lang, translation_group_id)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(locals.tenantId, category, categoryName || category, lang, category).run();
                }

                const shouldSyndicate = status === 'published' && (item.submitToBoard === true || item.submitToBoard === 'true');
                let isSyndicatedVal = shouldSyndicate ? 1 : 0;

                await db.prepare(`
                    INSERT INTO posts (id, tenant_id, title, slug, content, excerpt, category_slug, type, author_id, status, tags, featured_image, lang, translation_group_id, content_type, content_markdown, thumbnail_fit, is_syndicated, created_at, updated_at, published_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+9 hours'), datetime('now', '+9 hours'), 
                    CASE WHEN ? = 'published' THEN datetime('now', '+9 hours') ELSE NULL END)
                `).bind(
                    id, locals.tenantId, title, slug, content, excerpt || '', category || '일반', type, author_id, status, tagsJson, featured_image, lang, groupId, contentType, contentMarkdown || null, thumbnail_fit, isSyndicatedVal, status
                ).run();

                // 허브 자동 제출 훅 (status === 'published' & submitToBoard === true)
                if (shouldSyndicate) {
                    try {
                        const { publishPostToHub } = await import('$lib/server/hub');
                        const res = await publishPostToHub({
                            title,
                            slug,
                            excerpt,
                            content: contentType === 'markdown' ? contentMarkdown : content,
                            contentType,
                            categorySlug: category || '일반',
                            featuredImage: featured_image,
                            tags: tagsJson,
                            lang
                        }, db);
                        if (!res.success) {
                            if (res.code === 'PROHIBITED_CONTENT_DETECTED') {
                                console.warn(`[Hub Moderation Warning] Post '${title}' was rejected by hub moderation policy (PROHIBITED_CONTENT_DETECTED)`);
                            } else {
                                console.warn(`[Hub Sync Warning] Post '${title}' sync failed with code: ${res.code}`, res.error || res.reason);
                            }
                            // 허브 등록 거절/실패 시 DB의 is_syndicated 플래그를 0으로 보정
                            await db.prepare('UPDATE posts SET is_syndicated = 0 WHERE id = ?').bind(id).run();
                        }
                    } catch (e) {
                        console.error('[Hub Sync Error]', e);
                        await db.prepare('UPDATE posts SET is_syndicated = 0 WHERE id = ?').bind(id).run().catch(() => {});
                    }
                }
            }

            try {
                const cacheRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'enable_cdn_cache'").first();
                if (cacheRow?.value === 'true') {
                    const firstItem = groupData.find(item => item.title?.trim() && item.slug);
                    const purgeOptions = firstItem ? {
                        categorySlug: firstItem.category || '일반',
                        slug: firstItem.slug
                    } : { purgeEverything: true };
                    
                    const { purgeCdnCache } = await import('$lib/server/cachePurge');
                    purgeCdnCache(platform, db, purgeOptions).catch(e => console.error('[Purge Error]', e));
                }
            } catch (e) {
                console.error('[Purge Error]', e);
            }

            throw redirect(303, '/posts');
        } catch (err: any) {
            if (err.status === 303) throw err;
            console.error('Failed to create posts:', err);
            if (err.message?.includes('UNIQUE constraint failed')) {
                return fail(409, { error: 'Slug must be unique per language' });
            }
            return fail(500, { error: `Failed to create posts: ${err.message || err}` });
        }
    }
};
