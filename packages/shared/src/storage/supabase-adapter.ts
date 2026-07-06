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

/**
 * Supabase Storage adapter.
 * Uses the Supabase Storage REST API directly (no SDK) — edge-runtime compatible.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
    private baseUrl: string;
    private bucket: string;
    private auth: string;

    constructor(opts: { storageUrl: string; serviceKey: string; bucket: string }) {
        this.baseUrl = opts.storageUrl.replace(/\/$/, '');
        this.bucket = opts.bucket;
        this.auth = `Bearer ${opts.serviceKey}`;
    }

    async put(key: string, body: ArrayBuffer, options: PutOptions): Promise<void> {
        const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${key}`, {
            method: 'POST',
            headers: { Authorization: this.auth, 'Content-Type': options.contentType, 'x-upsert': 'true' },
            body,
        });
        if (!res.ok) {
            const err = await res.json() as { message?: string };
            throw new Error(`Supabase upload failed: ${err.message || res.statusText}`);
        }
    }

    async get(key: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
        const res = await fetch(`${this.baseUrl}/object/${this.bucket}/${key}`, {
            headers: { Authorization: this.auth },
        });
        if (!res.ok) return null;
        return {
            body: await res.arrayBuffer(),
            contentType: res.headers.get('content-type') || 'application/octet-stream',
        };
    }

    async list(prefix: string, _cursor?: string, _options?: { action?: string | null }): Promise<ListResult> {
        const res = await fetch(`${this.baseUrl}/object/list/${this.bucket}`, {
            method: 'POST',
            headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: prefix || '', limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (!res.ok) {
            const err = await res.json() as { message?: string };
            throw new Error(`Supabase list failed: ${err.message || res.statusText}`);
        }
        const items = await res.json() as Array<{ name: string; id: string | null; metadata: any }>;
        return {
            objects: items
                .filter((i) => i.id !== null)
                .map((i) => ({
                    key: prefix ? `${prefix}${i.name}` : i.name,
                    size: i.metadata?.size ?? 0,
                    uploaded: i.metadata?.lastModified ?? new Date().toISOString(),
                })),
            folders: items
                .filter((i) => i.id === null)
                .map((i) => (prefix ? `${prefix}${i.name}/` : `${i.name}/`)),
            truncated: false,
        };
    }

    async delete(keys: string[]): Promise<void> {
        const res = await fetch(`${this.baseUrl}/object/${this.bucket}`, {
            method: 'DELETE',
            headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: keys }),
        });
        if (!res.ok) {
            const err = await res.json() as { message?: string };
            throw new Error(`Supabase delete failed: ${err.message || res.statusText}`);
        }
    }

    getPublicUrl(key: string, siteUrl: string): string {
        const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
        return `${base}/images/${key}`;
    }
}
