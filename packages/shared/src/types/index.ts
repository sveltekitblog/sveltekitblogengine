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
 * Shared type definitions used by both blog and admin apps.
 */

export interface BlogSettings {
    [key: string]: any;
}

export interface Post {
    id: string;
    title: string;
    slug: string;
    content?: string;
    excerpt?: string;
    status: string;
    categorySlug?: string;
    categoryName?: string;
    featuredImage?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    displayDate?: string;
    view_count?: number;
    like_count?: number;
    lang?: string;
    translationGroupId?: string;
    translations?: Array<{lang: string, slug: string}>;
    contentType?: 'html' | 'markdown';
    contentMarkdown?: string;
    thumbnailFit?: 'cover' | 'contain';
}
