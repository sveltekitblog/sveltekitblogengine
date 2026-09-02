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

// Helper: Strip <figure> wrappers to get raw <img> or <iframe> for editor parsing
function stripFigureWrapper(html: string): string {
    if (!html) return '';
    return html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (match, innerContent) => {
        // Strip out any <figcaption> tags inside the figure
        const contentWithoutCaption = innerContent.replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '').trim();
        return contentWithoutCaption;
    });
}

export const load: PageServerLoad = async ({ params, locals }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    try {
        // 1. Fetch current post to get translation_group_id
        const currentPost = await db.prepare('SELECT translation_group_id, id FROM posts WHERE id = ? AND tenant_id = ?').bind(params.id, locals.tenantId).first();
        if (!currentPost) throw error(404, 'Post not found');

        const groupId = (currentPost.translation_group_id as string) || currentPost.id;

        // 2. Fetch all posts in this translation group
        const { results: posts } = await db.prepare(`
            SELECT p.*, c.name as category_name
            FROM posts p
            LEFT JOIN categories c ON p.category_slug = c.slug AND c.lang = p.lang AND c.tenant_id = ?
            WHERE p.translation_group_id = ? AND p.tenant_id = ?
        `).bind(locals.tenantId, groupId, locals.tenantId).all();

        // 3. Fetch all languages, categories and settings
        const { results: languages } = await db.prepare('SELECT * FROM languages ORDER BY sort_order ASC, code ASC').all();
        const { results: categories } = await db.prepare('SELECT slug, name, lang FROM categories WHERE tenant_id = ? ORDER BY name ASC').bind(locals.tenantId).all();
        const { results: settingsRows } = await db.prepare("SELECT key, value FROM blog_settings WHERE tenant_id = ? AND key IN ('board_api_key', 'board_hub_url', 'board_auto_syndicate')").bind(locals.tenantId).all();
        const settingsMap = (settingsRows || []).reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {});

        // 4. Strip figure wrappers from post content for editor parsing compatibility
        const parsedPosts = (posts || []).map((post: any) => {
            if (post.content) {
                post.content = stripFigureWrapper(post.content);
            }
            return post;
        });

        return { 
            posts: parsedPosts, 
            groupId,
            languages: languages || [],
            categories: categories || [],
            settings: settingsMap
        };
    } catch (err) {
        console.error('Failed to load post translations:', err);
        throw error(500, 'Failed to load post');
    }
};

