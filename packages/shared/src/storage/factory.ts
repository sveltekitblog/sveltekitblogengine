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

import type { StorageAdapter, StorageBindings } from './types';
import { R2StorageAdapter } from './r2-adapter';
import { KVStorageAdapter } from './kv-adapter';
import { ImageKitAdapter } from './imagekit-adapter';
import { SupabaseStorageAdapter } from './supabase-adapter';

/**
 * Returns the appropriate StorageAdapter based on blog_settings.storage_type.
 * Falls back to R2 if the setting is missing or unrecognised.
 *
 * @param bindings - Cloudflare resource bindings (decoupled from App.Platform)
 * @param dbOverride - Optional D1 database instance override for reading settings
 */
export async function getStorageAdapter(
    bindings: StorageBindings,
    dbOverride?: any
): Promise<StorageAdapter> {
    const dbInstance = dbOverride ?? bindings.BLOG_DB;
    const settingsMap: Record<string, string> = {};

    if (dbInstance) {
        try {
            const keys = [
                'storage_type',
                'imagekit_private_key', 'imagekit_url_endpoint', 'imagekit_proxy_mode',
                'supabase_storage_url', 'supabase_storage_key', 'supabase_storage_bucket',
            ];
            const placeholders = keys.map(() => '?').join(',');
            const rows = await dbInstance
                .prepare(`SELECT key, value FROM blog_settings WHERE key IN (${placeholders})`)
                .bind(...keys)
                .all();
            const results = (rows.results || []) as Array<{ key: string; value: string }>;
            for (const row of results) {
                settingsMap[row.key] = row.value;
            }
        } catch {
            // Fall back to R2 if DB lookup fails
        }
    }

    const type = settingsMap['storage_type'] || 'kv';

    switch (type) {
        case 'kv': {
            const kv = bindings.IMAGES_KV;
            if (!kv) throw new Error('KV binding IMAGES_KV not found. Check wrangler.json.');
            return new KVStorageAdapter(kv);
        }
        case 'imagekit': {
            const privateKey = settingsMap['imagekit_private_key'] || '';
            const urlEndpoint = settingsMap['imagekit_url_endpoint'] || '';
            const proxyMode = settingsMap['imagekit_proxy_mode'] === 'true';
            return new ImageKitAdapter({ IMAGEKIT_PRIVATE_KEY: privateKey, IMAGEKIT_URL_ENDPOINT: urlEndpoint, proxyMode });
        }
        case 'supabase': {
            const storageUrl = settingsMap['supabase_storage_url'] || '';
            const serviceKey = settingsMap['supabase_storage_key'] || '';
            const bucket = settingsMap['supabase_storage_bucket'] || 'images';
            if (!storageUrl || !serviceKey) {
                throw new Error('Supabase storage settings are incomplete. Please configure supabase_storage_url and supabase_storage_key.');
            }
            return new SupabaseStorageAdapter({ storageUrl, serviceKey, bucket });
        }
        default: {
            const r2 = bindings.IMAGES;
            if (!r2) throw new Error('R2 binding IMAGES not found. Check wrangler.json.');
            return new R2StorageAdapter(r2);
        }
    }
}
