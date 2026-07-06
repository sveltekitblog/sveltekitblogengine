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
 * Storage Adapter Types & Interfaces
 * Shared across blog and admin apps
 */

export interface StorageObject {
    key: string;
    size: number;
    uploaded: string;
}

export interface ListResult {
    objects: StorageObject[];
    folders: string[];
    truncated: boolean;
    cursor?: string;
    disabled?: boolean;
    disabledReason?: string;
}

export interface PutOptions {
    contentType: string;
}

export interface StorageAdapter {
    /** Upload a file */
    put(key: string, body: ArrayBuffer, options: PutOptions): Promise<void>;
    /** Get a file for serving */
    get(key: string): Promise<{ body: ReadableStream | ArrayBuffer; contentType: string } | null>;
    /** List files/folders under a prefix */
    list(prefix: string, cursor?: string, options?: { action?: string | null }): Promise<ListResult>;
    /** Delete one or more files by key */
    delete(keys: string[]): Promise<void>;
    /** Get the public URL for a given key (used after upload) */
    getPublicUrl(key: string, siteUrl: string): string;
}

/**
 * Bindings required by the storage factory.
 * Decoupled from App.Platform so it can be used by any app.
 */
export interface StorageBindings {
    IMAGES?: any;      // R2Bucket
    IMAGES_KV?: any;   // KVNamespace
    BLOG_DB?: any;     // D1Database (for reading storage_type setting)
}
