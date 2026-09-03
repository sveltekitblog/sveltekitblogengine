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

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import type { BlogDB } from '$lib/server/db';

declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            user: import("better-auth").User | null;
            session: import("better-auth").Session | null;
            db: BlogDB;
            userDb?: import("drizzle-orm/d1").DrizzleD1Database<any>;
            lang: string;
            dbDefaultLang: string;
            langData: { code: string; name: string; is_default: number; fallback_message: string; };
            languages: { code: string; name: string; is_default: number; fallback_message: string; }[];
            enabledProviders: string[];
            enableEmailLogin: boolean;
        }
        // interface PageData {}
        // interface PageState {}
        interface Platform {
            env: {
                USER_DB: D1Database;
                BLOG_DB: D1Database;
                CACHE: KVNamespace;
                IMAGES: R2Bucket;
            };
        }
    }
}

export { };