export const actions: Actions = {
    default: async ({ request, params, locals, platform }) => {
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
                // Skip any tab (new or existing) that has no title — prevents ghost posts from empty translation tabs
                if (!item.title?.trim()) continue;

                const id = item.id.startsWith('new-') ? crypto.randomUUID() : item.id;
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
                const category = item.category || item.categorySlug || item.category_slug || '';
                const categoryName = item.categoryName || item.category_name || '';
                const status = item.status || 'draft';
                const type = item.type || 'post';
                const author_id = item.authorId || item.author_id || defaultAuthorId;
                const lang = item.lang || 'ko';
                const tagsJson = Array.isArray(item.tags) ? JSON.stringify(item.tags) : JSON.stringify(item.tags ? item.tags.split(',').map((t:string)=>t.trim()) : []);
                const featured_image = extractFirstImageSrc(content) || '';
                const thumbnail_fit = item.thumbnailFit || item.thumbnail_fit || 'cover';
                const groupId = item.translation_group_id || params.id;

                if (!title || !slug) continue; // Skip incomplete tabs

                // 카테고리 정보 저장 (INSERT OR REPLACE: lang별 카테고리명 업데이트 허용)
                if (category) {
                    await db.prepare(`
                        INSERT OR REPLACE INTO categories (tenant_id, slug, name, lang, translation_group_id)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(locals.tenantId, category, categoryName || category, lang, category).run();
                }

                const shouldPublishToHub = status === 'published' && (item.submitToBoard === true || item.submitToBoard === 'true');
                const isSyndicatedVal = shouldPublishToHub ? 1 : 0;

                // Check if exists
                const existing = await db.prepare('SELECT id, is_syndicated, slug, category_slug, lang, published_at, created_at FROM posts WHERE id = ? AND tenant_id = ?').bind(id, locals.tenantId).first();
                
                if (existing) {
                    await db.prepare(`
                        UPDATE posts
                        SET title = ?, slug = ?, content = ?, excerpt = ?, category_slug = ?, type = ?,
                            author_id = ?, status = ?, tags = ?, featured_image = ?, lang = ?,
                            content_type = ?, content_markdown = ?, thumbnail_fit = ?, is_syndicated = ?,
                            updated_at = datetime('now', '+9 hours'),
                            published_at = CASE 
                                WHEN ? = 'published' THEN COALESCE(published_at, datetime('now', '+9 hours'))
                                ELSE NULL 
                            END
                        WHERE id = ? AND tenant_id = ?
                    `).bind(
                        title, slug, content, excerpt || '', category || '일반', type,
                        author_id, status, tagsJson, featured_image, lang, contentType, contentMarkdown || null, thumbnail_fit, isSyndicatedVal, status, id, locals.tenantId
                    ).run();
                } else {
                    await db.prepare(`
                        INSERT INTO posts (id, tenant_id, title, slug, content, excerpt, category_slug, type, author_id, status, tags, featured_image, lang, translation_group_id, content_type, content_markdown, thumbnail_fit, is_syndicated, created_at, updated_at, published_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+9 hours'), datetime('now', '+9 hours'), 
                        CASE WHEN ? = 'published' THEN datetime('now', '+9 hours') ELSE NULL END)
                    `).bind(
                        id, locals.tenantId, title, slug, content, excerpt || '', category || '일반', type, author_id, status, tagsJson, featured_image, lang, groupId, contentType, contentMarkdown || null, thumbnail_fit, isSyndicatedVal, status
                    ).run();
                }

                // 허브 동기화 / 비공개(숨김) 라이프사이클 처리
                try {
                    const { publishPostToHub, hidePostFromHub, removePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                    const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                    const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';
                    const currUrl = buildPostUrl(siteUrl, lang, category || '일반', slug);

                    // 💡 [핵심] 글 수정 시 수정일이 아닌 최초 발행일(published_at 또는 created_at)을 보존
                    const originalPublishedAt = (existing as any)?.published_at || (existing as any)?.created_at || new Date().toISOString();

                    // URL 변경 감지: 이전에 허브에 등록된 글의 슬러그/카테고리/언어가 변경된 경우 이전 URL 삭제
                    if (existing && (existing as any).is_syndicated === 1) {
                        const prevSlug = (existing as any).slug;
                        const prevCat = (existing as any).category_slug || '일반';
                        const prevLang = (existing as any).lang || 'ko';
                        const prevUrl = buildPostUrl(siteUrl, prevLang, prevCat, prevSlug);

                        if (prevUrl && prevUrl !== currUrl) {
                            await removePostFromHub(prevUrl, db);
                        }
                    }

                    if (shouldPublishToHub) {
                        // 1. 공개 발행/수정 -> 허브 카드 갱신
                        const res = await publishPostToHub({
                            title,
                            slug,
                            excerpt,
                            content: contentType === 'markdown' ? contentMarkdown : content,
                            contentType,
                            categorySlug: category || '일반',
                            featuredImage: featured_image,
                            tags: tagsJson,
                            lang,
                            url: currUrl,
                            publishedAt: originalPublishedAt
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
                    } else if (existing && (existing as any).is_syndicated === 1) {
                        // 2. 이전에 허브에 발행되었으나 비공개(draft)로 전환되었거나 허브 체크가 해제된 경우 -> 허브 피드 숨김 (좋아요 보존)
                        await hidePostFromHub({
                            title,
                            slug,
                            excerpt,
                            categorySlug: category || '일반',
                            featuredImage: featured_image,
                            tags: tagsJson,
                            lang,
                            url: currUrl,
                            publishedAt: originalPublishedAt
                        }, db);
                    }
                } catch (e) {
                    console.error('[Hub Sync/Hide Error]', e);
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
            console.error('Failed to update group posts:', err);
            if (err.message?.includes('UNIQUE constraint failed')) {
                return fail(409, { error: 'Slug must be unique per language' });
            }
            return fail(500, { error: `Failed to update posts: ${err.message || err}` });
        }
    }
};
