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

import { fallbackDictionary } from './index';

export type TranslationKey = keyof typeof fallbackDictionary;

export interface TranslatorOptions {
    default?: string;
    [key: string]: string | undefined;
}

/**
 * 표준화된 다국어 번역 함수를 생성하는 팩토리 함수입니다.
 * 
 * @param activeLang 현재 활성화된 언어 코드 (예: 'ko', 'en')
 * @param dbDefaultLang 시스템 기본 언어 코드 (예: 'ko')
 * @param dbDictionary DB에서 가져온 사용자 사전 오버라이드 객체
 * @param fallbackMsg 번역이 없을 때 적용할 전역 안내 메시지 (주로 블로그 글 미번역 안내용)
 */
export function createTranslator(
    activeLang: string,
    dbDefaultLang: string,
    dbDictionary: Record<string, any> = {},
    fallbackMsg?: string
) {
    return (key: string, variables?: TranslatorOptions) => {
        if (!key) return '';
        const normalizedKey = key.trim();

        // 1순위: DB 사전, 2순위: 로컬 고정 fallbackDictionary
        const matchedNode = dbDictionary[normalizedKey] || fallbackDictionary[normalizedKey as TranslationKey];

        let text = normalizedKey;

        if (matchedNode) {
            if (typeof matchedNode === 'object' && matchedNode !== null) {
                text = matchedNode[activeLang] || matchedNode[dbDefaultLang] || Object.values(matchedNode)[0] || normalizedKey;
            } else if (typeof matchedNode === 'string') {
                if (matchedNode.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(matchedNode);
                        text = parsed[activeLang] || parsed[dbDefaultLang] || Object.values(parsed)[0] || matchedNode;
                    } catch (e) {
                        text = matchedNode;
                    }
                } else {
                    text = matchedNode;
                }
            }
        } else {
            // 번역이 누락된 경우
            // 만약 현재 언어가 기본 언어가 아니고, 블로그 관련 키('blog.')이면서 fallbackMsg가 정의되어 있으면 적용
            if (activeLang !== dbDefaultLang && fallbackMsg && normalizedKey.startsWith('blog.')) {
                text = fallbackMsg;
            } else {
                text = variables?.default || normalizedKey;
            }
        }

        // 변수 치환 로직 (싱글 {variable} 및 더블 {{variable}} 지원)
        if (variables) {
            Object.entries(variables).forEach(([k, v]) => {
                if (k !== 'default' && v !== undefined) {
                    text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
                    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
                }
            });
        }

        return text;
    };
}
