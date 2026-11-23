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

import type { D1Database } from '@cloudflare/workers-types';
import { extractThreePartHubContent, isValidHubCategory } from '@blog/shared';

export const DEFAULT_HUB_INGEST_URL = 'https://hub.sveltekitblog.com/api/v1/posts/ingest';

export interface PostSyncData {
    title: string;
    slug: string;
    excerpt?: string;
    content?: string;         // 원본 본문 (HTML 또는 Markdown)
    contentType?: string;     // 'html' | 'markdown'
    category?: string;
    categorySlug?: string;
    hubCategory?: string;     // 에디터에서 선택한 허브 8대 공식 카테고리 슬러그 (DB 미저장, 전송 전용)
    featuredImage?: string;
    tags?: string | string[];
    lang?: string;
    publishedAt?: string;
    url?: string;
    status?: 'published' | 'hidden';
}

export interface HubSyncResult {
    success: boolean;
    httpStatus?: number;
    code?: string;
    action?: string;
    category?: string;
    isAbuseReset?: boolean;
    currentLength?: number;
    minRequiredLength?: number;
    requestedCategory?: string;
    suggestedCategory?: string;
    retryAfterSeconds?: number;
    suspendedUntil?: string;
    reason?: string;
    message?: string;
    error?: string;
    lang?: string;
    title?: string;
}

/**
 * 1. 상대 경로 이미지를 절대 URL로 변환하는 유틸
 */
export function makeAbsoluteUrl(urlStr: string | undefined, siteUrl: string): string {
    if (!urlStr) return '';
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) {
        return urlStr;
    }
    const cleanBase = siteUrl.replace(/\/+$/, '');
    const cleanPath = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
    return `${cleanBase}${cleanPath}`;
}

/**
 * 다국어 사이트 제목에서 포스트 언어에 맞는 사이트명을 추출하는 헬퍼
 */
export function resolveSiteName(siteTitleRaw: string | undefined, lang: string): string {
    if (!siteTitleRaw) return '';
    try {
        const parsed = JSON.parse(siteTitleRaw);
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed[lang] || parsed['ko'] || parsed['en'] || Object.values(parsed)[0] || '';
        }
    } catch {
        // JSON이 아닌 일반 문자열일 경우 그대로 반환
    }
    return siteTitleRaw;
}

/**
 * 허브 설정(URL, API Key, 사이트 대표 URL)을 DB에서 로드
 */
async function getHubConfig(db: D1Database) {
    const { results } = await db
        .prepare("SELECT key, value FROM blog_settings WHERE key IN ('board_hub_url', 'board_api_key', 'siteUrl', 'site_title')")
        .all();

    const map: Record<string, string> = {};
    (results || []).forEach((row: any) => { map[row.key] = row.value; });

    const rawApiKey = map['board_api_key']?.trim() || '';
    const apiKey = rawApiKey.replace(/^Bearer\s+/i, '').trim();

    let ingestUrl = (map['board_hub_url']?.trim() || 'https://hub.sveltekitblog.com').replace(/\/+$/, '');
    if (!ingestUrl.endsWith('/api/v1/posts/ingest')) {
        ingestUrl += '/api/v1/posts/ingest';
    }

    const siteUrl = (map['siteUrl'] || 'https://sveltekitblog.com').replace(/\/+$/, '');
    const siteTitleRaw = map['site_title'] || '';

    return { apiKey, ingestUrl, siteUrl, siteTitleRaw };
}

/**
 * 포스트의 전체 공개 URL 생성 헬퍼
 */
export function buildPostUrl(siteUrl: string, lang: string, categorySlug: string, slug: string): string {
    const base = (siteUrl || 'https://sveltekitblog.com').replace(/\/+$/, '');
    const cleanLang = (lang && lang !== 'ko') ? `/${lang}` : '';
    const cleanCat = categorySlug || 'general';
    return `${base}${cleanLang}/${cleanCat}/${slug}`;
}

/**
 * 1. publishPostToHub (발행 및 공개 수정 시 호출) - POST (status: 'published')
 */
