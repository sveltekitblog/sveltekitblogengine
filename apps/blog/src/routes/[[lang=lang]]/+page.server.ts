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

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, parent, setHeaders }) => {
    const { layoutWidgets, settings, isMobile, languages, dbDefaultLang } = await parent();

    const enableCdnCache = settings?.enable_cdn_cache === 'true' || settings?.enable_cdn_cache === true;
    const cdnCacheTtl = Number(settings?.cdn_cache_ttl) || 120;

    if (locals.user) {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
    } else if (enableCdnCache) {
        setHeaders({
            'Cache-Control': `public, max-age=60, s-maxage=${cdnCacheTtl}, stale-while-revalidate=60`,
            'Cloudflare-CDN-Cache-Control': `public, max-age=${cdnCacheTtl}`,
            'Vary': 'Cookie'
        });
    } else {
        setHeaders({
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
    }

    // Helper to get translated string
    const getTrans = (val: any) => {
        if (!val) return "";
        if (typeof val === 'string' && val.startsWith('{')) {
            try {
                const parsed = JSON.parse(val);
                return parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || val;
            } catch(e) { return val; }
        }
        if (typeof val === 'object' && val !== null) {
            return val[locals.lang || locals.dbDefaultLang] || val[locals.dbDefaultLang] || Object.values(val)[0] || "";
        }
        return val;
    };

    let limit = 10;
    const pcWidget = layoutWidgets?.find((w: any) => w.type === 'PostContent' || w.type === 'post_content');
    if (pcWidget && pcWidget.config) {
        try {
            const rawConfig = typeof pcWidget.config === 'string' ? JSON.parse(pcWidget.config) : pcWidget.config;
            // Handle nested {desktop, mobile} config structure
            const config = isMobile && rawConfig.mobile ? rawConfig.mobile : (rawConfig.desktop || rawConfig);
            if (config.itemsPerPage) limit = Number(config.itemsPerPage);
        } catch (e) {
            console.error("Error parsing PostContent widget config", e);
        }
    }

    const pageNum = Number(url.searchParams.get('page')) || 1;
    const rawPosts = locals.db ? await locals.db.getRecentPosts(limit + 1, undefined, pageNum, limit, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang) : [];
    const hasNextPage = rawPosts.length > limit;
    const posts = rawPosts.slice(0, limit);

    const siteTitle = getTrans(settings?.header?.logoText) || getTrans(settings?.site_title) || 'Blog';
    const siteDescription = getTrans(settings?.description) || 'Welcome to my blog';

    const cleanUrl = `${url.origin}${url.pathname}`;
    const siteUrl = settings?.siteUrl || url.origin;
    const cleanBase = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

    let lcpImage = "";
    if (posts && posts.length > 0) {
        if (posts[0].featuredImage) {
            const rawImg = posts[0].featuredImage;
            const desktopUrl = rawImg.replace("maxresdefault.jpg", "hqdefault.jpg")
                                     .replace("/mobile/", "/desktop/")
                                     .replace("/thumbnail/", "/desktop/");
            const relPath = desktopUrl.replace("/desktop/", "/mobile/");
            lcpImage = relPath.startsWith("http://") || relPath.startsWith("https://")
                ? relPath
                : `${cleanBase}${relPath.startsWith('/') ? relPath : '/' + relPath}`;
        } else {
            lcpImage = `${cleanBase}/images/no_image_placeholder.webp`;
        }
    }

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": siteTitle,
        "url": siteUrl,
        "description": siteDescription,
        "publisher": {
            "@type": "Organization",
            "name": siteTitle,
            "logo": {
                "@type": "ImageObject",
                "url": settings?.logo || ''
            }
        }
    };

    const activeLangs = (languages && languages.length > 0)
        ? languages.map((l: any) => l.code)
        : [locals.dbDefaultLang || 'ko'];

    const alternates = activeLangs.map((code: string) => ({
        lang: code,
        url: `${cleanBase}${code === (dbDefaultLang || 'ko') ? '' : `/${code}`}/`
    }));

    const xDefaultUrl = `${cleanBase}/`;

    const seo = {
        title: siteTitle,
        description: siteDescription,
        url: cleanUrl,
        image: settings?.logo || '',
        jsonLd: JSON.stringify(jsonLd),
        alternates,
        xDefaultUrl
    };

    return {
        posts,
        page: pageNum,
        limit,
        hasNextPage,
        seo,
        lcpImage
    };
};
