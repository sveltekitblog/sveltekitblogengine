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

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const MAX_CACHE_ENTRIES = 500;

/**
 * Worker/Server-side in-memory TTL cache to eliminate redundant D1 queries
 * on high-frequency layout & widget data.
 */
export async function getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const now = Date.now();
    const cached = memoryCache.get(key);

    if (cached && cached.expiresAt > now) {
        return cached.data;
    }

    const freshData = await fetcher();

    // Prevent unbounded memory growth
    if (memoryCache.size >= MAX_CACHE_ENTRIES) {
        // Clean up expired entries first
        for (const [k, entry] of memoryCache.entries()) {
            if (entry.expiresAt <= now) {
                memoryCache.delete(k);
            }
        }
        // If still full, delete oldest
        if (memoryCache.size >= MAX_CACHE_ENTRIES) {
            const firstKey = memoryCache.keys().next().value;
            if (firstKey) memoryCache.delete(firstKey);
        }
    }

    memoryCache.set(key, {
        data: freshData,
        expiresAt: now + ttlSeconds * 1000
    });

    return freshData;
}

/**
 * Invalidate cached items by key or prefix pattern
 */
export function invalidateCache(pattern?: string): void {
    if (!pattern) {
        memoryCache.clear();
        return;
    }
    for (const key of memoryCache.keys()) {
        if (key.includes(pattern)) {
            memoryCache.delete(key);
        }
    }
}
