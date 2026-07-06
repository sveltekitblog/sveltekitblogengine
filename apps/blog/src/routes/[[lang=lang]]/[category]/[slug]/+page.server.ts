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

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
    if (!locals.db) {
        throw error(500, "Database not available");
    }

    const post = await locals.db.getPostBySlugAndLang(params.category, params.slug, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);

    if (!post) {
        throw error(404, 'Post not found');
    }



    // Fetch Likes
    let likeCount = 0;
    let liked = false;

    if (locals.userDb) {
        const { postLikes } = await import('@blog/shared/db/user-schema');
        const { eq, and, count } = await import('drizzle-orm');

        // Get total likes
        const likeResult = await locals.userDb
            .select({ count: count() })
            .from(postLikes)
            .where(eq(postLikes.postId, post.slug))
            .get();
        likeCount = likeResult?.count || 0;

        // Check if user liked
        const user = locals.user;
        if (user) {
            const userLike = await locals.userDb
                .select()
                .from(postLikes)
                .where(and(eq(postLikes.postId, post.slug), eq(postLikes.userId, user.id)))
                .get();
            liked = !!userLike;
        }
    }

    // --- SEO Data Calculation (Server Side) ---
    const settings = await locals.db.getSettings(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);

    const enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;
    const cdnCacheTtl = Number(settings?.cdn_cache_ttl) || 86400;

    if (locals.user) {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
    } else if (enableCdnCache) {
        // 브라우저 로컬 캐싱은 완전히 금지하여 로그인 꼬임 방지, 오직 Cloudflare 에지만 캐싱 지시
        setHeaders({
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Cloudflare-CDN-Cache-Control': `public, max-age=${cdnCacheTtl}`,
            'Vary': 'Cookie'
        });
    } else {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
    }

    const siteUrl = settings?.siteUrl || '';
    
    // Helper to get translated string from potentially localized object/string
    const getTrans = (val: any) => {
        if (!val) return "";
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || val;
            } catch(e) { return val; }
        }
        if (typeof val === 'object') {
            return val[locals.lang || locals.dbDefaultLang] || val[locals.dbDefaultLang] || Object.values(val)[0] || "";
        }
        return val;
    };

    const siteTitle = getTrans(settings?.site_title) || 'Blog';
    const postTitle = getTrans(post.title);
    
    // Generate Safe Excerpt
    const generateExcerpt = (html: string): string => {
        if (!html) return "";
        const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        return text.length > 160 ? text.substring(0, 157) + "..." : text;
    };
    const excerpt = getTrans(post.excerpt) || generateExcerpt(post.content || '');
    
    // Full URL
    const fullUrl = `${siteUrl}${locals.lang !== locals.dbDefaultLang ? `/${locals.lang}` : ''}/${post.categorySlug}/${post.slug}`;
    
    // OG Image
    const ogImage = post.featured_image || settings?.logo || '';

    // Prepare JSON-LD (Safe stringify)
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": postTitle,
        "description": excerpt,
        "image": ogImage,
        "datePublished": post.publishedAt || post.createdAt,
        "dateModified": post.updatedAt || post.createdAt,
        "author": {
            "@type": "Person",
            "name": settings?.authorName || "Blog Author"
        },
        "publisher": {
            "@type": "Organization",
            "name": siteTitle,
            "logo": {
                "@type": "ImageObject",
                "url": settings?.logo || ogImage
            }
        }
    };

    let lcpImage = "";
    const rawImg = post.featuredImage || post.featured_image;
    if (rawImg) {
        const desktopUrl = rawImg.replace("maxresdefault.jpg", "hqdefault.jpg")
                                 .replace("/mobile/", "/desktop/")
                                 .replace("/thumbnail/", "/desktop/");
        lcpImage = desktopUrl.replace("/desktop/", "/mobile/");
    } else {
        lcpImage = "/images/no_image_placeholder.webp";
    }

    return {
        post,
        likeCount,
        liked,
        lcpImage,
        seo: {
            title: `${postTitle} - ${siteTitle}`,
            description: excerpt,
            url: fullUrl,
            image: ogImage,
            siteTitle,
            jsonLd: JSON.stringify(jsonLd)
        }
    };
};
