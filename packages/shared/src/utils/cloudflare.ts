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

/**
 * Cloudflare Cache Purge Utility
 */

/**
 * 특정 URL 목록의 에지 캐시를 강제로 퍼지(무효화)합니다.
 * Cloudflare v4 API의 URL당 퍼지 제한(1회 최대 30개)에 맞추어 청크 분할하여 전송합니다.
 */
export async function purgeCacheUrls(
    urls: string[],
    zoneId: string | undefined,
    apiToken: string | undefined
): Promise<boolean> {
    const finalZoneId = zoneId || (typeof process !== 'undefined' ? process.env.CLOUDFLARE_ZONE_ID : undefined);
    const finalApiToken = apiToken || (typeof process !== 'undefined' ? process.env.CLOUDFLARE_API_TOKEN : undefined);

    if (!finalZoneId || !finalApiToken) {
        console.warn('  ⚠️ Cloudflare Zone ID or API Token is missing. Purge skipped.');
        return false;
    }

    const cleanUrls = urls.filter(Boolean).map(u => u.trim());
    if (cleanUrls.length === 0) {
        return true;
    }

    // Cloudflare API는 요청당 최대 30개의 URL을 퍼지할 수 있습니다.
    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < cleanUrls.length; i += CHUNK_SIZE) {
        chunks.push(cleanUrls.slice(i, i + CHUNK_SIZE));
    }

    console.log(`  🌐 Cloudflare Cache Purge initiated. Total URLs: ${cleanUrls.length}, Chunks: ${chunks.length}`);
    
    let allSuccess = true;
    for (const chunk of chunks) {
        try {
            const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${finalZoneId}/purge_cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${finalApiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: chunk })
            });

            const result = await response.json() as any;
            if (response.ok && result.success) {
                console.log(`  ✅ Successfully purged ${chunk.length} URLs.`);
            } else {
                console.error(`  ❌ Failed to purge URLs. Error:`, JSON.stringify(result.errors || result));
                allSuccess = false;
            }
        } catch (e) {
            console.error('  ❌ Error requesting Cloudflare cache purge:', e);
            allSuccess = false;
        }
    }

    return allSuccess;
}

/**
 * 블로그 사이트 전체의 캐시를 즉시 무효화(Purge Everything)합니다.
 * 주로 전체 테마 복원이나 데이터 마이그레이션 완료 시점에 사용됩니다.
 */
export async function purgeEverything(
    zoneId: string | undefined,
    apiToken: string | undefined
): Promise<boolean> {
    const finalZoneId = zoneId || (typeof process !== 'undefined' ? process.env.CLOUDFLARE_ZONE_ID : undefined);
    const finalApiToken = apiToken || (typeof process !== 'undefined' ? process.env.CLOUDFLARE_API_TOKEN : undefined);

    if (!finalZoneId || !finalApiToken) {
        console.warn('  ⚠️ Cloudflare Zone ID or API Token is missing. Purge everything skipped.');
        return false;
    }

    console.log('  🌐 Requesting Cloudflare Purge Everything...');

    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${finalZoneId}/purge_cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${finalApiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ purge_everything: true })
        });

        const result = await response.json() as any;
        if (response.ok && result.success) {
            console.log('  ✅ Successfully purged everything.');
            return true;
        } else {
            console.error('  ❌ Failed to purge everything. Error:', JSON.stringify(result.errors || result));
            return false;
        }
    } catch (e) {
        console.error('  ❌ Error requesting Cloudflare purge everything:', e);
        return false;
    }
}
