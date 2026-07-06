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

import { page } from '$app/stores';
import { derived } from 'svelte/store';
import { createTranslator, type TranslationKey } from '@blog/shared/i18n';

export const t = derived(page, ($page) => {
    const i18nData = $page.data.i18n || {};
    const dictionary = i18nData.dictionary || $page.data.settings?.ui_dictionary || {};
    const dbDefaultLang = i18nData.dbDefaultLang || $page.data.dbDefaultLang || 'ko';
    
    // URL 기반 다국어 지원: $page.params.lang을 우선으로 하고, 없을 경우 i18nData.lang 적용
    const activeLang = $page.params.lang || i18nData.lang || dbDefaultLang;
    
    const fallbackMsg = i18nData.fallbackMsg || $page.data.langData?.fallback_message;

    return (key: TranslationKey | string, vars?: Record<string, string>) => {
        const translate = createTranslator(activeLang, dbDefaultLang, dictionary, fallbackMsg);
        return translate(key, vars);
    };
});

