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
import { get } from 'svelte/store';
import { createTranslator, type TranslationKey } from '@blog/shared/i18n';

// Svelte 5용 전역 상태 선언
let _adminLang = $state('');

// 브라우저 환경에서 저장된 언어 설정 불러오기
if (typeof window !== 'undefined') {
    _adminLang = localStorage.getItem('admin_lang') || '';
}

/**
 * 전역 언어 상태 객체
 * 컴포넌트에서 adminLang.value로 접근하고 바인딩할 수 있습니다.
 */
export const adminLang = {
    get value() { 
        // 1순위: Svelte 5 반응성 전역 상태 우선 반환 (반응성 의존성 유지를 위해 반드시 먼저 접근)
        if (_adminLang) return _adminLang;
        
        // 2순위: SvelteKit page data에서 DB 기본 언어 설정을 읽어 로드
        try {
            const pageValue = get(page);
            const dbDefault = pageValue?.data?.i18n?.dbDefaultLang || pageValue?.data?.dbDefaultLang;
            if (dbDefault) return dbDefault;
            const languages = pageValue?.data?.languages || [];
            const dbDefaultFallback = languages.find((l: any) => l.is_default === 1)?.code;
            if (dbDefaultFallback) {
                return dbDefaultFallback;
            }
        } catch (e) {}

        return 'ko'; 
    },
    set value(v: string) {
        _adminLang = v;
        if (typeof window !== 'undefined') {
            localStorage.setItem('admin_lang', v);
        }
    }
};

/**
 * Svelte 5용 반응형 번역 함수
 * 컴포넌트 템플릿에서 t('key') 형태로 직접 사용하며, adminLang.value가 바뀌면 자동으로 갱신됩니다.
 */
export const t = (key: TranslationKey | string, variables?: Record<string, string>) => {
    // SvelteKit의 page 스토어 구독
    const pageValue = get(page);
    const i18nData = pageValue?.data?.i18n || {};
    const dictionary = i18nData.dictionary || pageValue?.data?.ui_dictionary || {};
    const dbDefaultLang = i18nData.dbDefaultLang || pageValue?.data?.dbDefaultLang || 'ko';

    // adminLang.value (Rune) 참조로 인해 이 함수는 반응성을 가집니다.
    const activeLang = adminLang.value;

    const translate = createTranslator(activeLang, dbDefaultLang, dictionary);
    return translate(key, variables);
};

