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

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { purgeEverything } from '@blog/shared';

const SITE_INFO_KEYS = ['site_title', 'description', 'siteUrl', 'authorName', 'admin_user_id'];

// 디자인 복원 시 기존 값을 보존할 텍스트/콘텐츠 필드
const HEADER_TEXT_KEYS = ['loginLabel', 'profileLabel', 'menuItems'];
const FOOTER_TEXT_KEYS = ['copyright', 'socialLinks', 'navLinks'];

export const POST: RequestHandler = async ({ request, platform }) => {
    if (!platform?.env?.BLOG_DB || !platform?.env?.USER_DB) {
        return json({ error: 'Database bindings (BLOG_DB or USER_DB) not found' }, { status: 500 });
    }

    const { BLOG_DB, USER_DB } = platform.env;

    try {
        const body = await request.json();
        
        // 0. Deep Search for Actual Data and Backup Type
        // We look for an object that contains known table keys
        function findCoreData(obj: any): any {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
            // If it has any of our primary table keys, it's likely the core data object
            if (obj.posts || obj.blog_settings || obj.layouts || obj.widgets || obj.user || obj.entries) {
                return obj;
            }
            // If it has a 'data' property, search inside it
            if (obj.data) return findCoreData(obj.data);
            return null;
        }

        // Search for backupType throughout the structure
        function findBackupType(obj: any): string | null {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
            if (obj.backupType) return obj.backupType;
            if (obj.data) return findBackupType(obj.data);
            return null;
        }

        const backupType = body.backupType || findBackupType(body) || 'design';
        const data = findCoreData(body);

        if (!data) {
            console.error('Restore Error: Could not find core data in payload', { 
                bodyKeys: Object.keys(body),
                backupType 
            });
            return json({ error: 'Invalid backup file format (Core data not found)' }, { status: 400 });
        }

        // 1. Data Integrity Check (Safety Guard)
        if (backupType === 'content') {
            if (!data.posts || !data.categories) {
                console.error('Restore Error: Missing posts or categories in content backup', { 
                    hasPosts: !!data.posts, 
                    hasCategories: !!data.categories,
                    keys: Object.keys(data)
                });
                return json({ error: 'Invalid content backup: Missing posts or categories' }, { status: 400 });
            }
        } else if (backupType === 'design') {
            if (!data.blog_settings || !data.layouts || !data.widgets) {
                console.error('Restore Error: Missing design components', {
                    hasSettings: !!data.blog_settings,
                    hasLayouts: !!data.layouts,
                    hasWidgets: !!data.widgets
                });
                return json({ error: 'Invalid design backup: Missing settings, layouts, or widgets' }, { status: 400 });
            }
        } else if (backupType === 'full') {
            if (!data.posts || !data.blog_settings || !data.user) {
                console.error('Restore Error: Missing core system data in full backup');
                return json({ error: 'Invalid full system backup: Missing core system data' }, { status: 400 });
            }
        }

        const blogDeleteStatements: any[] = [];
        const blogInsertStatements: any[] = [];
        const userDeleteStatements: any[] = [];
        const userInsertStatements: any[] = [];

        // Helper to generate insert statements
        const addInsertStatements = (dbInstance: any, statementsArray: any[], tableName: string, items: any[]) => {
            if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                    const keys = Object.keys(item).join(', ');
                    const placeholders = Object.keys(item).map(() => '?').join(', ');
                    statementsArray.push(
                        dbInstance.prepare(`INSERT OR REPLACE INTO ${tableName} (${keys}) VALUES (${placeholders})`)
                            .bind(...Object.values(item))
                    );
                }
            }
        };

        // --- Phase 1: Prepare BLOG_DB Statements ---
        if (backupType === 'content' || backupType === 'full') {
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM posts'));
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM categories'));
            
            // Backward compatibility fallback for older backups
            if (data.posts && Array.isArray(data.posts)) {
                for (const post of data.posts) {
                    if (post.content_type === undefined) {
                        post.content_type = 'html';
                    }
                    if (post.content_markdown === undefined) {
                        post.content_markdown = null;
                    }
                    if (post.thumbnail_fit === undefined) {
                        post.thumbnail_fit = 'cover';
                    }
                }
            }

            addInsertStatements(BLOG_DB, blogInsertStatements, 'posts', data.posts);
            addInsertStatements(BLOG_DB, blogInsertStatements, 'categories', data.categories);
        }

        // Design restore: 기존 텍스트 필드 보존을 위해 현재 header/footer 읽기
        if (backupType === 'design' && data.blog_settings) {
            const [currentHeader, currentFooter] = await Promise.all([
                BLOG_DB.prepare("SELECT value FROM blog_settings WHERE key = 'header'").first<{value: string}>(),
                BLOG_DB.prepare("SELECT value FROM blog_settings WHERE key = 'footer'").first<{value: string}>()
            ]);

            for (const setting of data.blog_settings) {
                if (setting.key === 'header' && currentHeader?.value) {
                    try {
                        const current = JSON.parse(currentHeader.value);
                        const incoming = JSON.parse(setting.value);
                        for (const key of HEADER_TEXT_KEYS) {
                            if (current[key] !== undefined) incoming[key] = current[key];
                        }
                        setting.value = JSON.stringify(incoming);
                    } catch { /* use incoming as-is */ }
                }
                if (setting.key === 'footer' && currentFooter?.value) {
                    try {
                        const current = JSON.parse(currentFooter.value);
                        const incoming = JSON.parse(setting.value);
                        for (const key of FOOTER_TEXT_KEYS) {
                            if (current[key] !== undefined) incoming[key] = current[key];
                        }
                        setting.value = JSON.stringify(incoming);
                    } catch { /* use incoming as-is */ }
                }
            }
        }

        if (backupType === 'design' || backupType === 'full') {
            if (backupType === 'design') {
                blogDeleteStatements.push(
                    BLOG_DB.prepare(`DELETE FROM blog_settings WHERE key NOT IN (${SITE_INFO_KEYS.map(() => '?').join(',')})`)
                        .bind(...SITE_INFO_KEYS)
                );
            } else {
                blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM blog_settings'));
            }

            // Order matters for DELETE: Children first
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM layout_widgets'));
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM layouts'));
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM widgets'));
            blogDeleteStatements.push(BLOG_DB.prepare('DELETE FROM languages'));

            // Order matters for INSERT: Parents first
            addInsertStatements(BLOG_DB, blogInsertStatements, 'blog_settings', data.blog_settings);
            addInsertStatements(BLOG_DB, blogInsertStatements, 'layouts', data.layouts);
            addInsertStatements(BLOG_DB, blogInsertStatements, 'widgets', data.widgets);
            addInsertStatements(BLOG_DB, blogInsertStatements, 'layout_widgets', data.layout_widgets);
            addInsertStatements(BLOG_DB, blogInsertStatements, 'languages', data.languages);
        }

        // --- Phase 2: Prepare USER_DB Statements ---
        if (backupType === 'content' || backupType === 'full') {
            const tables = ['entries', 'deleted_entries', 'post_views', 'post_likes', 'user', 'account'];
            
            // Delete order: account first (child of user)
            const deleteOrder = ['account', 'entries', 'deleted_entries', 'post_views', 'post_likes', 'user'];
            for (const table of deleteOrder) {
                if (data[table] || backupType === 'full') {
                    userDeleteStatements.push(USER_DB.prepare(`DELETE FROM ${table}`));
                }
            }

            // Insert order: user first (parent of account)
            const insertOrder = ['user', 'account', 'entries', 'deleted_entries', 'post_views', 'post_likes'];
            for (const table of insertOrder) {
                if (data[table]) {
                    addInsertStatements(USER_DB, userInsertStatements, table, data[table]);
                }
            }
        }

        // --- Phase 3: Execute in correct order (Deletes then Inserts) ---
        if (blogDeleteStatements.length > 0 || blogInsertStatements.length > 0) {
            await BLOG_DB.batch([...blogDeleteStatements, ...blogInsertStatements]);
        }
        if (userDeleteStatements.length > 0 || userInsertStatements.length > 0) {
            await USER_DB.batch([...userDeleteStatements, ...userInsertStatements]);
        }

        // 복원 완료 시 Cloudflare 캐시 전체 퍼지 비동기 기동 (s-maxage=86400 장기 캐시 무력화)
        if (platform?.env?.CLOUDFLARE_ZONE_ID && platform?.env?.CLOUDFLARE_API_TOKEN) {
            const purgePromise = purgeEverything(
                platform.env.CLOUDFLARE_ZONE_ID,
                platform.env.CLOUDFLARE_API_TOKEN
            ).catch(err => console.error('  ❌ Purge everything async error:', err));

            if (platform.context?.waitUntil) {
                platform.context.waitUntil(purgePromise);
            }
        }

        return json({ success: true, message: `Restore completed successfully (type: ${backupType})` });

    } catch (e: any) {
        console.error('Restore failed:', e);
        return json({ error: 'Restore failed', details: e.message }, { status: 500 });
    }
};
