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

import type { ThemeVariant, ThemeConfig, Post } from '$lib/types';

// Fallback for D1 Types if not globally available
type D1DatabaseFallback = {
    prepare: (query: string) => any;
    batch: (queries: any[]) => Promise<any>;
};

export class AdminDB {
    constructor(private db: D1DatabaseFallback) { }

    // Theme Operations
    async getThemes(): Promise<ThemeVariant[]> {
        const { results } = await this.db.prepare('SELECT * FROM theme_variants ORDER BY created_at DESC').all();
        return (results as any[]).map(r => ({
            ...r,
            config: JSON.parse(r.config as string),
            is_system: Boolean(r.is_system)
        })) as ThemeVariant[];
    }

    async getTheme(id: string): Promise<ThemeVariant | null> {
        const result = await this.db.prepare('SELECT * FROM theme_variants WHERE id = ?').bind(id).first();
        if (!result) return null;
        return {
            ...result,
            config: JSON.parse(result.config as string),
            is_system: Boolean(result.is_system)
        } as ThemeVariant;
    }

    async saveTheme(theme: ThemeVariant): Promise<void> {
        await this.db.prepare(`
            INSERT INTO theme_variants (id, name, description, is_system, config, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                config = excluded.config,
                updated_at = datetime('now')
        `).bind(
            theme.id,
            theme.name,
            theme.description || null,
            theme.is_system ? 1 : 0,
            JSON.stringify(theme.config)
        ).run();
    }

    async deleteTheme(id: string): Promise<void> {
        await this.db.prepare('DELETE FROM theme_variants WHERE id = ? AND is_system = 0').bind(id).run();
    }

    // Category Operations
    async getCategories(): Promise<any[]> {
        const { results } = await this.db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        return results;
    }

    // Helper for safe JSON parsing
    private safeParseTags(tags: any): string[] {
        if (!tags) return [];
        try {
            const parsed = typeof tags === 'string' ? JSON.parse(tags) : tags;
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse tags:', tags, e);
            return [];
        }
    }

    // Post Operations
    async getPosts(): Promise<Post[]> {
        const { results } = await this.db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
        return (results as any[]).map(r => ({
            ...r,
            tags: this.safeParseTags(r.tags)
        })) as Post[];
    }

    async getPost(id: string): Promise<Post | null> {
        const result = await this.db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
        if (!result) return null;
        return {
            ...result,
            tags: this.safeParseTags(result.tags)
        } as Post;
    }

    async savePost(post: Post): Promise<void> {
        // Prepare tags
        const tagsJson = JSON.stringify(Array.isArray(post.tags) ? post.tags : []);

        await this.db.prepare(`
            INSERT INTO posts (id, title, slug, content, excerpt, type, status, author_id, category_slug, featured_image, tags, created_at, updated_at, published_at, content_type, content_markdown, thumbnail_fit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                slug = excluded.slug,
                content = excluded.content,
                excerpt = excluded.excerpt,
                type = excluded.type,
                status = excluded.status,
                category_slug = excluded.category_slug,
                author_id = excluded.author_id,
                featured_image = excluded.featured_image,
                tags = excluded.tags,
                updated_at = excluded.updated_at,
                published_at = COALESCE(excluded.published_at, published_at),
                content_type = excluded.content_type,
                content_markdown = excluded.content_markdown,
                thumbnail_fit = excluded.thumbnail_fit
        `).bind(
            post.id,
            post.title,
            post.slug,
            post.content,
            post.excerpt || null,
            post.type || 'post',
            post.status,
            post.author_id,
            post.category_slug || null,
            post.featured_image || null,
            tagsJson,
            post.created_at || new Date().toISOString(),
            post.published_at || null,
            post.content_type || 'html',
            post.content_markdown || null,
            post.thumbnail_fit || 'cover'
        ).run();
    }

    async deletePost(id: string): Promise<void> {
        await this.db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    }
}
