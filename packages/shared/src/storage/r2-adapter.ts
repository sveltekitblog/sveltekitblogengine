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

export class R2StorageAdapter implements StorageAdapter {
    constructor(private r2: any) { }

    async put(key: string, body: ArrayBuffer, options: PutOptions): Promise<void> {
        await this.r2.put(key, body, {
            httpMetadata: { contentType: options.contentType },
        });
    }

    async get(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
        const obj = await this.r2.get(key);
        if (!obj) return null;
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        return {
            body: obj.body,
            contentType: headers.get('content-type') || 'application/octet-stream',
        };
    }

    async list(prefix: string, cursor?: string, _options?: { action?: string | null }): Promise<ListResult> {
        const options: { prefix: string; limit: number; cursor?: string; delimiter: string } = { prefix, limit: 100, cursor, delimiter: '/' };
        const result = await this.r2.list(options);
        return {
            objects: result.objects.map((obj: any) => ({
                key: obj.key,
                size: obj.size,
                uploaded: obj.uploaded?.toISOString() ?? new Date().toISOString(),
            })),
            folders: result.delimitedPrefixes || [],
            truncated: result.truncated,
            cursor: result.cursor,
        };
    }

    async delete(keys: string[]): Promise<void> {
        await this.r2.delete(keys);
    }

    getPublicUrl(key: string, siteUrl: string): string {
        const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
        return `${base}/images/${key}`;
    }
}
