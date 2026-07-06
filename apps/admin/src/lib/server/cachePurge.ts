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

import { dev } from '$app/environment';
import { purgeCacheUrls, purgeEverything } from '@blog/shared';

export async function purgeCdnCache(
    platform: any,
    db: any,
    options?: {
        purgeEverything?: boolean;
        categorySlug?: string;
        slug?: string;
    }
) {
    if (dev) {
        console.log('[Purge Cache] dev 환경이므로 캐시 퍼지를 생략합니다.');
        return { success: true, message: 'Skipped in development' };
    }

    const env = platform?.env || {};
    const zoneId = env.CLOUDFLARE_ZONE_ID;
    const apiToken = env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) {
        console.warn('[Purge Cache] CLOUDFLARE_ZONE_ID 또는 CLOUDFLARE_API_TOKEN이 환경변수에 설정되어 있지 않아 캐시 퍼지를 수행할 수 없습니다.');
        return { success: false, error: 'Cloudflare credentials missing' };
    }

    const shouldPurgeAll = options?.purgeEverything ?? false;

    // 전체 퍼지 요청인 경우
    if (shouldPurgeAll) {
        const success = await purgeEverything(zoneId, apiToken);
        return { success, message: success ? 'Purge everything request succeeded' : 'Purge everything request failed' };
    }

    // 1. DB에서 블로그 도메인 주소(siteUrl) 가져오기
    let siteUrl = '';
    try {
        const row = await db.prepare("SELECT value FROM blog_settings WHERE key = 'siteUrl'").first();
        siteUrl = row?.value || '';
    } catch (e) {
        console.error('[Purge Cache] DB에서 siteUrl을 조회하는 데 실패했습니다:', e);
    }

    // 도메인 주소가 등록되어 있지 않다면 안전장치로 사이트 전체 캐시 퍼지 처리
    if (!siteUrl) {
        console.warn('[Purge Cache] blog_settings에 siteUrl이 설정되어 있지 않아 개별 URL 퍼지를 수행할 수 없습니다. 전체 캐시 무효화로 우회합니다.');
        const success = await purgeEverything(zoneId, apiToken);
        return { success, message: 'Fallback to purge everything' };
    }

    const base = siteUrl.replace(/\/$/, '');
    const urls: string[] = [];

    // Helper: HTML 주소와 SvelteKit __data.json 주소를 쌍으로 추가하는 함수
    const addUrlWithDataJson = (urlPath: string) => {
        // 일반 HTML 페이지 경로
        urls.push(urlPath);
        // SvelteKit 데이터 로더 경로 (__data.json)
        const clean = urlPath.replace(/\/$/, '');
        urls.push(`${clean}/__data.json`);
    };

    // 2. 메인 홈 화면 추가 (기본 홈, trailing slash 홈)
    addUrlWithDataJson(`${base}/`);
    addUrlWithDataJson(base);

    // 3. 다국어 홈 화면 추가 (언어별 리스트 로딩)
    try {
        const { results } = await db.prepare('SELECT code FROM languages').all();
        if (results && Array.isArray(results)) {
            for (const lang of results) {
                if (lang.code) {
                    addUrlWithDataJson(`${base}/${lang.code}`);
                    addUrlWithDataJson(`${base}/${lang.code}/`);
                }
            }
        }
    } catch (e) {
        console.warn('[Purge Cache] 언어 목록 조회 중 예외 발생:', e);
    }

    // 5. 카테고리 목록 페이지 캐시 무효화 추가
    if (options?.categorySlug) {
        addUrlWithDataJson(`${base}/${options.categorySlug}`);
        addUrlWithDataJson(`${base}/${options.categorySlug}/`);
        
        // 다국어 카테고리
        try {
            const { results } = await db.prepare('SELECT code FROM languages').all();
            if (results && Array.isArray(results)) {
                for (const lang of results) {
                    if (lang.code) {
                        addUrlWithDataJson(`${base}/${lang.code}/${options.categorySlug}`);
                        addUrlWithDataJson(`${base}/${lang.code}/${options.categorySlug}/`);
                    }
                }
            }
        } catch (e) {}
    }

    // 6. 포스트 상세 페이지 캐시 무효화 추가
    if (options?.categorySlug && options?.slug) {
        addUrlWithDataJson(`${base}/${options.categorySlug}/${options.slug}`);
        addUrlWithDataJson(`${base}/${options.categorySlug}/${options.slug}/`);
        
        // 다국어 상세
        try {
            const { results } = await db.prepare('SELECT code FROM languages').all();
            if (results && Array.isArray(results)) {
                for (const lang of results) {
                    if (lang.code) {
                        addUrlWithDataJson(`${base}/${lang.code}/${options.categorySlug}/${options.slug}`);
                        addUrlWithDataJson(`${base}/${lang.code}/${options.categorySlug}/${options.slug}/`);
                    }
                }
            }
        } catch (e) {}
    }

    // 중복 제거
    const uniqueUrls = Array.from(new Set(urls));
    console.log('[Purge Cache] 최종 무효화 타겟 URL 목록:', uniqueUrls);

    // 공통 퍼지 유틸리티를 호출하여 30개씩 분할 전송
    const success = await purgeCacheUrls(uniqueUrls, zoneId, apiToken);
    return { success, urls: uniqueUrls };
}
