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
import { error, fail } from '@sveltejs/kit';
import { syncCategoryPostCounts } from '$lib/server/categorySync';

function chunkArray<T>(items: T[], size = 40): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function fetchPostsByIds(db: any, ids: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const chunk of chunkArray(ids, 40)) {
        const placeholders = chunk.map(() => '?').join(',');
        const res = await db.prepare(`SELECT * FROM posts WHERE id IN (${placeholders})`).bind(...chunk).all();
        if (res?.results) results.push(...res.results);
    }
    return results;
}

async function cleanupPostStorage(platform: any, db: any, post: any): Promise<void> {
    const slug = post?.slug;
    if (!slug || !platform) return;
    try {
        const { getStorageAdapter } = await import('$lib/server/storageAdapter');
        const adapter = await getStorageAdapter(platform, db);
        const prefix = `posts/${slug}/`;
        const pathsToCheck = [prefix, `${prefix}original/`, `${prefix}desktop/`, `${prefix}mobile/`, `${prefix}thumbnail/`];
        const keysToDelete: string[] = [];
        let isDisabled = false;

        const listResults = await Promise.all(
            pathsToCheck.map(async (p) => ({
                p,
                list: await adapter.list(p).catch(() => ({ objects: [] as any[], disabled: false }))
            }))
        );
        for (const { p, list } of listResults) {
            if (list.disabled) {
                isDisabled = true;
                break;
            }
            keysToDelete.push(...list.objects.map(obj => obj.key));
            keysToDelete.push(p);
        }

        const uniqueKeys = Array.from(new Set(keysToDelete));
        if (uniqueKeys.length > 0) {
            await adapter.delete(uniqueKeys);
        } else if (isDisabled) {
            const content = post.content || '';
            const matches = [...content.matchAll(/src=["'](.*?)["']/g)];
            const parsedKeys: string[] = [];
            for (const match of matches) {
                const url = match[1];
                if (url.includes(`/images/posts/${slug}/`)) {
                    const keyMatch = url.match(new RegExp(`(posts/${slug}/.*)`));
                    if (keyMatch) parsedKeys.push(keyMatch[1]);
                }
            }
            const uniqueParsedKeys = Array.from(new Set(parsedKeys));
            if (uniqueParsedKeys.length > 0) {
                await adapter.delete(uniqueParsedKeys);
            }
        }
    } catch (storageError) {
        console.error('Failed to cleanup images during post deletion:', storageError);
    }
}

async function cleanupOrphanCategories(db: any): Promise<void> {
    await db.prepare(`
        DELETE FROM categories 
        WHERE slug NOT IN (
            SELECT DISTINCT category_slug 
            FROM posts 
            WHERE category_slug IS NOT NULL
        )
    `).run().catch((catErr: any) => console.warn('Failed to cleanup categories:', catErr));
}

async function syncPublishedArtifacts(
    platform: any,
    db: any,
    purgeOptions: { categorySlug?: string; slug?: string; purgeEverything?: boolean } = { purgeEverything: true }
): Promise<void> {
    await Promise.all([
        (async () => {
            try {
                const cacheRow = await db.prepare("SELECT value FROM blog_settings WHERE key = 'enable_cdn_cache'").first();
                if (cacheRow?.value === 'true') {
                    const { purgeCdnCache } = await import('$lib/server/cachePurge');
                    await purgeCdnCache(platform, db, purgeOptions).catch(e => console.error('[Purge Error]', e));
                }
            } catch (e) {
                console.error('[Purge Error]', e);
            }
        })(),
        (async () => {
            try {
                await syncCategoryPostCounts(db);
                const { generateSidebarSnapshot } = await import('@blog/shared');
                await generateSidebarSnapshot(db);
            } catch (snapErr) {
                console.error('[Snapshot/Count Sync Error]', snapErr);
            }
        })()
    ]);
}

export const load: PageServerLoad = async ({ locals, setHeaders, url, platform }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');
    const userDb = platform?.env?.USER_DB;

    // 어드민 포스트 목록의 실시간 데이터 정합성을 위해 브라우저 캐시 차단
    setHeaders({
        'cache-control': 'no-store, no-cache, must-revalidate'
    });

    try {
        // Posts 목록 & Languages 목록 & Categories 목록 병렬 조회
        // content, content_markdown 등의 대형 본문 컬럼은 목록 뷰에서 제외하여 D1 읽기량과 대역폭을 획기적으로 최적화
        const [{ results: postsRaw }, langResult, catResult, tzResult] = await Promise.all([
            db.prepare(`
                SELECT id, title, slug, category_slug, type, status, author_id, featured_image,
                       lang, translation_group_id, thumbnail_fit, is_syndicated, view_count, like_count,
                       created_at, published_at
                FROM posts 
                ORDER BY created_at DESC
            `).all(),
            db.prepare(`
                SELECT * FROM languages ORDER BY sort_order ASC, code ASC
            `).all().catch((e: any) => {
                console.warn('Failed to load languages in admin posts:', e);
                return { results: [] };
            }),
            db.prepare(`
                SELECT slug, name, lang FROM categories ORDER BY name ASC
            `).all().catch((e: any) => {
                console.warn('Failed to load categories in admin posts:', e);
                return { results: [] };
            }),
            db.prepare(`
                SELECT value FROM blog_settings WHERE key = 'timezone'
            `).first().catch(() => null)
        ]);
        const languages = (langResult as any)?.results || [];
        const categories = (catResult as any)?.results || [];
        const timezone = (tzResult as any)?.value?.trim() || 'Asia/Seoul';

        // 진짜 원본인 USER_DB.post_views의 누적 합계 조회
        let viewCountMap: Record<string, number> = {};
        if (userDb) {
            try {
                const { results: viewResults } = await userDb.prepare(`
                    SELECT post_id, SUM(views) as total_views FROM post_views GROUP BY post_id
                `).all();
                for (const row of (viewResults || []) as any[]) {
                    viewCountMap[row.post_id] = row.total_views || 0;
                }
            } catch (e) {
                console.warn('Failed to load view counts from USER_DB:', e);
            }
        }

        // 캐시 불일치 포스트 동기화 배치 목록
        const toSync: { id: string; view_count: number }[] = [];
        const posts = (postsRaw || []).map((p: any) => {
            const trueViews = (p.id in viewCountMap) ? viewCountMap[p.id] : (p.view_count || 0);
            if (trueViews !== (p.view_count || 0)) {
                toSync.push({ id: p.id, view_count: trueViews });
            }
            return {
                ...p,
                author_name: 'Admin',
                view_count: trueViews
            };
        });

        // BLOG_DB.posts.view_count 캐시 컬럼 일괄 동기화 (비동기 안전 처리)
        if (toSync.length > 0) {
            try {
                const syncStatements = toSync.map(item =>
                    db.prepare('UPDATE posts SET view_count = ? WHERE id = ?').bind(item.view_count, item.id)
                );
                db.batch(syncStatements).catch((err: any) => console.warn('Failed to sync view_count cache:', err));
            } catch (err) {
                console.warn('Failed to build sync batch:', err);
            }
        }

        return {
            posts,
            languages,
            categories,
            timezone
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
        if (!id) return fail(400, { error: 'Post ID is required' });

        try {
            const post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
            if (!post) return fail(404, { error: 'Post not found' });

            const isPublished = (post as any).status === 'published';
            const slug = (post as any).slug;

            try {
                await db.prepare('PRAGMA foreign_keys = OFF').run();
            } catch (pragmaErr) {
                console.warn('Failed to disable foreign keys:', pragmaErr);
            }

            await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();

            const postCleanupTasks: Promise<any>[] = [
                cleanupPostStorage(platform, db, post),
                cleanupOrphanCategories(db)
            ];

            if ((post as any).is_syndicated === 1) {
                postCleanupTasks.push(
                    (async () => {
                        try {
                            const { removePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                            const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                            const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';
                            const postUrl = buildPostUrl(siteUrl, (post as any).lang || 'ko', (post as any).category_slug || '일반', slug);
                            await removePostFromHub(postUrl, db);
                        } catch (hubErr) {
                            console.warn('[Hub Delete Warning] Failed to remove post from hub:', hubErr);
                        }
                    })()
                );
            }

            if (isPublished) {
                postCleanupTasks.push(
                    syncPublishedArtifacts(platform, db, {
                        categorySlug: (post as any).category_slug || '일반',
                        slug
                    }),
                    (async () => {
                        const userDb = platform?.env?.USER_DB;
                        if (!userDb) return;
                        try {
                            await userDb.prepare('DELETE FROM post_views WHERE post_id = ?').bind(id).run();
                        } catch (e) {
                            console.warn('Failed to delete post views:', e);
                        }
                    })()
                );
            }

            await Promise.all(postCleanupTasks);
            return { success: true };
        } catch (err: any) {
            console.error('Failed to delete post:', err);
            return fail(500, { error: err.message || 'Failed to delete post' });
        }
    },

    renameCategory: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const oldSlug = String(data.get('oldSlug') || '').trim();
        const newSlug = String(data.get('newSlug') || '').trim();
        const translationsRaw = String(data.get('translations') || '[]');
        const allowMerge = String(data.get('allowMerge') || '') === 'true';

        if (!oldSlug || !newSlug) {
            return fail(400, { error: '기존 슬러그와 새 슬러그가 필요합니다.' });
        }

        let translations: Array<{ lang: string; name: string }> = [];
        try {
            translations = JSON.parse(translationsRaw);
        } catch {
            return fail(400, { error: '카테고리 이름 형식이 올바르지 않습니다.' });
        }

        try {
            const { results: langRows } = await db.prepare('SELECT code FROM languages ORDER BY sort_order ASC, code ASC').all();
            const requiredLangs = (langRows && langRows.length > 0)
                ? langRows.map((l: any) => String(l.code))
                : ['ko'];

            const nameByLang = new Map<string, string>();
            for (const item of translations) {
                if (item?.lang && typeof item.name === 'string') {
                    nameByLang.set(String(item.lang), item.name.trim());
                }
            }

            const missingLang = requiredLangs.find((code) => !nameByLang.get(code));
            if (missingLang) {
                return fail(400, { error: `모든 언어의 카테고리명을 입력해야 합니다. (누락: ${missingLang})` });
            }

            const nowIso = new Date().toISOString();
            let syndicatedPostsToResync: any[] = [];

            if (oldSlug !== newSlug) {
                const existingTarget = await db.prepare('SELECT slug FROM categories WHERE slug = ? LIMIT 1').bind(newSlug).first();
                if (existingTarget && !allowMerge) {
                    return fail(409, { error: 'TARGET_CATEGORY_EXISTS', targetSlug: newSlug });
                }

                const { results: affected } = await db.prepare(
                    "SELECT * FROM posts WHERE category_slug = ? AND status = 'published' AND is_syndicated = 1"
                ).bind(oldSlug).all();
                syndicatedPostsToResync = affected || [];

                await db.prepare('UPDATE posts SET category_slug = ?, updated_at = ? WHERE category_slug = ?')
                    .bind(newSlug, nowIso, oldSlug).run();
                await db.prepare('DELETE FROM categories WHERE slug = ?').bind(oldSlug).run();
            }

            const upsertStatements = Array.from(nameByLang.entries()).map(([lang, name]) =>
                db.prepare(`
                    INSERT INTO categories (slug, lang, name, translation_group_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(slug, lang) DO UPDATE SET
                        name = excluded.name,
                        translation_group_id = excluded.translation_group_id,
                        updated_at = excluded.updated_at
                `).bind(newSlug, lang, name, newSlug, nowIso, nowIso)
            );
            if (upsertStatements.length > 0) {
                await db.batch(upsertStatements);
            }

            const postTasks: Promise<any>[] = [
                syncPublishedArtifacts(platform, db, { purgeEverything: true })
            ];

            if (oldSlug !== newSlug && syndicatedPostsToResync.length > 0) {
                postTasks.push(
                    (async () => {
                        try {
                            const { publishPostToHub, removePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                            const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                            const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';

                            await Promise.all(
                                syndicatedPostsToResync.map(async (p: any) => {
                                    const pLang = p.lang || 'ko';
                                    const prevUrl = buildPostUrl(siteUrl, pLang, oldSlug, p.slug);
                                    const newUrl = buildPostUrl(siteUrl, pLang, newSlug, p.slug);
                                    await removePostFromHub(prevUrl, db);
                                    await publishPostToHub({
                                        title: p.title,
                                        slug: p.slug,
                                        excerpt: p.excerpt,
                                        content: p.content_type === 'markdown' ? p.content_markdown : p.content,
                                        contentType: p.content_type,
                                        categorySlug: newSlug,
                                        featuredImage: p.featured_image,
                                        tags: p.tags ? JSON.parse(p.tags) : [],
                                        lang: pLang,
                                        url: newUrl,
                                        publishedAt: p.published_at || p.created_at
                                    }, db);
                                })
                            );
                        } catch (hubErr) {
                            console.warn('[Hub Category Rename Warning]', hubErr);
                        }
                    })()
                );
            }

            await Promise.all(postTasks);
            return { success: true, merged: oldSlug !== newSlug && allowMerge };
        } catch (err: any) {
            console.error('Failed to rename category:', err);
            return fail(500, { error: err.message || '카테고리 변경에 실패했습니다.' });
        }
    },

    bulkUpdateCategory: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const idsRaw = String(data.get('ids') || '[]');
        const targetSlug = String(data.get('targetSlug') || '').trim();
        const translationsRaw = String(data.get('translations') || '[]');

        if (!targetSlug) return fail(400, { error: '변경할 카테고리 슬러그를 입력하세요.' });

        let ids: string[] = [];
        let translations: Array<{ lang: string; name: string }> = [];
        try {
            ids = JSON.parse(idsRaw);
            translations = JSON.parse(translationsRaw);
        } catch {
            return fail(400, { error: '요청 데이터 형식이 올바르지 않습니다.' });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return fail(400, { error: '선택된 포스트가 없습니다.' });
        }

        try {
            const posts = await fetchPostsByIds(db, ids);
            const postTargets = posts.filter((p: any) => p.type !== 'page');
            if (postTargets.length === 0) {
                return fail(400, { error: '카테고리를 변경할 일반 포스트가 없습니다. (정적 페이지는 제외됩니다)' });
            }

            const nowIso = new Date().toISOString();
            const nameByLang = new Map<string, string>();
            for (const item of translations) {
                if (item?.lang && typeof item.name === 'string' && item.name.trim()) {
                    nameByLang.set(String(item.lang), item.name.trim());
                }
            }

            // 대상 카테고리 레코드가 없으면 등록된 언어/대상 포스트 언어 기준으로 생성 보장
            const existingCat = await db.prepare('SELECT slug FROM categories WHERE slug = ? LIMIT 1').bind(targetSlug).first();
            if (!existingCat) {
                const { results: langRows } = await db.prepare('SELECT code FROM languages').all().catch(() => ({ results: [] }));
                const langsToEnsure = new Set<string>([
                    ...((langRows || []).map((l: any) => String(l.code))),
                    ...postTargets.map((p: any) => String(p.lang || 'ko'))
                ]);
                const insertCatStmts = Array.from(langsToEnsure).map((lang) =>
                    db.prepare(`
                        INSERT OR IGNORE INTO categories (slug, lang, name, translation_group_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(targetSlug, lang, nameByLang.get(lang) || targetSlug, targetSlug, nowIso, nowIso)
                );
                if (insertCatStmts.length > 0) {
                    await db.batch(insertCatStmts);
                }
            }

            const changedPosts = postTargets.filter((p: any) => p.category_slug !== targetSlug);
            const targetIds = changedPosts.map((p: any) => p.id);

            for (const chunk of chunkArray(targetIds, 40)) {
                const placeholders = chunk.map(() => '?').join(',');
                await db.prepare(`UPDATE posts SET category_slug = ?, updated_at = ? WHERE id IN (${placeholders})`)
                    .bind(targetSlug, nowIso, ...chunk).run();
            }

            const hasPublishedChange = changedPosts.some((p: any) => p.status === 'published');
            const postTasks: Promise<any>[] = [cleanupOrphanCategories(db)];

            if (hasPublishedChange) {
                postTasks.push(syncPublishedArtifacts(platform, db, { purgeEverything: true }));
                const syndicated = changedPosts.filter((p: any) => p.status === 'published' && p.is_syndicated === 1);
                if (syndicated.length > 0) {
                    postTasks.push(
                        (async () => {
                            try {
                                const { publishPostToHub, removePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                                const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                                const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';
                                await Promise.all(
                                    syndicated.map(async (p: any) => {
                                        const pLang = p.lang || 'ko';
                                        const prevUrl = buildPostUrl(siteUrl, pLang, p.category_slug || '일반', p.slug);
                                        const newUrl = buildPostUrl(siteUrl, pLang, targetSlug, p.slug);
                                        if (prevUrl !== newUrl) await removePostFromHub(prevUrl, db);
                                        await publishPostToHub({
                                            title: p.title,
                                            slug: p.slug,
                                            excerpt: p.excerpt,
                                            content: p.content_type === 'markdown' ? p.content_markdown : p.content,
                                            contentType: p.content_type,
                                            categorySlug: targetSlug,
                                            featuredImage: p.featured_image,
                                            tags: p.tags ? JSON.parse(p.tags) : [],
                                            lang: pLang,
                                            url: newUrl,
                                            publishedAt: p.published_at || p.created_at
                                        }, db);
                                    })
                                );
                            } catch (hubErr) {
                                console.warn('[Hub Bulk Category Warning]', hubErr);
                            }
                        })()
                    );
                }
            }

            await Promise.all(postTasks);
            return {
                success: true,
                updatedCount: postTargets.length,
                skippedPageCount: posts.length - postTargets.length
            };
        } catch (err: any) {
            console.error('Failed to bulk update category:', err);
            return fail(500, { error: err.message || '카테고리 일괄 변경에 실패했습니다.' });
        }
    },

    bulkUpdateStatus: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const idsRaw = String(data.get('ids') || '[]');
        const targetStatus = String(data.get('targetStatus') || '');
        if (targetStatus !== 'draft' && targetStatus !== 'published') {
            return fail(400, { error: '유효하지 않은 상태입니다.' });
        }

        let ids: string[] = [];
        try {
            ids = JSON.parse(idsRaw);
        } catch {
            return fail(400, { error: '요청 데이터 형식이 올바르지 않습니다.' });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return fail(400, { error: '선택된 포스트가 없습니다.' });
        }

        try {
            const posts = await fetchPostsByIds(db, ids);
            if (posts.length === 0) return fail(404, { error: '대상 포스트를 찾을 수 없습니다.' });

            const nowIso = new Date().toISOString();
            const targetIds = posts.map((p: any) => p.id);

            for (const chunk of chunkArray(targetIds, 40)) {
                const placeholders = chunk.map(() => '?').join(',');
                if (targetStatus === 'draft') {
                    await db.prepare(`UPDATE posts SET status = 'draft', updated_at = ?, published_at = NULL WHERE id IN (${placeholders})`)
                        .bind(nowIso, ...chunk).run();
                } else {
                    await db.prepare(`UPDATE posts SET status = 'published', updated_at = ?, published_at = COALESCE(published_at, ?) WHERE id IN (${placeholders})`)
                        .bind(nowIso, nowIso, ...chunk).run();
                }
            }

            const hasPublishedTransition = targetStatus === 'draft'
                ? posts.some((p: any) => p.status === 'published')
                : posts.some((p: any) => p.status !== 'published');

            const postTasks: Promise<any>[] = [];
            if (hasPublishedTransition) {
                postTasks.push(syncPublishedArtifacts(platform, db, { purgeEverything: true }));
                const syndicated = posts.filter((p: any) => p.is_syndicated === 1 && p.status !== targetStatus);
                if (syndicated.length > 0) {
                    postTasks.push(
                        (async () => {
                            try {
                                const { publishPostToHub, hidePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                                const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                                const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';
                                await Promise.all(
                                    syndicated.map(async (p: any) => {
                                        const pLang = p.lang || 'ko';
                                        const pCat = p.category_slug || '일반';
                                        const postUrl = buildPostUrl(siteUrl, pLang, pCat, p.slug);
                                        const payload = {
                                            title: p.title,
                                            slug: p.slug,
                                            excerpt: p.excerpt,
                                            content: p.content_type === 'markdown' ? p.content_markdown : p.content,
                                            contentType: p.content_type,
                                            categorySlug: pCat,
                                            featuredImage: p.featured_image,
                                            tags: p.tags ? JSON.parse(p.tags) : [],
                                            lang: pLang,
                                            url: postUrl,
                                            publishedAt: p.published_at || p.created_at || nowIso
                                        };
                                        if (targetStatus === 'draft') {
                                            await hidePostFromHub(payload, db);
                                        } else {
                                            await publishPostToHub(payload, db);
                                        }
                                    })
                                );
                            } catch (hubErr) {
                                console.warn('[Hub Bulk Status Warning]', hubErr);
                            }
                        })()
                    );
                }
            }

            if (postTasks.length > 0) await Promise.all(postTasks);
            return { success: true, updatedCount: posts.length };
        } catch (err: any) {
            console.error('Failed to bulk update status:', err);
            return fail(500, { error: err.message || '상태 일괄 변경에 실패했습니다.' });
        }
    },

    bulkDelete: async ({ request, locals, platform }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const idsRaw = String(data.get('ids') || '[]');
        let ids: string[] = [];
        try {
            ids = JSON.parse(idsRaw);
        } catch {
            return fail(400, { error: '요청 데이터 형식이 올바르지 않습니다.' });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return fail(400, { error: '선택된 포스트가 없습니다.' });
        }

        try {
            const posts = await fetchPostsByIds(db, ids);
            if (posts.length === 0) return fail(404, { error: '삭제할 포스트를 찾을 수 없습니다.' });

            try {
                await db.prepare('PRAGMA foreign_keys = OFF').run();
            } catch (pragmaErr) {
                console.warn('Failed to disable foreign keys:', pragmaErr);
            }

            const targetIds = posts.map((p: any) => p.id);
            for (const chunk of chunkArray(targetIds, 40)) {
                const placeholders = chunk.map(() => '?').join(',');
                await db.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).bind(...chunk).run();
            }

            const hasPublished = posts.some((p: any) => p.status === 'published');
            const cleanupTasks: Promise<any>[] = [
                ...posts.map((p: any) => cleanupPostStorage(platform, db, p)),
                cleanupOrphanCategories(db)
            ];

            const syndicated = posts.filter((p: any) => p.is_syndicated === 1);
            if (syndicated.length > 0) {
                cleanupTasks.push(
                    (async () => {
                        try {
                            const { removePostFromHub, buildPostUrl } = await import('$lib/server/hub');
                            const { results: sRows } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").all();
                            const siteUrl = (sRows?.[0] as any)?.value || 'https://sveltekitblog.com';
                            await Promise.all(
                                syndicated.map((p: any) => {
                                    const postUrl = buildPostUrl(siteUrl, p.lang || 'ko', p.category_slug || '일반', p.slug);
                                    return removePostFromHub(postUrl, db);
                                })
                            );
                        } catch (hubErr) {
                            console.warn('[Hub Bulk Delete Warning]', hubErr);
                        }
                    })()
                );
            }

            if (hasPublished) {
                cleanupTasks.push(syncPublishedArtifacts(platform, db, { purgeEverything: true }));
                const userDb = platform?.env?.USER_DB;
                if (userDb) {
                    cleanupTasks.push(
                        (async () => {
                            try {
                                const publishedIds = posts.filter((p: any) => p.status === 'published').map((p: any) => p.id);
                                for (const chunk of chunkArray(publishedIds, 40)) {
                                    const placeholders = chunk.map(() => '?').join(',');
                                    await userDb.prepare(`DELETE FROM post_views WHERE post_id IN (${placeholders})`).bind(...chunk).run();
                                }
                            } catch (e) {
                                console.warn('Failed to delete post views:', e);
                            }
                        })()
                    );
                }
            }

            await Promise.all(cleanupTasks);
            return { success: true, deletedCount: posts.length };
        } catch (err: any) {
            console.error('Failed to bulk delete posts:', err);
            return fail(500, { error: err.message || '포스트 일괄 삭제에 실패했습니다.' });
        }
    }
};
