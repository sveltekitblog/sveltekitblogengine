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

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    const db = locals.blogDb;
    let ui_dictionary = {};
    let languages: any[] = [];
    let dbDefaultLang = 'ko';
    
    if (db) {
        try {
            // Fetch the UI dictionary to inject globally into all admin routes via page.data
            const { results } = await db.prepare("SELECT value FROM blog_settings WHERE key = 'ui_dictionary'").all();
            if (results && results.length > 0 && results[0].value) {
                ui_dictionary = JSON.parse(results[0].value as string);
            }

            // Fetch languages globally
            const { results: langResults } = await db.prepare("SELECT * FROM languages ORDER BY sort_order ASC, code ASC").all();
            if (langResults) {
                languages = langResults as any[];
                dbDefaultLang = languages.find((l: any) => l.is_default === 1)?.code || languages[0]?.code || 'ko';
            }
        } catch(e) {
            console.error('Failed to load ui_dictionary/languages in global layout:', e);
        }
    }
    
    return {
        ui_dictionary,
        languages,
        dbDefaultLang,
        i18n: {
            lang: dbDefaultLang,
            dbDefaultLang,
            dictionary: ui_dictionary
        }
    };

};
