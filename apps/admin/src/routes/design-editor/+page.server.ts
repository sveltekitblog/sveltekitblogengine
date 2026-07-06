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

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    try {
        const { results: settings } = await db.prepare('SELECT * FROM blog_settings').all();
        const settingsMap = settings.reduce((acc: any, curr: any) => {
            try {
                acc[curr.key] = JSON.parse(curr.value);
            } catch {
                acc[curr.key] = curr.value;
            }
            return acc;
        }, {});

        const { results: layouts } = await db.prepare('SELECT * FROM layouts').all();
        const { results: widgets } = await db.prepare('SELECT * FROM widgets').all();
        const { results: languages } = await db.prepare('SELECT * FROM languages ORDER BY sort_order ASC, code ASC').all();
        const { results: categories } = await db.prepare(`
            SELECT c.slug, c.name, c.lang, COUNT(p.id) as postCount
            FROM categories c
            LEFT JOIN posts p ON c.slug = p.category_slug AND c.lang = p.lang AND p.status = 'published' AND p.type = 'post'
            GROUP BY c.slug, c.lang
        `).all();

        // Active layout and its widgets
        const activeLayout = layouts.find((l: any) => l.is_active === 1) || layouts[0];
        let layoutWidgets = [];
        if (activeLayout) {
            const { results } = await db.prepare(`
                SELECT lw.*, w.name as widget_name, w.type as widget_type, w.config as widget_config, lw.custom_title
                FROM layout_widgets lw
                JOIN widgets w ON lw.widget_id = w.id
                WHERE lw.layout_id = ?
                ORDER BY lw.column_index, lw.sort_order
            `).bind(activeLayout.id).all();

            // JSON parsing for configs
            layoutWidgets = results.map((w: any) => {
                try {
                    return { ...w, widget_config: JSON.parse(w.widget_config || '{}') };
                } catch {
                    return w;
                }
            });
        }

        return {
            settings: settingsMap,
            layouts,
            widgets,
            activeLayout,
            layoutWidgets,
            languages: languages || [],
            categories: categories || [],
            dbInfo: {
                isRemote: !!locals.blogDb && (locals.blogDb as any).id !== undefined,
                type: locals.blogDb ? 'Cloudflare D1' : 'None'
            }
        };
    } catch (err) {
        console.error('Failed to load theme editor data:', err);
        throw error(500, 'Failed to load theme editor data');
    }
};

export const actions: Actions = {
    updateSettings: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const key = data.get('key') as string;
        const value = data.get('value') as string;

        if (!key) return fail(400, { error: 'Key is required' });

        try {
            await db.prepare(`
                INSERT INTO blog_settings (key, value, updated_at)
                VALUES (?, ?, strftime('%s', 'now'))
                ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            `).bind(key, value).run();
            return { success: true };
        } catch (err) {
            console.error('Failed to update settings:', err);
            return fail(500, { error: 'Failed to update settings' });
        }
    },

    saveLayout: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const layoutId = data.get('id');
        const name = data.get('name') as string;
        const columnCount = parseInt(data.get('column_count') as string);
        const columnWidths = data.get('column_widths') as string;
        const is_active = data.get('is_active') === 'true' ? 1 : 0;
        const widgetsJson = data.get('widgets') as string;
        const mobileColumnCount = parseInt((data.get('mobile_column_count') as string) || '1');
        const mobileColumnWidths = (data.get('mobile_column_widths') as string) || '1fr';

        try {
            let id = layoutId;
            if (is_active) {
                await db.prepare('UPDATE layouts SET is_active = 0').run();
            }

            if (layoutId) {
                await db.prepare(`
                    UPDATE layouts SET name = ?, column_count = ?, column_widths = ?, is_active = ?, mobile_column_count = ?, mobile_column_widths = ?, updated_at = strftime('%s', 'now')
                    WHERE id = ?
                `).bind(name, columnCount, columnWidths, is_active, mobileColumnCount, mobileColumnWidths, layoutId).run();
            } else {
                const result = await db.prepare(`
                    INSERT INTO layouts (name, column_count, column_widths, is_active, mobile_column_count, mobile_column_widths)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(name, columnCount, columnWidths, is_active, mobileColumnCount, mobileColumnWidths).run();
                id = result.meta.last_row_id;
            }

            // Update widgets
            if (widgetsJson) {
                const widgetsList = JSON.parse(widgetsJson);
                await db.prepare('DELETE FROM layout_widgets WHERE layout_id = ?').bind(id).run();

                // D1은 batch 처리가 효율적입니다
                const batch = widgetsList.map((w: any) =>
                    db.prepare(`
                        INSERT INTO layout_widgets (layout_id, widget_id, column_index, sort_order, custom_title, device)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(id, w.widget_id, w.column_index, w.sort_order, typeof w.custom_title === 'object' ? JSON.stringify(w.custom_title) : (w.custom_title || null), w.device || 'desktop')
                );

                if (batch.length > 0) {
                    await db.batch(batch);
                }
            }

            return { success: true, id };
        } catch (err) {
            console.error('Failed to save layout:', err);
            return fail(500, { error: 'Failed to save layout' });
        }
    },

    createWidget: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const name = data.get('name') as string;
        const type = data.get('type') as string;
        const config = data.get('config') as string;

        try {
            const result = await db.prepare(`
                INSERT INTO widgets (name, type, config)
                VALUES (?, ?, ?)
            `).bind(name, type, config).run();
            return { success: true, id: result.meta.last_row_id };
        } catch (err) {
            console.error('Failed to create widget:', err);
            return fail(500, { error: 'Failed to create widget' });
        }
    },

    updateWidget: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const id = data.get('id') as string;
        const name = data.get('name') as string;
        const config = data.get('config') as string;

        try {
            await db.prepare('UPDATE widgets SET name = ?, config = ? WHERE id = ?')
                .bind(name, config, id).run();
            return { success: true };
        } catch (err) {
            console.error('Failed to update widget:', err);
            return fail(500, { error: 'Failed to update widget' });
        }
    },

    deleteWidget: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        const data = await request.formData();
        const id = data.get('id') as string;

        try {
            // D1 batch로 트랜잭션과 유사하게 처리
            await db.batch([
                db.prepare('DELETE FROM layout_widgets WHERE widget_id = ?').bind(id),
                db.prepare('DELETE FROM widgets WHERE id = ?').bind(id)
            ]);
            return { success: true };
        } catch (err) {
            console.error('Failed to delete widget:', err);
            return fail(500, { error: 'Failed to delete widget' });
        }
    }
};
