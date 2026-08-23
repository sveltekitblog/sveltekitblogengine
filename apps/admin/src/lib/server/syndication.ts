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

export const OFFICIAL_HUB_URL = 'https://hub.sveltekitblog.com';

export interface PostSyndicationData {
    title: string;
    slug: string;
    excerpt?: string;
    category?: string;
    categorySlug?: string;
    featuredImage?: string;
    tags?: string | string[];
    lang?: string;
    publishedAt?: string;
}

export interface SyndicationResult {
    success: boolean;
    reason?: string;
    action?: string;
    error?: string;
}

/**
 * 중앙 허브(hub.sveltekitblog.com)의 Ingestion API로 포스트 카드 메타데이터를 전송합니다.
 * Fault-Tolerant: 전송 실패나 네트워크 에러가 발생해도 블로그 자체 프로세스를 중단시키지 않습니다.
 */
export async function syndicateToHub(
    post: PostSyndicationData,
    db: D1Database,
    siteUrl: string = ''
): Promise<SyndicationResult> {
    try {
        if (!db) {
            return { success: false, reason: 'database_unavailable' };
        }

        // 1. 블로그 설정에서 허브 URL, API Key 및 사이트 대표 URL 조회
        const { results: settingsRows } = await db
            .prepare("SELECT key, value FROM blog_settings WHERE key IN ('board_hub_url', 'board_api_key', 'site_title', 'siteUrl')")
            .all();

        const settingsMap: Record<string, string> = {};
        (settingsRows || []).forEach((row: any) => {
            settingsMap[row.key] = row.value;
        });

        const rawApiKey = settingsMap['board_api_key']?.trim();
        if (!rawApiKey) {
            // API Key가 설정되지 않았으면 전송 생략
            return { success: false, reason: 'no_api_key' };
        }

        // Bearer 접두사가 이미 있다면 정리
        const apiKey = rawApiKey.replace(/^Bearer\s+/i, '').trim();

        const hubUrl = (settingsMap['board_hub_url']?.trim() || OFFICIAL_HUB_URL).replace(/\/+$/, '');
        const baseSiteUrl = (siteUrl || settingsMap['siteUrl'] || 'https://sveltekitblog.com').replace(/\/+$/, '');
        const categorySlug = post.categorySlug || post.category || 'general';
        const lang = post.lang || 'ko';

        // 2. 다국어 포스트 URL 구성
        const postUrl = `${baseSiteUrl}${lang !== 'ko' ? `/${lang}` : ''}/${categorySlug}/${post.slug}`;

        // 3. 태그 파싱
        let parsedTags: string[] = [];
        if (Array.isArray(post.tags)) {
            parsedTags = post.tags;
        } else if (typeof post.tags === 'string' && post.tags.trim()) {
            try {
                const jsonParsed = JSON.parse(post.tags);
                parsedTags = Array.isArray(jsonParsed) ? jsonParsed : post.tags.split(',').map(t => t.trim());
            } catch {
                parsedTags = post.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
        }

        // 4. 전송 페이로드 구성
        const payload = {
            post: {
                title: post.title,
                excerpt: post.excerpt || '',
                featured_image: post.featuredImage || '',
                original_url: postUrl,
                published_at: post.publishedAt || new Date().toISOString(),
                tags: parsedTags,
                lang: lang
            }
        };

        // 5. 허브로 HTTP POST 전송 (5초 타임아웃)
        const response = await fetch(`${hubUrl}/api/v1/posts/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`[Hub Syndication Failed]: HTTP ${response.status} - ${errBody}`);
            return { success: false, error: `HTTP ${response.status}: ${errBody}` };
        }

        const resData: any = await response.json().catch(() => ({}));
        console.log(`[Hub Syndication Success]: ${resData.action || 'synced'} (${post.title})`);
        return { success: true, action: resData.action || 'created' };
    } catch (err: any) {
        console.error('[Hub Syndication Exception]:', err.message || err);
        return { success: false, error: err.message || String(err) };
    }
}
