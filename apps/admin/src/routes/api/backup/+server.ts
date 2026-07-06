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

// Whitelist of keys that are strictly related to "Design" for sharing purposes
const DESIGN_SETTING_KEYS = ['theme', 'header', 'footer', 'widget_shadow_global'];

// 디자인 내보내기 시 제외할 텍스트/콘텐츠 필드 (사용자별 고유 값)
const HEADER_TEXT_KEYS = ['loginLabel', 'profileLabel', 'menuItems'];
const FOOTER_TEXT_KEYS = ['copyright', 'socialLinks', 'navLinks'];

export const GET: RequestHandler = async ({ url, platform }) => {
    if (!platform?.env?.BLOG_DB || !platform?.env?.USER_DB) {
        return json({ error: 'Database bindings (BLOG_DB or USER_DB) not found' }, { status: 500 });
    }

    const { BLOG_DB, USER_DB } = platform.env;
    const section = url.searchParams.get('section') || 'design';

    try {
        let backupData: any = {
            timestamp: new Date().toISOString(),
            version: '3.0',
            backupType: section,
            data: {}
        };

        // Helper to fetch tables from USER_DB
        const fetchUserTable = async (tableName: string) => {
            try {
                const { results } = await USER_DB.prepare(`SELECT * FROM ${tableName}`).all();
                return results;
            } catch (e) {
                console.warn(`Could not fetch table ${tableName} from USER_DB`, e);
                return [];
            }
        };

        if (section === 'full' || section === 'content') {
            const [posts, categories] = await Promise.all([
                BLOG_DB.prepare('SELECT * FROM posts').all(),
                BLOG_DB.prepare('SELECT * FROM categories').all()
            ]);
            
            const [entries, deleted_entries, post_views, post_likes, user, account] = await Promise.all([
                fetchUserTable('entries'),
                fetchUserTable('deleted_entries'),
                fetchUserTable('post_views'),
                fetchUserTable('post_likes'),
                fetchUserTable('user'),
                fetchUserTable('account')
            ]);

            backupData.data.posts = posts.results;
            backupData.data.categories = categories.results;
            backupData.data.entries = entries;
            backupData.data.deleted_entries = deleted_entries;
            backupData.data.post_views = post_views;
            backupData.data.post_likes = post_likes;
            backupData.data.user = user;
            backupData.data.account = account;
        }

        if (section === 'full' || section === 'design') {
            const [blogSettings, layouts, widgets, layoutWidgets, languages] = await Promise.all([
                BLOG_DB.prepare('SELECT * FROM blog_settings').all(),
                BLOG_DB.prepare('SELECT * FROM layouts').all(),
                BLOG_DB.prepare('SELECT * FROM widgets').all(),
                BLOG_DB.prepare('SELECT * FROM layout_widgets').all(),
                BLOG_DB.prepare('SELECT * FROM languages').all()
            ]);

            let filteredSettings = blogSettings.results;

            if (section === 'design') {
                // Use Whitelist approach for maximum security and purity in design sharing
                // + 텍스트 필드 제거 (디자인만 공유)
                filteredSettings = blogSettings.results
                    .filter((s: any) => DESIGN_SETTING_KEYS.includes(s.key))
                    .map((s: any) => {
                        if (s.key === 'header' || s.key === 'footer') {
                            try {
                                const parsed = JSON.parse(s.value);
                                const textKeys = s.key === 'header' ? HEADER_TEXT_KEYS : FOOTER_TEXT_KEYS;
                                for (const key of textKeys) {
                                    delete parsed[key];
                                }
                                return { ...s, value: JSON.stringify(parsed) };
                            } catch {
                                return s;
                            }
                        }
                        return s;
                    });
            }

            backupData.data.blog_settings = filteredSettings;
            backupData.data.layouts = layouts.results;
            backupData.data.widgets = widgets.results;
            backupData.data.layout_widgets = layoutWidgets.results;
            backupData.data.languages = languages.results;
        }

        return json(backupData);
    } catch (e: any) {
        console.error('Backup failed:', e);
        return json({ error: 'Backup failed', details: e.message }, { status: 500 });
    }
};
