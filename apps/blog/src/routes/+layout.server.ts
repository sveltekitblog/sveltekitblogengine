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

import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { fallbackDictionary } from '@blog/shared/i18n';

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

export const load: LayoutServerLoad = async ({ locals, request, cookies }) => {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    const db = locals.db;
    if (!db) return { user: locals.user, isMobile, navIconSvgs: {} };

    try {
        const [settings, dbActiveLayout] = await Promise.all([
            db.getSettings(locals.lang || locals.dbDefaultLang, locals.dbDefaultLang),
            db.getActiveLayout()
        ]);

        // 안전한 파싱 헬퍼: DB에서 문자열로 가져온 JSON 데이터를 객체화
        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return val; }
            }
            return val;
        };

        // --- 다중 디자인 슬롯 (Slot 1, 2, 3) 및 방문자 선택/랜덤/고정 노출 제어 ---
        let activeLayout = dbActiveLayout;
        let allWidgets: any[] = [];
        let targetSlotId = '1';
        let designMode = '1';

        const designSlots = safeParse(settings?.design_slots);
        let activeSlotData: any = null;
        let allowVisitorSelection = false;
        let availableSlots: Array<{ id: string; name: string }> = [];
        let availableSlotBundles: Record<string, any> = {};

        // 위젯 정규화 헬퍼 (camelCase와 snake_case 동시 보장)
        const normalizeWidgetList = (rawWidgets: any[]) => {
            if (!Array.isArray(rawWidgets)) return [];
            return rawWidgets.map((w: any) => {
                let resolvedCustomTitle = w.customTitle ?? w.custom_title;
                if (resolvedCustomTitle && typeof resolvedCustomTitle === 'string' && resolvedCustomTitle.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(resolvedCustomTitle);
                        resolvedCustomTitle = parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || resolvedCustomTitle;
                    } catch(e) {}
                } else if (resolvedCustomTitle && typeof resolvedCustomTitle === 'object' && resolvedCustomTitle !== null) {
                    resolvedCustomTitle = resolvedCustomTitle[locals.lang || locals.dbDefaultLang] || resolvedCustomTitle[locals.dbDefaultLang] || Object.values(resolvedCustomTitle)[0] || '';
                }

                const columnIndex = Number(w.columnIndex ?? w.column_index ?? 0);
                const sortOrder = Number(w.sortOrder ?? w.sort_order ?? 0);
                const config = typeof w.config === 'string' ? JSON.parse(w.config || '{}') : (w.config || {});

                return {
                    ...w,
                    columnIndex,
                    column_index: columnIndex,
                    sortOrder,
                    sort_order: sortOrder,
                    customTitle: resolvedCustomTitle,
                    custom_title: resolvedCustomTitle,
                    config
                };
            });
        };

        if (designSlots && designSlots.slots && typeof designSlots.slots === 'object') {
            allowVisitorSelection = Boolean(designSlots.allow_visitor_selection);
            designMode = designSlots.active_mode || '1';

            // 슬롯 노출 규칙:
            // - 슬롯 1은 항상 기본 활성
            // - 슬롯 2, 3은 관리자가 명시적으로 enabled: true로 활성화한 경우에만 노출
            const availableSlotIds = ['1', '2', '3'].filter(id => {
                const s = designSlots.slots[id];
                if (!s) return id === '1';
                if (id === '1') return true;
                return Boolean(s.enabled);
            });

            availableSlots = availableSlotIds.map(id => ({
                id,
                name: designSlots.slots[id]?.name || (id === '1' ? '디자인 1' : (id === '2' ? '미니멀 1열' : '다크 모던'))
            }));

            // [CDN 캐시 보존 및 SEO 무결성 원칙]
            // 서버 렌더링(SSR)은 항상 관리자가 지정한 기본 활성 슬롯(기본 1번)으로 일관되게 렌더링합니다.
            // 쿠키로 서버 응답을 분기하지 않아야 Cloudflare CDN 엣지가 단일 HTML을 100% 캐시(HIT)할 수 있습니다.
            if (availableSlotIds.includes(designMode)) {
                targetSlotId = designMode;
            } else if (availableSlotIds.length > 0) {
                targetSlotId = availableSlotIds[0];
            } else {
                targetSlotId = '1';
            }

            activeSlotData = designSlots.slots[targetSlotId];

            // [조건부 번들링] 어드민에서 다중 디자인 선택을 허용하고 공개 슬롯이 2개 이상일 때만 다른 슬롯 데이터 포함
            if (allowVisitorSelection && availableSlots.length > 1) {
                for (const slotId of availableSlotIds) {
                    const slot = designSlots.slots[slotId];
                    if (slot) {
                        availableSlotBundles[slotId] = {
                            id: slotId,
                            name: slot.name || (slotId === '1' ? '디자인 1' : (slotId === '2' ? '미니멀 1열' : '다크 모던')),
                            theme: slot.theme || {},
                            header: slot.header || {},
                            footer: slot.footer || {},
                            layout: slot.layout || {
                                columnCount: 1,
                                columnWidths: '1fr',
                                mobileColumnCount: 1,
                                mobileColumnWidths: '1fr'
                            },
                            widgets: normalizeWidgetList(slot.widgets || []),
                            widget_shadow_global: slot.widget_shadow_global || null,
                            staticHtmls: slot.staticHtmls || null
                        };
                    }
                }
            }
        } else {
            availableSlots = [{ id: '1', name: '디자인 1' }];
        }

        // 슬롯 데이터가 존재할 경우 settings 및 layout 주입
        if (activeSlotData) {
            if (activeSlotData.theme) settings.theme = activeSlotData.theme;
            if (activeSlotData.header) settings.header = activeSlotData.header;
            if (activeSlotData.footer) settings.footer = activeSlotData.footer;
            if (activeSlotData.widget_shadow_global) settings.widget_shadow_global = activeSlotData.widget_shadow_global;

            if (activeSlotData.staticHtmls && typeof activeSlotData.staticHtmls === 'object') {
                Object.assign(settings, activeSlotData.staticHtmls);
            }

            if (activeSlotData.layout || activeSlotData.widgets) {
                activeLayout = {
                    id: (dbActiveLayout as any)?.id || 1,
                    name: activeSlotData.name || (dbActiveLayout as any)?.name || `Slot ${targetSlotId}`,
                    columnCount: activeSlotData.layout?.columnCount ?? (dbActiveLayout as any)?.columnCount ?? 1,
                    columnWidths: activeSlotData.layout?.columnWidths ?? (dbActiveLayout as any)?.columnWidths ?? '1fr',
                    mobileColumnCount: activeSlotData.layout?.mobileColumnCount ?? (dbActiveLayout as any)?.mobileColumnCount ?? 1,
                    mobileColumnWidths: activeSlotData.layout?.mobileColumnWidths ?? (dbActiveLayout as any)?.mobileColumnWidths ?? '1fr',
                    isActive: true,
                    createdAt: '',
                    updatedAt: ''
                };

                if (Array.isArray(activeSlotData.widgets)) {
                    allWidgets = activeSlotData.widgets.map((w: any) => {
                        let resolvedCustomTitle = w.customTitle ?? w.custom_title;
                        if (resolvedCustomTitle && typeof resolvedCustomTitle === 'string' && resolvedCustomTitle.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(resolvedCustomTitle);
                                resolvedCustomTitle = parsed[locals.lang || locals.dbDefaultLang] || parsed[locals.dbDefaultLang] || resolvedCustomTitle;
                            } catch(e) {}
                        } else if (resolvedCustomTitle && typeof resolvedCustomTitle === 'object' && resolvedCustomTitle !== null) {
                            resolvedCustomTitle = resolvedCustomTitle[locals.lang || locals.dbDefaultLang] || resolvedCustomTitle[locals.dbDefaultLang] || Object.values(resolvedCustomTitle)[0] || '';
                        }

                        const columnIndex = Number(w.columnIndex ?? w.column_index ?? 0);
                        const sortOrder = Number(w.sortOrder ?? w.sort_order ?? 0);
                        const config = typeof w.config === 'string' ? JSON.parse(w.config || '{}') : (w.config || {});

                        return {
                            ...w,
                            columnIndex,
                            column_index: columnIndex,
                            sortOrder,
                            sort_order: sortOrder,
                            customTitle: resolvedCustomTitle,
                            custom_title: resolvedCustomTitle,
                            config
                        };
                    });
                }
            }
        }

        // 슬롯 위젯이 지정되지 않은 경우 기존 DB 활성 레이아웃 위젯 로드 (완벽한 안전망)
        if (allWidgets.length === 0 && activeLayout) {
            allWidgets = await db.getLayoutWidgets(activeLayout.id as number, locals.lang || locals.dbDefaultLang, locals.dbDefaultLang);
        }

        let layoutWidgets = allWidgets;
        let desktopWidgets = allWidgets.filter((w: any) => w.device !== 'mobile');
        let mobileWidgets = allWidgets.filter((w: any) => w.device !== 'desktop');
        let mobileLayout = {
            columnCount: (activeLayout as any)?.mobileColumnCount || 1,
            columnWidths: (activeLayout as any)?.mobileColumnWidths || '1fr',
        };

        const getMaxLimitFor = (type: string): number | undefined => {
            const limits = allWidgets
                .filter((w: any) => w.type === type)
                .map((w: any) => parseInt(w.config?.limit, 10))
                .filter((n: number) => !isNaN(n) && n > 0);
            return limits.length > 0 ? Math.max(...limits) : undefined;
        };

        const hasWidget = (types: string | string[]) => {
            const arr = Array.isArray(types) ? types : [types];
            return allWidgets.some((w: any) => arr.includes(w.type));
        };

        const currentLang = locals.lang || locals.dbDefaultLang || 'ko';
        const defaultLang = locals.dbDefaultLang || 'ko';

        const [categories, recentPosts, popularPosts, tags, recentEntries] = await Promise.all([
            db.getCategories(currentLang, defaultLang).catch((e: any) => { console.error('getCategories failed:', e); return []; }),
            hasWidget("RecentPosts")
                ? db.getRecentPosts(getMaxLimitFor("RecentPosts"), undefined, 1, undefined, currentLang, defaultLang)
                : Promise.resolve([]),
            hasWidget("PopularPosts")
                ? db.getPopularPosts(getMaxLimitFor("PopularPosts"), currentLang, defaultLang)
                : Promise.resolve([]),
            hasWidget(["TagCloud", "Tags"])
                ? db.getAllTags(currentLang, defaultLang)
                : Promise.resolve([]),
            hasWidget(["RecentComments", "RecentGuestbooks"])
                ? db.getRecentEntries(currentLang, defaultLang, getMaxLimitFor("RecentComments"), getMaxLimitFor("RecentGuestbooks")).catch((e: any) => {
                    console.error('getRecentEntries failed:', e);
                    return { comments: [], guestbooks: [] };
                })
                : Promise.resolve({ comments: [], guestbooks: [] })
        ]);

        // [HTML 페이로드 다이어트: UI 사전 단일 언어 평탄화]
        // 관리자 전용(admin.*) 900+ 키를 배제하고 블로그/공통(blog.*, common.*) 키만 선별한 뒤,
        // 현재 활성 언어(currentLang) 단일 문자열로 즉시 평탄화하여 HTML 전송량을 극적으로 감축합니다.
        const rawDictionary = safeParse(settings?.ui_dictionary) || {};
        const blogDictionary: Record<string, string> = {};

        // 1. 기본 fallbackDictionary 중 blog.*, common.* 키를 현재 활성 언어로 평탄화
        for (const [key, val] of Object.entries(fallbackDictionary)) {
            if (key.startsWith('blog.') || key.startsWith('common.')) {
                if (typeof val === 'object' && val !== null) {
                    blogDictionary[key] = (val as Record<string, string>)[currentLang] || (val as Record<string, string>)[defaultLang] || Object.values(val)[0] || '';
                } else if (typeof val === 'string') {
                    blogDictionary[key] = val;
                }
            }
        }

        // 2. DB 사용자 정의 ui_dictionary 값으로 덮어쓰기 (현재 언어에 맞게 평탄화)
        for (const [key, val] of Object.entries(rawDictionary)) {
            if (key.startsWith('blog.') || key.startsWith('common.')) {
                let resolved = '';
                if (typeof val === 'object' && val !== null) {
                    resolved = (val as any)[currentLang] || (val as any)[defaultLang] || Object.values(val)[0] || '';
                } else if (typeof val === 'string') {
                    if (val.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(val);
                            resolved = parsed[currentLang] || parsed[defaultLang] || Object.values(parsed)[0] || val;
                        } catch {
                            resolved = val;
                        }
                    } else {
                        resolved = val;
                    }
                }
                if (resolved) {
                    blogDictionary[key] = String(resolved);
                }
            }
        }

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

            settings.ui_dictionary = blogDictionary;

            // 브라우저 클라이언트에 불필요한 서버 전용/미사용 필드 제거 (HTML 페이로드 다이어트)
            delete settings.board_api_key;
            delete settings.deploy_config;
            delete settings.robots_txt;
            delete settings.ads_txt;
            delete settings.design_slots;
            delete settings.header_static_html_ko;
            delete settings.header_static_html_en;
            delete settings.header_static_html_ja;
            delete settings.footer_static_html_ko;
            delete settings.footer_static_html_en;
            delete settings.footer_static_html_ja;
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

        // [폰트 사전 로딩] 다중 디자인 전환 시 글꼴 지연/깨짐을 방지하기 위해 사용 가능한 모든 슬롯의 폰트도 함께 수집
        if (allowVisitorSelection) {
            for (const s of Object.values(availableSlotBundles)) {
                if (s.theme?.googleFontName) addFont(s.theme.googleFontName);
                if (s.theme?.fontFamily) addFont(s.theme.fontFamily);
                if (s.theme?.widgetItemStyle?.fontFamily) addFont(s.theme.widgetItemStyle.fontFamily);
                if (s.theme?.widgetTitleStyle?.fontFamily) addFont(s.theme.widgetTitleStyle.fontFamily);
                if (s.header?.logoFont) addFont(s.header.logoFont);
            }
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
            activeSlotId: targetSlotId,
            activeDesignMode: designMode,
            designSlotInfo: {
                allowVisitorSelection,
                currentSlotId: targetSlotId,
                activeMode: designMode,
                availableSlots,
                slots: availableSlotBundles
            },
            user: locals.user,
            lang: locals.lang,
            dbDefaultLang: locals.dbDefaultLang,
            langData: locals.langData,
            languages: locals.languages,
            i18n: {
                lang: locals.lang,
                dbDefaultLang: locals.dbDefaultLang,
                dictionary: blogDictionary,
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
            activeSlotId: '1',
            activeDesignMode: '1',
            designSlotInfo: {
                allowVisitorSelection: false,
                currentSlotId: '1',
                activeMode: '1',
                availableSlots: [{ id: '1', name: '디자인 1' }],
                slots: {}
            },
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