export async function publishPostToHub(post: PostSyncData, db: D1Database): Promise<HubSyncResult> {
    const lang = post.lang || 'ko';
    try {
        if (!db) return { success: false, reason: 'database_unavailable', lang, title: post.title };

        const { apiKey, ingestUrl, siteUrl, siteTitleRaw } = await getHubConfig(db);
        if (!apiKey) return { success: false, reason: 'no_api_key', lang, title: post.title };

        const categorySlug = post.categorySlug || post.category || 'general';
        const postUrl = post.url || buildPostUrl(siteUrl, lang, categorySlug, post.slug);
        // 900자 이하 시 전체, 900자 초과 시 앞 300자 + 중간 300자 + 뒤 300자(총 900자) 순수 텍스트 추출
        const sampledContent = extractThreePartHubContent(post.content, post.contentType || 'html');
        const featuredImageUrl = makeAbsoluteUrl(post.featuredImage, siteUrl);
        const siteName = resolveSiteName(siteTitleRaw, lang);
        const resolvedHubCategory = isValidHubCategory(post.hubCategory)
            ? post.hubCategory
            : (isValidHubCategory(categorySlug) ? categorySlug : undefined);

        let parsedTags: string[] = [];
        if (Array.isArray(post.tags)) {
            parsedTags = post.tags;
        } else if (typeof post.tags === 'string' && post.tags.trim()) {
            try {
                const p = JSON.parse(post.tags);
                parsedTags = Array.isArray(p) ? p : post.tags.split(',').map(t => t.trim());
            } catch {
                parsedTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
        }

        const payload = {
            site_name: siteName,
            post: {
                title: post.title,
                site_name: siteName,
                excerpt: post.excerpt || '',
                content: sampledContent,
                original_url: postUrl,
                featured_image: featuredImageUrl,
                category: resolvedHubCategory,
                tags: parsedTags,
                lang: lang,
                status: 'published',
                is_published: true,
                published_at: post.publishedAt || new Date().toISOString()
            }
        };

        const response = await fetch(ingestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`,
                'Accept-Language': lang
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            let parsedErr: any = {};
            try {
                parsedErr = JSON.parse(errBody);
            } catch {
                // non-JSON response
            }
            console.error(`[Hub Publish Failed]: HTTP ${response.status} - ${errBody}`);
            return {
                success: false,
                httpStatus: response.status,
                code: parsedErr.code,
                message: parsedErr.message || parsedErr.error,
                currentLength: parsedErr.currentLength,
                minRequiredLength: parsedErr.minRequiredLength,
                requestedCategory: parsedErr.requestedCategory,
                suggestedCategory: parsedErr.suggestedCategory,
                retryAfterSeconds: parsedErr.retryAfterSeconds,
                suspendedUntil: parsedErr.suspendedUntil,
                error: parsedErr.message || `HTTP ${response.status}: ${errBody}`,
                lang,
                title: post.title
            };
        }

        const resData: any = await response.json().catch(() => ({}));
        console.log(`[Hub Publish Success]: ${resData.action || 'published'} (${post.title})`);
        return {
            success: true,
            httpStatus: response.status,
            code: resData.code || 'POST_CREATED',
            action: resData.action || 'created',
            category: resData.category || resolvedHubCategory,
            isAbuseReset: Boolean(resData.isAbuseReset),
            message: resData.message,
            lang,
            title: post.title
        };
    } catch (err: any) {
        console.error('[Hub Publish Exception]:', err.message || err);
        return { success: false, error: err.message || String(err), lang, title: post.title };
    }
}

/**
 * 2. hidePostFromHub (비공개 전환 또는 허브 체크 해제 시 호출) - POST (status: 'hidden')
 * 💡 기존 좋아요(추천) 통계를 안전하게 보존하면서 허브 피드에서만 숨깁니다.
 */
export async function hidePostFromHub(post: PostSyncData, db: D1Database): Promise<HubSyncResult> {
    const lang = post.lang || 'ko';
    try {
        if (!db) return { success: false, reason: 'database_unavailable', lang, title: post.title };

        const { apiKey, ingestUrl, siteUrl, siteTitleRaw } = await getHubConfig(db);
        if (!apiKey) return { success: false, reason: 'no_api_key', lang, title: post.title };

        const categorySlug = post.categorySlug || post.category || 'general';
        const postUrl = post.url || buildPostUrl(siteUrl, lang, categorySlug, post.slug);
        const siteName = resolveSiteName(siteTitleRaw, lang);

        const featuredImageUrl = makeAbsoluteUrl(post.featuredImage, siteUrl);

        const payload = {
            site_name: siteName,
            post: {
                title: post.title,
                site_name: siteName,
                excerpt: post.excerpt || '',
                original_url: postUrl,
                featured_image: featuredImageUrl,
                tags: Array.isArray(post.tags) ? post.tags : [],
                lang: lang,
                status: 'hidden',
                is_published: false,
                published_at: post.publishedAt || new Date().toISOString()
            }
        };

        const response = await fetch(ingestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`,
                'Accept-Language': lang
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`[Hub Hide Failed]: HTTP ${response.status} - ${errBody}`);
            return { success: false, error: `HTTP ${response.status}: ${errBody}` };
        }

        const resData: any = await response.json().catch(() => ({}));
        console.log(`[Hub Hide Success]: ${resData.action || 'hidden'} (${post.title})`);
        return { success: true, action: 'hidden', message: resData.message };
    } catch (err: any) {
        console.error('[Hub Hide Exception]:', err.message || err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * 3. removePostFromHub (글 완전 삭제 시 호출) - DELETE
 * 💡 허브 서버 정책: 좋아요 0개는 완전삭제 / 좋아요 1개 이상은 통계 보존 숨김
 */
export async function removePostFromHub(originalUrl: string, db: D1Database): Promise<HubSyncResult> {
    try {
        if (!db || !originalUrl) return { success: false, reason: 'invalid_params' };

        const { apiKey, ingestUrl } = await getHubConfig(db);
        if (!apiKey) return { success: false, reason: 'no_api_key' };

        const payload = {
            original_url: originalUrl
        };

        const response = await fetch(ingestUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`[Hub Remove Failed]: HTTP ${response.status} - ${errBody}`);
            return { success: false, error: `HTTP ${response.status}: ${errBody}` };
        }

        const resData: any = await response.json().catch(() => ({}));
        console.log(`[Hub Remove Success]: ${resData.action || 'removed'} (${originalUrl})`);
        return { success: true, action: resData.action || 'deleted', message: resData.message };
    } catch (err: any) {
        console.error('[Hub Remove Exception]:', err.message || err);
        return { success: false, error: err.message || String(err) };
    }
}
