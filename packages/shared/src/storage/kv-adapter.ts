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

import type { StorageAdapter, PutOptions, ListResult } from './types';

export class KVStorageAdapter implements StorageAdapter {
    constructor(private kv: any) { }

    async put(key: string, body: ArrayBuffer, options: PutOptions): Promise<void> {
        await this.kv.put(key, body, {
            metadata: { contentType: options.contentType },
        });
    }

    async get(key: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
        const result = await this.kv.getWithMetadata(key, 'arrayBuffer');
        const value = result?.value as ArrayBuffer | null;
        const meta = result?.metadata as { contentType?: string } | null;
        if (!value) return null;
        return {
            body: value,
            contentType: meta?.contentType || 'application/octet-stream',
        };
    }

    /**
     * KV prefix scanning is intentionally disabled.
     * Each list call triggers a Cloudflare Workers API invocation
     * which consumes the free tier quota rapidly.
     * Upload and delete operations are still fully functional.
     * EXCEPTION: During media backup process (action === 'backup'), it allows scanning keys.
     */
    async list(_prefix: string, _cursor?: string, options?: { action?: string | null }): Promise<ListResult> {
        if (options?.action === 'backup') {
            const result = await this.kv.list({ prefix: _prefix, cursor: _cursor });
            return {
                objects: result.keys.map((k: any) => ({
                    key: k.name,
                    size: 0,
                    uploaded: new Date().toISOString()
                })),
                folders: [],
                truncated: result.list_complete === false,
                cursor: result.cursor
            };
        }

        return {
            objects: [],
            folders: [],
            truncated: false,
            disabled: true,
            disabledReason: 'kv_scan_disabled',
        };
    }

    async delete(keys: string[]): Promise<void> {
        await Promise.all(keys.map((key) => this.kv.delete(key)));
    }

    getPublicUrl(key: string, siteUrl: string): string {
        const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
        return `${base}/images/${key}`;
    }
}
