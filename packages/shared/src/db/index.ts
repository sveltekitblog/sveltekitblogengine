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

import { drizzle } from 'drizzle-orm/d1';
import * as user_schema from './user-schema';
import * as blog_schema from './blog-schema';

// USER_DB용 Drizzle 인스턴스 (인증, 댓글, 방명록)
export const userDb = (D1: D1Database) => drizzle(D1, { schema: user_schema });

// BLOG_DB용 Drizzle 인스턴스 (포스트, 카테고리, 테마)
export const blogDb = (D1: D1Database) => drizzle(D1, { schema: blog_schema });

export { user_schema, blog_schema };
