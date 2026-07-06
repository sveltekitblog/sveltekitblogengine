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
import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// Lucide 아이콘 원본 SVG 로딩 헬퍼 함수
function getLucideSvg(iconName: string): string {
    try {
        const normalized = iconName.trim().toLowerCase().replace(/\s+/g, '-');
        const svgPath = path.resolve('node_modules/lucide-static/icons', `${normalized}.svg`);
        if (fs.existsSync(svgPath)) {
            const svgContent = fs.readFileSync(svgPath, 'utf-8');
            // 외부 CSS 또는 Lucide 고유 크기 조절 속성 추가를 위해 root svg 태그에 class 바인딩
            return svgContent.replace('<svg', '<svg class="lucide-icon"');
        }
        return '';
    } catch (e) {
        return '';
    }
}

const DEFAULT_SETTINGS = {
    theme: {
        maxWidth: '1200px',
        cardBg: '#ffffff',
        text: '#1e293b'
    },
    header: {
        scrolledMaxWidth: '1200px'
    }
};

export const load: LayoutServerLoad = async ({ locals, request }) => {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    const db = locals.db;
    if (!db) return { user: locals.user, isMobile, navIconSvgs: {} };

    try {
        const [settings, activeLayout, categories] = await Promise.all([
            db.getSettings(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang),
            db.getActiveLayout(),
            db.getCategories(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang).catch((e: any) => { console.error('getCategories failed:', e); return []; }),
        ]);

        let layoutWidgets: any[] = [];
        let desktopWidgets: any[] = [];
        let mobileWidgets: any[] = [];
        let mobileLayout = { columnCount: 1, columnWidths: '1fr' };
        let allWidgets: any[] = [];
        
        if (activeLayout) {
            allWidgets = await db.getLayoutWidgets(activeLayout.id as number, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);
            layoutWidgets = allWidgets;
            desktopWidgets = allWidgets.filter((w: any) => w.device !== 'mobile');
            mobileWidgets = allWidgets.filter((w: any) => w.device !== 'desktop');
            mobileLayout = {
                columnCount: (activeLayout as any).mobileColumnCount || 1,
                columnWidths: (activeLayout as any).mobileColumnWidths || '1fr',
            };
        }

        const getLimitFor = (type: string): number | undefined => {
            const widget = allWidgets.find((w: any) => w.type === type);
            return widget?.config?.limit ? parseInt(widget.config.limit, 10) : undefined;
        };

        const [recentPosts, popularPosts, tags, recentEntries] = await Promise.all([
            db.getRecentPosts(getLimitFor("RecentPosts"), undefined, 1, undefined, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang),
            db.getPopularPosts(getLimitFor("PopularPosts"), locals.lang || locals.dbDefaultLang, locals.dbDefaultLang),
            db.getAllTags(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang),
            db.getRecentEntries(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang, getLimitFor("RecentComments"), getLimitFor("RecentGuestbooks")).catch((e: any) => {
                console.error('getRecentEntries failed:', e);
                return { comments: [], guestbooks: [] };
            })
        ]);

        // 안전한 파싱 헬퍼: DB에서 문자열로 가져온 JSON 데이터를 객체화
        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return val; }
            }
            return val;
        };

        if (settings) {
            settings.widget_shadow_global = safeParse(settings.widget_shadow_global);
            settings.theme = safeParse(settings.theme) || {};
            settings.header = safeParse(settings.header) || { menuItems: [] };
            settings.footer = safeParse(settings.footer) || { navLinks: [] };

            // [근본 아키텍처 개편] 설정 데이터 단일화 및 1회 정형화 (하드코딩 제거)
            settings.theme.maxWidth = settings.theme.maxWidth || settings.header.maxWidth || DEFAULT_SETTINGS.theme.maxWidth;
            settings.theme.cardBg = settings.theme.cardBg || settings.theme.surface || DEFAULT_SETTINGS.theme.cardBg;
            settings.theme.text = settings.theme.text || settings.theme.textColor || DEFAULT_SETTINGS.theme.text;

            if (!settings.header.scrolledMaxWidth || settings.header.scrolledMaxWidth === '960px') {
                settings.header.scrolledMaxWidth = settings.theme.maxWidth;
            }

            // 다국어 정적 HTML도 런타임 연쇄 조회를 피하기 위해 서버 단에서 1차 정제
            const langCode = locals.lang || locals.dbDefaultLang;
            settings.headerStaticHtml = settings[`header_static_html_${langCode}`] || settings.header_static_html_ko || "";
            settings.footerStaticHtml = settings[`footer_static_html_${langCode}`] || settings.footer_static_html_ko || "";
            
            // Optimize head_code if GA4 or AdSense scripts are included
            if (settings.head_code) {
                settings.head_code = optimizeHeadScripts(settings.head_code);
            }


            // 메뉴 아이콘의 SVG 문자열을 서버 단에서 로딩 및 바인딩
            const navIconSvgs: Record<string, string> = {};
            if (settings.header) {
                const items = [
                    ...(settings.header.menuItems || []),
                    ...(settings.header.mobile?.menuItems || [])
                ];
                items.forEach((item: any) => {
                    if (item.icon) {
                        navIconSvgs[item.id] = getLucideSvg(item.icon);
                    }
                });
            }
            (locals as any).navIconSvgs = navIconSvgs;
        }

        // Collect all unique fonts to load from Google Fonts
        const uniqueFonts = new Set<string>();
        const systemFonts = ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif', 'serif', 'monospace', 'inherit', 'initial', 'revert', 'unset', 'Pretendard'];
        
        const addFont = (name: any) => {
            if (!name || typeof name !== 'string') return;
            name.split(/[,;]/).forEach(f => {
                const trimmed = f.trim().replace(/['"]/g, '');
                if (trimmed && !systemFonts.some(sf => trimmed.includes(sf))) {
                    uniqueFonts.add(trimmed);
                }
            });
        };

        if (settings.theme?.googleFontName) {
            addFont(settings.theme.googleFontName);
        } else if (settings.theme?.fontFamily) {
            addFont(settings.theme.fontFamily);
        }
        
        if (settings.theme?.widgetItemStyle?.fontFamily) {
            addFont(settings.theme.widgetItemStyle.fontFamily);
        }

        if (settings.theme?.widgetTitleStyle?.fontFamily) {
            addFont(settings.theme.widgetTitleStyle.fontFamily);
        }
        
        if (settings.header?.logoFont) {
            addFont(settings.header.logoFont);
        }

        const googleFonts = Array.from(uniqueFonts).map(f => f.replace(/\s+/g, '+'));
        const navIconSvgs = (locals as any).navIconSvgs || {};

        return {
            settings,
            isMobile,
            navIconSvgs,
            googleFonts,
            googleFontName: googleFonts[0] || '', // Maintain backward compatibility for single font logic if needed
            activeLayout,
            layoutWidgets,
            desktopWidgets,
            mobileWidgets,
            mobileLayout,
            categories,
            recentPosts,
            popularPosts,
            tags,
            recentComments: recentEntries?.comments || [],
            recentGuestbooks: recentEntries?.guestbooks || [],
            user: locals.user,
            lang: locals.lang,
            dbDefaultLang: locals.dbDefaultLang,
            langData: locals.langData,
            languages: locals.languages,
            i18n: {
                lang: locals.lang,
                dbDefaultLang: locals.dbDefaultLang,
                dictionary: settings?.ui_dictionary || {},
                fallbackMsg: locals.langData?.fallback_message
            }
        };
    } catch (e) {
        console.error('Layout data load failed:', e);
        return {
            settings: {},
            isMobile: false,
            navIconSvgs: {},
            googleFontName: '',
            activeLayout: null,
            layoutWidgets: [],
            desktopWidgets: [],
            mobileWidgets: [],
            mobileLayout: { columnCount: 1, columnWidths: '1fr' },
            categories: [],
            recentPosts: [],
            popularPosts: [],
            tags: [],
            recentComments: [],
            recentGuestbooks: [],
            user: locals.user,
            lang: locals.lang,
            dbDefaultLang: locals.dbDefaultLang,
            langData: locals.langData,
            languages: locals.languages,
            i18n: {
                lang: locals.lang,
                dbDefaultLang: locals.dbDefaultLang,
                dictionary: {},
                fallbackMsg: locals.langData?.fallback_message
            }
        };
    }
};

/**
 * headCode 내에 실제 애드센스나 GA4 스크립트 도메인이 감지될 때만 
 * 브라우저 사전 연결(preconnect) 링크 태그를 동적으로 상단에 병합해 주는 안전 헬퍼 함수
 */
function optimizeHeadScripts(headCode: string): string {
    if (!headCode) return "";

    const hasAdSense = headCode.includes("pagead2.googlesyndication.com");
    const hasGA = headCode.includes("googletagmanager.com");

    let resourceHints = "";

    // 실제 설정된 구글 애드센스 도메인이 존재할 때만 사전 연결 힌트 삽입
    if (hasAdSense) {
        resourceHints += `
<link rel="preconnect" href="https://pagead2.googlesyndication.com">
<link rel="dns-prefetch" href="https://pagead2.googlesyndication.com">`;
    }

    // 실제 설정된 GA4 도메인이 존재할 때만 사전 연결 힌트 삽입
    if (hasGA) {
        resourceHints += `
<link rel="preconnect" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://www.googletagmanager.com">`;
    }

    if (!resourceHints) return headCode;

    // 설정된 경우에만 상단에 리소스 힌트를 안전하게 병합하여 반환
    return resourceHints + "\n" + headCode;
}

