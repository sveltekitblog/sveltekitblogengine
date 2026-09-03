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
import { fallbackDictionary as defaultDictionary } from '@blog/shared/i18n';

export const load: PageServerLoad = async ({ locals, url }) => {
    const db = locals.blogDb;
    if (!db) throw error(500, 'Database not found');

    try {
        const [{ results: languages }, { results: categories }, { results: dictQuery }] = await Promise.all([
            db.prepare('SELECT * FROM languages ORDER BY sort_order ASC, code ASC').all(),
            db.prepare('SELECT * FROM categories ORDER BY slug ASC, lang ASC').all(),
            db.prepare("SELECT value FROM blog_settings WHERE key = 'ui_dictionary'").all()
        ]);
        
        let ui_dictionary: Record<string, Record<string, string>> = {};
        let needsDbSync = false;

        if (dictQuery && dictQuery.length > 0 && dictQuery[0].value) {
            try { ui_dictionary = JSON.parse(dictQuery[0].value as string); } catch(e) {}
        }

        // Cleanup deprecated legacy keys
        for (const key of Object.keys(ui_dictionary)) {
            if (key.startsWith('admin.menu.')) {
                delete ui_dictionary[key];
                needsDbSync = true;
            }
        }

        // Define our fallback/default dictionary keys to ensure completeness
        // defaultDictionary is imported from $lib/i18n/dictionary at the top of the file

        const forceSync = url.searchParams.get('force_sync') === 'true';

        // Merge logic: check if there is any missing key in DB, and if so, append it and sync DB.
        for (const [key, translations] of Object.entries(defaultDictionary)) {
            if (!ui_dictionary[key]) {
                ui_dictionary[key] = translations;
                needsDbSync = true;
            } else {
                if (forceSync) {
                    if (JSON.stringify(ui_dictionary[key]) !== JSON.stringify(translations)) {
                        ui_dictionary[key] = translations;
                        needsDbSync = true;
                    }
                } else {
                    // Check missing languages inside existing key
                    for (const [langTag, textStr] of Object.entries(translations)) {
                        if (!ui_dictionary[key][langTag]) {
                            ui_dictionary[key][langTag] = textStr;
                            needsDbSync = true;
                        }
                    }
                }
            }
        }

        if (needsDbSync) {
            await db.prepare(`
                INSERT INTO blog_settings (key, value, updated_at) 
                VALUES (?, ?, ?) 
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            `).bind('ui_dictionary', JSON.stringify(ui_dictionary), new Date().toISOString()).run();
        }

        return {
            languages: languages || [],
            categories: categories || [],
            ui_dictionary
        };
    } catch (err) {
        throw error(500, 'Failed to load languages and categories');
    }
};

export const actions: Actions = {
    save: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });
        
        const data = await request.formData();
        const action = data.get('action'); // add, delete, update

        try {
            if (action === 'add') {
                const code = data.get('code') as string;
                const name = data.get('name') as string;
                const fallback_message = data.get('fallback_message') as string;
                const is_default = data.get('is_default') === 'true' ? 1 : 0;
                
                if (is_default) {
                    await db.prepare('UPDATE languages SET is_default = 0').run();
                }
                
                await db.prepare(`
                    INSERT INTO languages (code, name, is_default, sort_order, fallback_message)
                    VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM languages), ?)
                `).bind(code, name, is_default, fallback_message).run();
                
            } else if (action === 'update') {
                const code = data.get('code') as string;
                const name = data.get('name') as string;
                const fallback_message = data.get('fallback_message') as string;
                const is_default = data.get('is_default') === 'true' ? 1 : 0;
                
                if (is_default) {
                    await db.prepare('UPDATE languages SET is_default = 0').run();
                }
                
                // Allow setting is_default only if checked (ignoring unchecked to prevent no-default state easily, but could force one)
                if (is_default) {
                    await db.prepare(`
                        UPDATE languages SET name = ?, fallback_message = ?, is_default = 1 WHERE code = ?
                    `).bind(name, fallback_message, code).run();
                } else {
                    await db.prepare(`
                        UPDATE languages SET name = ?, fallback_message = ? WHERE code = ?
                    `).bind(name, fallback_message, code).run();
                }
                
            } else if (action === 'delete') {
                const code = data.get('code') as string;
                await db.prepare('DELETE FROM languages WHERE code = ? AND is_default = 0').bind(code).run();
            }

            return { success: true };
        } catch (err: any) {
            return fail(500, { error: err.message || 'Operation failed' });
        }
    },
    saveDictionary: async ({ request, locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });
        
        try {
            const data = await request.formData();
            const ui_dictionary_str = data.get('ui_dictionary') as string;
            if (!ui_dictionary_str) return fail(400, { error: 'No dictionary provided' });
            
            // Validate JSON
            JSON.parse(ui_dictionary_str);

            await db.prepare(`
                INSERT INTO blog_settings (key, value, updated_at) 
                VALUES (?, ?, ?) 
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            `).bind('ui_dictionary', ui_dictionary_str, new Date().toISOString()).run();

            return { success: true };
        } catch (err: any) {
            return fail(500, { error: err.message || 'Failed to save dictionary' });
        }
    },
    forceSync: async ({ locals }) => {
        const db = locals.blogDb;
        if (!db) return fail(500, { error: 'Database not found' });

        try {
            const { results } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'ui_dictionary'").all() as any;
            let ui_dictionary: Record<string, Record<string, string>> = {};

            if (results && results.length > 0 && results[0].value) {
                try {
                    ui_dictionary = JSON.parse(results[0].value as string);
                } catch (e) {}
            }

            // Force override D1 dictionary with the latest fallbackDictionary
            for (const [key, translations] of Object.entries(defaultDictionary)) {
                ui_dictionary[key] = translations;
            }

            await db.prepare(`
                INSERT INTO blog_settings (key, value, updated_at) 
                VALUES (?, ?, ?) 
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            `).bind('ui_dictionary', JSON.stringify(ui_dictionary), new Date().toISOString()).run();

            return { success: true };
        } catch (err: any) {
            return fail(500, { error: err.message || 'Force Sync failed' });
        }
    }
};
