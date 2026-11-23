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

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { marked } from 'marked';
import { processContentHtml } from '$lib/utils/contentProcessor';
import { syncCategoryPostCounts, syncNextScheduledAt, zonedLocalInputToUtcIso } from '@blog/shared';

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
        const { results: categories } = await db.prepare('SELECT slug, name, lang FROM categories ORDER BY name ASC').all();
        const { results: settingsRows } = await db.prepare("SELECT key, value FROM blog_settings WHERE key IN ('board_api_key', 'board_hub_url', 'board_auto_syndicate')").all();
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
        
        if (!groupDataStr) return fail(400, { error: 'Group data is missing' });

        let groupData: any[];
        try {
            groupData = JSON.parse(groupDataStr);
        } catch(e) {
            return fail(400, { error: 'Invalid group data' });
        }

        try {
            const { results: metaSettings } = await db.prepare(
                "SELECT key, value FROM blog_settings WHERE key IN ('admin_user_id', 'timezone')"
            ).all();
            const metaMap: Record<string, string> = {};
            (metaSettings || []).forEach((r: any) => { metaMap[r.key] = r.value; });
            const defaultAuthorId = metaMap['admin_user_id'] || 'admin';
            const siteTimezone = metaMap['timezone']?.trim() || 'Asia/Seoul';

            const nowIso = new Date().toISOString();
            const scheduledUtcMap = new Map<any, string>();

            // 저장 전 예약 시각 전수 검증 (부분 저장 방지)
            for (const item of groupData) {
                if (!item.title?.trim() || !item.slug) continue;
                if (item.status === 'scheduled') {
                    const utcIso = zonedLocalInputToUtcIso(item.scheduledAt, siteTimezone);
                    if (!utcIso) {
                        return fail(400, { error: '예약 공개 시각을 입력해 주세요.' });
                    }
                    if (utcIso <= nowIso) {
                        return fail(400, { error: '과거 시각은 예약할 수 없습니다. 현재 이후 시각을 선택해 주세요.' });
                    }
                    scheduledUtcMap.set(item, utcIso);
                }
            }

            const hubTasks: Promise<any>[] = [];
            const hubResults: any[] = [];
            const createdIds: Record<string, string> = {};
            let hasPublishedPost = false;
            let hasScheduledPost = false;

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
                    const mdBody = parts.length >= 3 ? parts.slice(2).join("---").trim() : contentMarkdown.trim();
                    content = marked.parse(mdBody);
                }

                // 저장 시점 파싱 (Save-Time Parsing) 적용
                content = processContentHtml(content);

                const excerpt = item.excerpt;
                const category = item.category;
                const categoryName = item.categoryName;
                const status = item.status || 'draft';
                const type = item.type || 'post';
                const author_id = item.authorId || item.author_id || defaultAuthorId;
                const lang = item.lang || 'ko';
                const tagsJson = Array.isArray(item.tags) ? JSON.stringify(item.tags) : JSON.stringify(item.tags ? item.tags.split(',').map((t:string)=>t.trim()) : []);
                const featured_image = extractFirstImageSrc(content) || '';
                const thumbnail_fit = item.thumbnailFit || item.thumbnail_fit || 'cover';
                const groupId = item.translation_group_id;

                if (!title || !slug) continue;

                if (type === 'post' && category) {
                    await db.prepare(`
                        INSERT OR REPLACE INTO categories (slug, name, lang, translation_group_id)
                        VALUES (?, ?, ?, ?)
                    `).bind(category, categoryName || category, lang, category).run();
                }

                const wantsSyndicate = item.submitToBoard === true || item.submitToBoard === 'true';
                const shouldSyndicate = status === 'published' && wantsSyndicate;
                const isSyndicatedVal = shouldSyndicate ? 1 : 0;
                const publishedAtVal = status === 'published'
                    ? nowIso
                    : (status === 'scheduled' ? (scheduledUtcMap.get(item) || null) : null);

                await db.prepare(`
                    INSERT INTO posts (id, title, slug, content, excerpt, category_slug, type, author_id, status, tags, featured_image, lang, translation_group_id, content_type, content_markdown, thumbnail_fit, is_syndicated, created_at, updated_at, published_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    id, title, slug, content, excerpt || '', type === 'post' ? (category || '일반') : null, type, author_id, status, tagsJson, featured_image, lang, groupId, contentType, contentMarkdown || null, thumbnail_fit, isSyndicatedVal, nowIso, nowIso, publishedAtVal
                ).run();
                createdIds[lang] = id;

                if (status === 'published') {
                    hasPublishedPost = true;
                } else if (status === 'scheduled') {
                    hasScheduledPost = true;
                }

                // 허브 자동 제출 훅 (status === 'published' & submitToBoard === true)
                const hubCategory = typeof item.hubCategory === 'string' ? item.hubCategory.trim() : undefined;
                if (shouldSyndicate) {
                    hubTasks.push((async () => {
                        try {
                            const { publishPostToHub } = await import('$lib/server/hub');
                            const res = await publishPostToHub({
                                title,
                                slug,
                                excerpt,
                                content: contentType === 'markdown' ? contentMarkdown : content,
                                contentType,
                                categorySlug: category || '일반',
                                hubCategory,
                                featuredImage: featured_image,
                                tags: tagsJson,
                                lang
                            }, db);
                            hubResults.push(res);
                            if (!res.success) {
                                console.warn('[Hub Sync Warning]', res.error || res.reason);
                            }
                        } catch (e: any) {
                            console.error('[Hub Sync Error]', e);
                            hubResults.push({ success: false, error: e?.message || String(e), lang, title });
                        }
                    })());
                }
            }

            const postCreateTasks: Promise<any>[] = [...hubTasks];

            if (hasPublishedPost) {
                postCreateTasks.push(
                    (async () => {
                        await syncCategoryPostCounts(db);
                        try {
                            const { generateSidebarSnapshot } = await import('@blog/shared');
                            await generateSidebarSnapshot(db);
                        } catch (snapErr) {
                            console.error('[Snapshot Error]', snapErr);
                        }
                    })(),
                    (async () => {
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
                    })()
                );
            }

            if (hasScheduledPost) {
                postCreateTasks.push(syncNextScheduledAt(db));
            }

            if (postCreateTasks.length > 0) {
                await Promise.all(postCreateTasks);
            }

            const hasHubNotice = hubResults.some((r) => (!r.success && r.reason !== 'no_api_key') || r.isAbuseReset);
            if (hasHubNotice) {
                return {
                    saved: true,
                    createdIds,
                    hubResults
                };
            }

            throw redirect(303, `/posts?refreshed=${Date.now()}`);
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
