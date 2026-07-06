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

import type { D1Database } from '@cloudflare/workers-types';
import type { Post, Layout } from '$lib/types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@blog/shared/db/blog-schema';
import * as userSchema from '@blog/shared/db/user-schema';
import { eq, desc, asc, and, or, sql, inArray } from 'drizzle-orm';

export class BlogDB {
    private db;
    private userDb;

    constructor(
        private blogD1: D1Database,
        private userD1: D1Database
    ) {
        this.db = drizzle(blogD1, { schema });
        this.userDb = drizzle(userD1, { schema: userSchema });
    }

    private safeParseTags(tags: any): string[] {
        if (!tags) return [];
        try {
            const parsed = typeof tags === 'string' ? JSON.parse(tags) : tags;
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            if (typeof tags === 'string') {
                return tags.split(',').map(t => t.trim()).filter(Boolean);
            }
            return [];
        }
    }

    // BLOG_DB 데이터 (설정, 레이아웃, 포스트)
    async getSettings(lang: string = 'ko', dbDefaultLang: string = 'ko'): Promise<Record<string, any>> {
        const results = await this.db.query.blogSettings.findMany();
        
        // Define fields that are expected to be multilingual objects
        const multiLangFields = ['site_title', 'description', 'authorName'];

        return results.reduce((acc: any, curr: any) => {
            let parsedVal;
            try {
                parsedVal = JSON.parse(curr.value);
            } catch {
                parsedVal = curr.value;
            }

            if (multiLangFields.includes(curr.key) && typeof parsedVal === 'object' && parsedVal !== null) {
                acc[curr.key] = parsedVal[lang] || parsedVal[dbDefaultLang] || Object.values(parsedVal)[0] || '';
            } else {
                acc[curr.key] = parsedVal;
            }

            return acc;
        }, {});
    }

    async getActiveLayout(): Promise<Layout | null> {
        const result = await this.db.query.layouts.findFirst({
            where: eq(schema.layouts.isActive, true)
        });
        if (!result) return null;
        return {
            id: result.id,
            name: result.name,
            columnCount: result.columnCount || 1,
            columnWidths: result.columnWidths || "1fr",
            isActive: !!result.isActive,
            createdAt: result.createdAt || "",
            updatedAt: result.updatedAt || ""
        };
    }

