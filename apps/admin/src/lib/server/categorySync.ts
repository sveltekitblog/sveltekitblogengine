/**
 * Copyright (C) 2026 SvelteKit Blog Engine
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
 * Synchronizes post_count in the categories table based on actual published posts.
 * Runs atomically in a single statement using idx_posts_cat_lang_status.
 */
export async function syncCategoryPostCounts(db: any): Promise<void> {
    try {
        await db.prepare(`
            UPDATE categories 
            SET post_count = (
                SELECT COUNT(*) 
                FROM posts 
                WHERE posts.category_slug = categories.slug 
                  AND posts.lang = categories.lang 
                  AND posts.status = 'published' 
                  AND posts.type = 'post'
            )
        `).run();
    } catch (err) {
        console.warn('[CategorySync] Failed to sync category post counts:', err);
    }
}
