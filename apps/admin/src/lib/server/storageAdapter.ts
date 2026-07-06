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
 * Storage Adapter — Admin App Compatibility Wrapper
 *
 * Re-exports the shared storage module with a platform-based convenience wrapper
 * so existing route handlers (getStorageAdapter(platform, db)) continue to work unchanged.
 */

// Re-export all types and adapters from shared for direct use
export type {
    StorageAdapter,
    StorageObject,
    ListResult,
    PutOptions,
    StorageBindings,
} from '@blog/shared/storage';

export {
    R2StorageAdapter,
    KVStorageAdapter,
    ImageKitAdapter,
    SupabaseStorageAdapter,
} from '@blog/shared/storage';

import { getStorageAdapter as _getStorageAdapter } from '@blog/shared/storage';
import type { StorageAdapter } from '@blog/shared/storage';

/**
 * Platform-aware wrapper that extracts bindings from App.Platform
 * and delegates to the shared getStorageAdapter factory.
 *
 * This preserves the existing call signature used across all admin API routes:
 *   const adapter = await getStorageAdapter(platform!, db);
 */
export async function getStorageAdapter(
    platform: App.Platform,
    db?: any
): Promise<StorageAdapter> {
    const env = platform?.env as any;
    return _getStorageAdapter(
        {
            IMAGES: env?.IMAGES,
            IMAGES_KV: env?.IMAGES_KV,
            BLOG_DB: env?.BLOG_DB,
        },
        db
    );
}