    async getLayoutWidgets(layoutId: number, lang: string = 'ko', dbDefaultLang: string = 'ko') {
        const results = await this.db.select({
            id: schema.layoutWidgets.id,
            layoutId: schema.layoutWidgets.layoutId,
            widgetId: schema.layoutWidgets.widgetId,
            columnIndex: schema.layoutWidgets.columnIndex,
            sortOrder: schema.layoutWidgets.sortOrder,
            customTitle: schema.layoutWidgets.customTitle,
            device: schema.layoutWidgets.device,
            name: schema.widgets.name,
            type: schema.widgets.type,
            config: schema.widgets.config
        })
            .from(schema.layoutWidgets)
            .leftJoin(schema.widgets, eq(schema.layoutWidgets.widgetId, schema.widgets.id))
            .where(eq(schema.layoutWidgets.layoutId, layoutId))
            .orderBy(schema.layoutWidgets.columnIndex, schema.layoutWidgets.sortOrder);

        return results.map(r => {
            let resolvedCustomTitle = r.customTitle;
            if (resolvedCustomTitle && typeof resolvedCustomTitle === 'string' && resolvedCustomTitle.startsWith('{')) {
                try {
                    const parsed = JSON.parse(resolvedCustomTitle);
                    resolvedCustomTitle = parsed[lang] || parsed[dbDefaultLang] || resolvedCustomTitle;
                } catch(e) {}
            }
            return {
                ...r,
                customTitle: resolvedCustomTitle,
                config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {})
            };
        });
    }

    async getRecentPosts(limit = 10, categorySlug?: string, page = 1, offsetLimit?: number, lang: string = 'ko', dbDefaultLang: string = 'ko'): Promise<Post[]> {
        // cf-admin과의 데이터 형식 호환성을 위해 날짜 정렬 강화
        const query = this.db.select({
            id: schema.posts.id,
            title: schema.posts.title,
            slug: schema.posts.slug,
            excerpt: schema.posts.excerpt,
            featuredImage: schema.posts.featuredImage,
            categorySlug: schema.posts.categorySlug,
            categoryName: schema.categories.name,
            status: schema.posts.status,
            createdAt: schema.posts.createdAt,
            publishedAt: schema.posts.publishedAt,
            tags: schema.posts.tags,
            lang: schema.posts.lang,
            translationGroupId: schema.posts.translationGroupId,
            thumbnailFit: schema.posts.thumbnailFit,
            // 정렬용 필드: publishedAt이 있으면 우선, 없으면 createdAt (Unix-timestamp vs String 호환 처리)
            displayDate: sql`COALESCE(${schema.posts.publishedAt}, ${schema.posts.createdAt})`.as('display_date')
        })
            .from(schema.posts)
            .leftJoin(schema.categories, and(eq(schema.posts.categorySlug, schema.categories.slug), eq(schema.categories.lang, schema.posts.lang)));

        const whereClauses = [eq(schema.posts.status, 'published'), eq(schema.posts.type, 'post'), eq(schema.posts.lang, lang)];
        if (categorySlug && categorySlug !== 'all') {
            whereClauses.push(eq(schema.posts.categorySlug, categorySlug));
        }

        const baseLimit = offsetLimit || limit;
        const offsetAmt = Math.max(0, (page - 1) * baseLimit);

        const results = await query
            .where(and(...whereClauses))
            .orderBy(desc(sql`display_date`))
            .limit(limit)
            .offset(offsetAmt);

        // Fetch likes and views from USER_DB
        const postIds = results.map(r => r.id);
        let viewsMap = new Map<string, number>();
        let likesMap = new Map<string, number>();

        if (postIds.length > 0) {
            try {
                // Get views
                const viewsData = await this.userDb.select({
                    postId: userSchema.postViews.postId,
                    totalViews: sql<number>`SUM(${userSchema.postViews.views})`
                })
                    .from(userSchema.postViews)
                    .where(inArray(userSchema.postViews.postId, postIds))
                    .groupBy(userSchema.postViews.postId);

                viewsData.forEach(v => viewsMap.set(v.postId, v.totalViews || 0));

                // Get likes
                const likesData = await this.userDb.select({
                    postId: userSchema.postLikes.postId,
                    totalLikes: sql<number>`COUNT(${userSchema.postLikes.userId})`
                })
                    .from(userSchema.postLikes)
                    .where(inArray(userSchema.postLikes.postId, postIds))
                    .groupBy(userSchema.postLikes.postId);

                likesData.forEach(l => likesMap.set(l.postId, l.totalLikes || 0));
            } catch (e) {
                console.error("Failed to fetch views/likes in getRecentPosts", e);
            }
        }

        // Batch fetch translations for posts that have translationGroupId
        const groupIds = results
            .map(r => r.translationGroupId)
            .filter((gid): gid is string => !!gid);
        const uniqueGroupIds = [...new Set(groupIds)];
        let translationsMap = new Map<string, Array<{lang: string, slug: string}>>();

        if (uniqueGroupIds.length > 0) {
            try {
                const translations = await this.db.select({
                    lang: schema.posts.lang,
                    slug: schema.posts.slug,
                    translationGroupId: schema.posts.translationGroupId
                })
                    .from(schema.posts)
                    .where(and(
                        inArray(schema.posts.translationGroupId, uniqueGroupIds),
                        eq(schema.posts.status, 'published')
                    ));

                translations.forEach(t => {
                    if (!t.translationGroupId || !t.lang) return;
                    const arr = translationsMap.get(t.translationGroupId) || [];
                    arr.push({ lang: t.lang, slug: t.slug });
                    translationsMap.set(t.translationGroupId, arr);
                });
            } catch (e) {
                console.error("Failed to fetch translations in getRecentPosts", e);
            }
        }

        return results.map(r => ({
            ...r,
            tags: this.safeParseTags(r.tags),
            view_count: viewsMap.get(r.id) || 0,
            like_count: likesMap.get(r.id) || 0,
            translations: r.translationGroupId ? (translationsMap.get(r.translationGroupId) || []) : []
        })) as any[];
    }

    async getCategories(lang: string = 'ko', dbDefaultLang: string = 'ko') {
        const results = await this.db.select({
            slug: schema.categories.slug,
            name: schema.categories.name,
            count: sql<number>`count(${schema.posts.id})`.as('post_count')
        })
            .from(schema.categories)
            .leftJoin(schema.posts, and(
                eq(schema.categories.slug, schema.posts.categorySlug),
                eq(schema.posts.lang, schema.categories.lang),
                eq(schema.posts.status, 'published'),
                eq(schema.posts.type, 'post')
            ))
            .where(eq(schema.categories.lang, lang))
            .groupBy(schema.categories.slug)
            .orderBy(desc(sql`post_count`));

        return results
            .filter(r => r.count > 0)
            .map(r => ({
                id: r.slug,
                slug: r.slug,
                name: r.name,
                count: r.count,
                postCount: r.count
            }));
    }

    async getPages(lang: string = 'ko', dbDefaultLang: string = 'ko') {
        const results = await this.db.select({
            id: schema.posts.id,
            title: schema.posts.title,
            slug: schema.posts.slug
        })
            .from(schema.posts)
            .where(and(eq(schema.posts.status, 'published'), eq(schema.posts.type, 'page'), eq(schema.posts.lang, lang)))
            .orderBy(asc(schema.posts.createdAt));
            
        return results;
    }

    async getPostBySlugAndLang(categorySlug: string, slug: string, targetLang: string, defaultLang: string = 'ko') {
        const results = await this.db.select({
            id: schema.posts.id,
            title: schema.posts.title,
            slug: schema.posts.slug,
            type: schema.posts.type,
            content: schema.posts.content,
            excerpt: schema.posts.excerpt,
            featuredImage: schema.posts.featuredImage,
            categorySlug: schema.posts.categorySlug,
            categoryName: schema.categories.name,
            status: schema.posts.status,
            createdAt: schema.posts.createdAt,
            updatedAt: schema.posts.updatedAt,
            publishedAt: schema.posts.publishedAt,
            tags: schema.posts.tags,
            lang: schema.posts.lang,
            translationGroupId: schema.posts.translationGroupId,
            thumbnailFit: schema.posts.thumbnailFit,
            displayDate: sql`COALESCE(${schema.posts.publishedAt}, ${schema.posts.createdAt})`.as('display_date')
        })
            .from(schema.posts)
            .leftJoin(schema.categories, and(
                eq(schema.posts.categorySlug, schema.categories.slug),
                // lang별 카테고리 Row가 없을 때 defaultLang fallback
                sql`${schema.categories.lang} = COALESCE(
                    (SELECT lang FROM categories WHERE slug = ${schema.posts.categorySlug} AND lang = ${schema.posts.lang} LIMIT 1),
                    ${defaultLang}
                )`
            ))
            .where(and(
                eq(schema.posts.slug, slug),
                eq(schema.posts.status, 'published'),
                categorySlug === 'all' ? sql`1=1` : eq(schema.posts.categorySlug, categorySlug),
                inArray(schema.posts.lang, [targetLang, defaultLang])
            ))
            .limit(2);

        let post = results.find(r => r.lang === targetLang);
        let isFallback = false;

        if (!post) {
            post = results.find(r => r.lang === defaultLang);
            isFallback = true;
        }

        if (!post) return null;

        // Fetch translations
        let translations: any[] = [];
        if (post.translationGroupId) {
            translations = await this.db.select({ lang: schema.posts.lang, slug: schema.posts.slug })
                .from(schema.posts)
                .where(and(
                    eq(schema.posts.translationGroupId, post.translationGroupId),
                    eq(schema.posts.status, 'published')
                ));
        }

        let view_count = 0;
        let like_count = 0;
        try {
            const viewsData = await this.userDb.select({
                totalViews: sql<number>`SUM(${userSchema.postViews.views})`
            })
                .from(userSchema.postViews)
                .where(eq(userSchema.postViews.postId, post.id));
            view_count = viewsData[0]?.totalViews || 0;

            const likesData = await this.userDb.select({
                totalLikes: sql<number>`COUNT(${userSchema.postLikes.userId})`
            })
                .from(userSchema.postLikes)
                .where(eq(userSchema.postLikes.postId, post.id));
            like_count = likesData[0]?.totalLikes || 0;
        } catch (e) {
            console.error("Failed to fetch views/likes for single post", e);
        }

        return {
            ...post,
            tags: this.safeParseTags(post.tags),
            isFallback,
            translations,
            view_count,
            like_count
        };
    }

    async getPopularPosts(limit = 5, lang: string = 'ko', dbDefaultLang: string = 'ko'): Promise<Post[]> {
        try {
            // 1. Get top viewed post IDs from USER_DB
            const langCondition = lang === dbDefaultLang
                ? or(eq(userSchema.postViews.lang, lang), sql`${userSchema.postViews.lang} IS NULL`)
                : eq(userSchema.postViews.lang, lang);

            const topViews = await this.userDb.select({
                postId: userSchema.postViews.postId,
                totalViews: sql<number>`SUM(${userSchema.postViews.views})`.as('total_views')
            })
                .from(userSchema.postViews)
                .where(langCondition)
                .groupBy(userSchema.postViews.postId)
                .orderBy(desc(sql`total_views`))
                .limit(limit);

            if (topViews.length === 0) {
                // If no views data, fallback to recent posts
                return this.getRecentPosts(limit, undefined, 1, undefined, lang, dbDefaultLang);
            }

            const postIds = topViews.map(v => v.postId);

            // 2. Fetch posts from BLOG_DB
            // Use 'inArray' if possible, or mapping. Drizzle supports inArray.
            const results = await this.db.select({
                id: schema.posts.id,
                title: schema.posts.title,
                slug: schema.posts.slug,
                excerpt: schema.posts.excerpt,
                featuredImage: schema.posts.featuredImage,
                categorySlug: schema.posts.categorySlug,
                categoryName: schema.categories.name,
                status: schema.posts.status,
                createdAt: schema.posts.createdAt,
                publishedAt: schema.posts.publishedAt,
                tags: schema.posts.tags,
                thumbnailFit: schema.posts.thumbnailFit,
                displayDate: sql`COALESCE(${schema.posts.publishedAt}, ${schema.posts.createdAt})`.as('display_date')
            })
                .from(schema.posts)
                .leftJoin(schema.categories, and(eq(schema.posts.categorySlug, schema.categories.slug), eq(schema.categories.lang, schema.posts.lang)))
                .where(and(
                    eq(schema.posts.status, 'published'),
                    eq(schema.posts.type, 'post'),
                    eq(schema.posts.lang, lang),
                    inArray(schema.posts.id, postIds)
                ));

            // 3. Merge and Sort (restore order from topViews)
            const postsMap = new Map(results.map(r => [r.id, r]));
            const sortedPosts: any[] = [];

            for (const view of topViews) {
                const post = postsMap.get(view.postId);
                if (post) {
                    sortedPosts.push({
                        ...post,
                        view_count: view.totalViews,
                        tags: this.safeParseTags(post.tags)
                    });
                }
            }

            // If we found fewer posts than limit (e.g. some popular posts were deleted), fill with recent
            if (sortedPosts.length < limit) {
                // This logic can be complex, for now let's just return what we have
                // or separate recent posts call could be made.
            }

            return sortedPosts;

        } catch (e) {
            console.error("Failed to get popular posts:", e);
            return this.getRecentPosts(limit, undefined, 1, undefined, lang, dbDefaultLang);
        }
    }

    async incrementViewCount(slug: string, lang: string = 'ko', ip?: string) {
        // Find post ID by slug and lang first
        const post = await this.db.query.posts.findFirst({
            where: and(eq(schema.posts.slug, slug), eq(schema.posts.lang, lang)),
            columns: { id: true, lang: true }
        });

        if (!post) return;

        const date = new Date().toISOString().split('T')[0];

        // UPSERT view count
        // D1 (SQLite) supports UPSERT via ON CONFLICT
        await this.userDb.insert(userSchema.postViews)
            .values({
                postId: post.id,
                date: date,
                views: 1,
                lang: post.lang
            })
            .onConflictDoUpdate({
                target: [userSchema.postViews.postId, userSchema.postViews.date],
                set: { 
                    views: sql`${userSchema.postViews.views} + 1`,
                    lang: post.lang
                }
            });
    }

    async getViewCount(slug: string, lang: string = 'ko'): Promise<number> {
        const post = await this.db.query.posts.findFirst({
            where: and(eq(schema.posts.slug, slug), eq(schema.posts.lang, lang)),
            columns: { id: true }
        });

        if (!post) return 0;

        const result = await this.userDb.select({
            totalViews: sql<number>`SUM(${userSchema.postViews.views})`
        })
            .from(userSchema.postViews)
            .where(eq(userSchema.postViews.postId, post.id));

        return result[0]?.totalViews || 0;
    }

    async getPostsByTag(tag: string, lang: string = 'ko', dbDefaultLang: string = 'ko'): Promise<Post[]> {
        // 태그 검색: JSON 배열 내부 검색이 복잡하므로 JS 필터링 사용 (데이터 규모 감안 시 수용 가능)
        const results = await this.db.select({
            id: schema.posts.id,
            title: schema.posts.title,
            slug: schema.posts.slug,
            excerpt: schema.posts.excerpt,
            featuredImage: schema.posts.featuredImage,
            categorySlug: schema.posts.categorySlug,
            categoryName: schema.categories.name,
            status: schema.posts.status,
            createdAt: schema.posts.createdAt,
            publishedAt: schema.posts.publishedAt,
            tags: schema.posts.tags,
            thumbnailFit: schema.posts.thumbnailFit,
            displayDate: sql`COALESCE(${schema.posts.publishedAt}, ${schema.posts.createdAt})`.as('display_date')
        })
            .from(schema.posts)
            .leftJoin(schema.categories, and(eq(schema.posts.categorySlug, schema.categories.slug), eq(schema.categories.lang, schema.posts.lang)))
            .where(and(eq(schema.posts.status, 'published'), eq(schema.posts.type, 'post'), eq(schema.posts.lang, lang)))
            .orderBy(desc(sql`display_date`));

        const filtered = results.filter(r => {
            const parsedTags = this.safeParseTags(r.tags);
            return parsedTags.includes(tag);
        });

        // Fetch likes and views for filtered tags
        const postIds = filtered.map(r => r.id);
        let viewsMap = new Map<string, number>();
        let likesMap = new Map<string, number>();

        if (postIds.length > 0) {
            try {
                const viewsData = await this.userDb.select({
                    postId: userSchema.postViews.postId,
                    totalViews: sql<number>`SUM(${userSchema.postViews.views})`
                })
                    .from(userSchema.postViews)
                    .where(inArray(userSchema.postViews.postId, postIds))
                    .groupBy(userSchema.postViews.postId);

                viewsData.forEach(v => viewsMap.set(v.postId, v.totalViews || 0));

                const likesData = await this.userDb.select({
                    postId: userSchema.postLikes.postId,
                    totalLikes: sql<number>`COUNT(${userSchema.postLikes.userId})`
                })
                    .from(userSchema.postLikes)
                    .where(inArray(userSchema.postLikes.postId, postIds))
                    .groupBy(userSchema.postLikes.postId);

                likesData.forEach(l => likesMap.set(l.postId, l.totalLikes || 0));
            } catch (e) {
                console.error("Failed to fetch views/likes in getPostsByTag", e);
            }
        }

        return filtered.map(r => ({
            ...r,
            tags: this.safeParseTags(r.tags),
            view_count: viewsMap.get(r.id) || 0,
            like_count: likesMap.get(r.id) || 0
        })) as any[];
    }

    async getAllTags(lang: string = 'ko', dbDefaultLang: string = 'ko'): Promise<string[]> {
        try {
            const results = await this.db.select({
                tags: schema.posts.tags
            })
                .from(schema.posts)
                .where(and(eq(schema.posts.status, 'published'), eq(schema.posts.type, 'post'), eq(schema.posts.lang, lang)));

            const tagsSet = new Set<string>();
            results.forEach(r => {
                const parsed = this.safeParseTags(r.tags);
                parsed.forEach(t => {
                    if (t) tagsSet.add(t.trim());
                });
            });
            return Array.from(tagsSet).sort();
        } catch (error) {
            console.error('Error in getAllTags:', error);
            return [];
        }
    }

    // USER_DB 데이터 (댓글, 방명록) - Drizzle drizzle(userD1) 필요시 추가
    async getComments(postId: string) {
        const { results } = await this.userD1.prepare('SELECT * FROM comments WHERE post_id = ? AND is_deleted = 0 ORDER BY created_at ASC').bind(postId).all();
        return results;
    }

    async getRecentEntries(lang: string = 'ko', dbDefaultLang: string = 'ko', limitComments?: number, limitGuestbooks?: number) {
        let finalLimitComments = limitComments ?? 5;
        let finalLimitGuestbooks = limitGuestbooks ?? 5;

        if (limitComments === undefined || limitGuestbooks === undefined) {
            const { results: settings } = await this.blogD1.prepare(
                "SELECT key, value FROM blog_settings WHERE key IN ('dashboard_recent_comments', 'dashboard_recent_guestbooks')"
            ).all();

            if (settings) {
                for (const row of settings as any[]) {
                    if (row.key === 'dashboard_recent_comments' && limitComments === undefined) {
                        finalLimitComments = parseInt(row.value, 10) || 5;
                    }
                    if (row.key === 'dashboard_recent_guestbooks' && limitGuestbooks === undefined) {
                        finalLimitGuestbooks = parseInt(row.value, 10) || 5;
                    }
                }
            }
        }

        const { results: rawComments } = await this.userD1.prepare(`
            SELECT e.id, e.created_at, e.target_id as post_id, u.name as user_name
            FROM entries e LEFT JOIN user u ON e.user_id = u.id
            WHERE e.type = 'comment' AND e.is_deleted = 0
            ORDER BY e.created_at DESC LIMIT ?
        `).bind(finalLimitComments).all();

        let comments: any[] = [];
        if (rawComments && rawComments.length > 0) {
            const postIds = rawComments.map((c: any) => `'${c.post_id}'`).filter((id: string) => id !== "'null'").join(',');
            if (postIds) {
                const { results: postTitles } = await this.blogD1.prepare(`
                    SELECT id, title, slug, lang, category_slug FROM posts WHERE slug IN (${postIds})
                `).all();

                const titleMap: Record<string, Record<string, { title: string; slug: string; categorySlug: string }>> = {};
                for (const row of postTitles as any[]) {
                    if (!titleMap[row.slug]) {
                        titleMap[row.slug] = {};
                    }
                    titleMap[row.slug][row.lang] = { title: row.title, slug: row.slug, categorySlug: row.category_slug || 'all' };
                }

                comments = rawComments.map((c: any) => {
                    const slug = c.post_id;
                    const langMap = titleMap[slug] || {};
                    const matched = langMap[lang] || langMap[dbDefaultLang] || Object.values(langMap)[0];

                    return {
                        id: c.id,
                        type: 'comment',
                        post_id: slug,
                        post_title: matched?.title || '알 수 없는 포스트',
                        post_slug: matched?.slug || slug,
                        post_category: matched?.categorySlug || 'all',
                        user_name: c.user_name || '익명',
                        created_at: c.created_at
                    };
                });
            } else {
                comments = rawComments.map((c: any) => ({
                    id: c.id,
                    type: 'comment',
                    post_id: c.post_id,
                    post_title: '알 수 없는 포스트',
                    post_slug: '',
                    user_name: c.user_name || '익명',
                    created_at: c.created_at
                }));
            }
        }

        const { results: rawGuestbooks } = await this.userD1.prepare(`
            SELECT e.id, e.is_private, e.created_at, u.name as user_name
            FROM entries e LEFT JOIN user u ON e.user_id = u.id
            WHERE e.type = 'guestbook' AND e.is_deleted = 0
            ORDER BY e.created_at DESC LIMIT ?
        `).bind(finalLimitGuestbooks).all();

        const guestbooks = (rawGuestbooks || []).map((gb: any) => {
            const isPrivate = gb.is_private === 1;
            return {
                id: gb.id,
                type: 'guestbook',
                is_private: isPrivate,
                user_name: isPrivate ? null : (gb.user_name || '익명'),
                created_at: gb.created_at
            };
        });

        return { comments, guestbooks };
    }
}
