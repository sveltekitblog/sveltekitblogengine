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

export class ImageKitAdapter implements StorageAdapter {
    private privateKey: string;
    private urlEndpoint: string;
    private proxyMode: boolean;

    constructor(env: { IMAGEKIT_PRIVATE_KEY?: string; IMAGEKIT_URL_ENDPOINT?: string; proxyMode?: boolean }) {
        this.privateKey = env.IMAGEKIT_PRIVATE_KEY || '';
        this.urlEndpoint = (env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '');
        this.proxyMode = env.proxyMode ?? false;
        if (!this.privateKey || !this.urlEndpoint) {
            throw new Error('ImageKit configuration missing: IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT are required.');
        }
    }

    private get authHeader(): string {
        return 'Basic ' + btoa(this.privateKey + ':');
    }

    async put(key: string, body: ArrayBuffer, options: PutOptions): Promise<void> {
        const formData = new FormData();
        const filename = key.split('/').pop() || key;
        const folder = key.includes('/') ? '/' + key.split('/').slice(0, -1).join('/') : '/';
        formData.append('file', new Blob([body], { type: options.contentType }), filename);
        formData.append('fileName', filename);
        formData.append('folder', folder);
        formData.append('useUniqueFileName', 'false');

        const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: { Authorization: this.authHeader },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json() as { message?: string };
            throw new Error(`ImageKit upload failed: ${err.message || res.statusText}`);
        }
    }

    async get(key: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
        if (!this.proxyMode) return null;
        try {
            const url = `${this.urlEndpoint}/${encodeURI(key)}`;
            const res = await fetch(url);
            if (!res.ok) return null;
            return {
                body: await res.arrayBuffer(),
                contentType: res.headers.get('content-type') || 'application/octet-stream',
            };
        } catch {
            return null;
        }
    }

    async list(prefix: string, _cursor?: string, _options?: { action?: string | null }): Promise<ListResult> {
        const folder = prefix ? `/${prefix.replace(/\/$/, '')}` : '/';
        const urlOptions = `?path=${folder}&includeFolder=true&skip=0&limit=100`;
        const url = `https://api.imagekit.io/v1/files${urlOptions}`;

        const res = await fetch(url, {
            headers: { Authorization: this.authHeader },
        });

        if (!res.ok) {
            const err = await res.json() as { message?: string };
            throw new Error(`ImageKit list failed: ${err.message || res.statusText}`);
        }

        const files = await res.json() as Array<{
            name: string;
            filePath?: string;
            folderPath?: string;
            size?: number;
            updatedAt: string;
            type: 'file' | 'folder';
        }>;

        const objects = files
            .filter((f) => f.type === 'file' && f.filePath)
            .map((f) => ({
                key: f.filePath!.replace(/^\//, ''),
                size: f.size || 0,
                uploaded: f.updatedAt,
            }));

        const folders = files
            .filter((f) => f.type === 'folder' && f.folderPath)
            .map((f) => f.folderPath!.replace(/^\//, '') + '/');

        return { objects, folders, truncated: false };
    }

    async delete(keys: string[]): Promise<void> {
        const fileKeys = keys.filter(k => !k.endsWith('/'));
        const folderKeys = keys.filter(k => k.endsWith('/'));

        for (const fKey of folderKeys) {
            const folderPath = '/' + fKey.replace(/\/$/, '');
            const res = await fetch('https://api.imagekit.io/v1/folder', {
                method: 'DELETE',
                headers: {
                    Authorization: this.authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ folderPath }),
            });
            if (!res.ok) {
                const err = await res.json() as { message?: string };
                console.warn(`ImageKit folder delete failed for ${folderPath}: ${err.message || res.statusText}`);
            }
        }

        if (fileKeys.length > 0) {
            const fileIds = await Promise.all(fileKeys.map((key) => this.getFileId(key)));
            const validIds = fileIds.filter(Boolean) as string[];
            if (validIds.length === 0) return;

            const res = await fetch('https://api.imagekit.io/v1/files/batch/deleteByFileIds', {
                method: 'POST',
                headers: {
                    Authorization: this.authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileIds: validIds }),
            });

            if (!res.ok) {
                const err = await res.json() as { message?: string };
                throw new Error(`ImageKit delete failed: ${err.message || res.statusText}`);
            }
        }
    }

    private async getFileId(key: string): Promise<string | null> {
        const filePath = '/' + key;
        const name = key.split('/').pop() || '';
        if (!name) return null;

        const urlOptions = `?searchQuery=name="${name}"&limit=100`;
        const url = `https://api.imagekit.io/v1/files${urlOptions}`;

        const res = await fetch(url, {
            headers: { Authorization: this.authHeader },
        });
        if (!res.ok) return null;
        const files = await res.json() as Array<{ fileId: string, filePath: string }>;
        const file = files.find(f => f.filePath === filePath);
        return file?.fileId ?? null;
    }

    getPublicUrl(key: string, siteUrl: string): string {
        if (this.proxyMode) {
            const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
            return `${base}/images/${key}`;
        }
        return `${this.urlEndpoint}/${key}`;
    }
}
