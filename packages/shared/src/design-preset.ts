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

export const ALLOWED_PRESET_WIDGET_TYPES = new Set<string>([
    'PostContent',
    'CategoryMenu',
    'PopularPosts',
    'RecentPosts',
    'TagCloud',
]);

export const DEFAULT_PRESET_WIDGET_TITLES: Record<string, { ko: string; en: string; ja: string }> = {
    PostContent: { ko: '포스트', en: 'Posts', ja: '投稿' },
    CategoryMenu: { ko: '카테고리', en: 'Categories', ja: 'カテゴリー' },
    PopularPosts: { ko: '인기 포스트', en: 'Popular Posts', ja: '人気ポスト' },
    RecentPosts: { ko: '최신 포스트', en: 'Recent Posts', ja: '最新ポスト' },
    TagCloud: { ko: '태그', en: 'Tags', ja: 'タグ' },
};

const EXTERNAL_OR_UNSAFE_IMG_RE = /^(https?:\/\/|\/\/|data:|javascript:)/i;

export function sanitizeBackgroundObject(bg: any, defaultColor = '#ffffff'): any {
    if (!bg || typeof bg !== 'object') return bg;
    const cleaned: any = { ...bg, jsCode: '', jsConfig: {} };

    // 1. 커스텀 JS 배경은 별도 공유 게시판으로 분리하므로 solid로 안전 전환
    if (cleaned.type === 'js') {
        cleaned.type = 'solid';
        cleaned.value = cleaned.fallbackColor || cleaned.overlayColor || defaultColor;
    }

    // 2. 외부 개인 도메인 이미지 URL(http://, https://, //, data:, javascript:) 제거
    if (cleaned.type === 'image' && typeof cleaned.value === 'string') {
        const val = cleaned.value.trim();
        if (EXTERNAL_OR_UNSAFE_IMG_RE.test(val)) {
            cleaned.type = 'solid';
            cleaned.value = cleaned.fallbackColor || cleaned.overlayColor || defaultColor;
        }
    }

    // 3. 모바일 하위 배경 객체(.mobile)도 동일하게 재귀 정제
    if (cleaned.mobile && typeof cleaned.mobile === 'object') {
        cleaned.mobile = sanitizeBackgroundObject(cleaned.mobile, defaultColor);
    }

    return cleaned;
}

function inspectBgFeatures(bg: any): { hasJsBg: boolean; hasExternalImage: boolean } {
    if (!bg || typeof bg !== 'object') return { hasJsBg: false, hasExternalImage: false };
    let hasJsBg = bg.type === 'js' || (typeof bg.jsCode === 'string' && bg.jsCode.trim().length > 0);
    let hasExternalImage =
        bg.type === 'image' && typeof bg.value === 'string' && EXTERNAL_OR_UNSAFE_IMG_RE.test(bg.value.trim());

    if (bg.mobile && typeof bg.mobile === 'object') {
        const m = inspectBgFeatures(bg.mobile);
        hasJsBg = hasJsBg || m.hasJsBg;
        hasExternalImage = hasExternalImage || m.hasExternalImage;
    }
    return { hasJsBg, hasExternalImage };
}

export function detectStrippedPresetFeatures(rawPreset: any): {
    hasJsBg: boolean;
    hasHtmlWidget: boolean;
    hasExternalImage: boolean;
} {
    const d = rawPreset?.design || rawPreset || {};
    const bgs = [
        d.theme?.bodyBackground,
        d.header?.headerBackground,
        d.header?.logoColor,
        d.footer?.footerBackground,
    ];
    let hasJsBg = false;
    let hasExternalImage = false;
    for (const bg of bgs) {
        const res = inspectBgFeatures(bg);
        if (res.hasJsBg) hasJsBg = true;
        if (res.hasExternalImage) hasExternalImage = true;
    }
    const hasHtmlWidget = Array.isArray(d.widgets)
        ? d.widgets.some((w: any) => w && w.type === 'HtmlWidget')
        : false;
    return { hasJsBg, hasHtmlWidget, hasExternalImage };
}

export function sanitizeDesignPresetForSharing(rawPreset: any) {
    // Svelte 5 $state Proxy 호환을 위해 JSON 직렬화 기반 깊은 복사 사용
    const preset = JSON.parse(JSON.stringify(rawPreset));
    preset.version = '3.0';
    preset.backupType = 'design_preset';

    const d = preset.design;
    if (!d || typeof d !== 'object') return preset;

    // 64KB 용량 제한 준수를 위해 불필요한 정적 HTML 캐시 키 제거
    delete d.staticHtmls;

    // 1. site_title 익명화
    d.site_title = {
        ko: 'SvelteKit Blog',
        en: 'SvelteKit Blog',
        ja: 'SvelteKit Blog',
    };

    // 2. theme 내 배경 객체 정제 (jsCode 및 외부 이미지 URL 제거)
    if (d.theme) {
        d.theme.bodyBackground = sanitizeBackgroundObject(d.theme.bodyBackground, '#ffffff');
    }

    // 3. header 내 개인 데이터 및 배경 정제
    if (d.header) {
        d.header.logoText = {
            ko: 'SvelteKit Blog',
            en: 'SvelteKit Blog',
            ja: 'SvelteKit Blog',
        };
        d.header.headerBackground = sanitizeBackgroundObject(d.header.headerBackground, '#ffffff');
        if (d.header.logoColor) {
            d.header.logoColor = sanitizeBackgroundObject(d.header.logoColor, '#0f172a');
        }

        // 표준 기본 메뉴 2개로 고정 (외부 링크 및 개인 메뉴 제거)
        const standardMenus = [
            {
                id: 1,
                type: 'link',
                label: { ko: '홈', en: 'Home', ja: 'ホーム' },
                url: { ko: '/', en: '/', ja: '/' },
                openInNewTab: false,
                icon: 'Home',
            },
            {
                id: 2,
                type: 'category_drawer',
                label: { ko: '카테고리', en: 'Categories', ja: 'カテゴリー' },
                url: { ko: '/', en: '/', ja: '/' },
                openInNewTab: false,
                icon: 'Menu',
            },
        ];
        d.header.menuItems = JSON.parse(JSON.stringify(standardMenus));
        if (d.header.mobile) {
            d.header.mobile.menuItems = JSON.parse(JSON.stringify(standardMenus));
        }

        // 공지바(noticeBar): 색상·그림자·enabled 디자인은 유지하고 개인 문구·외부 URL만 초기화
        if (d.header.noticeBar) {
            d.header.noticeBar.badgeText = { ko: 'NOTICE', en: 'NOTICE', ja: 'NOTICE' };
            d.header.noticeBar.text = {
                ko: '공지사항 배너 디자인 미리보기입니다.',
                en: 'Notice banner design preview.',
                ja: 'お知らせバナーのデザインプレビューです。',
            };
            d.header.noticeBar.url = { ko: '', en: '', ja: '' };
            d.header.noticeBar.openInNewTab = false;
        }
    }

    // 4. footer 내 개인 저작권 HTML 링크, 소셜 링크, navLinks 정제
    if (d.footer) {
        d.footer.footerBackground = sanitizeBackgroundObject(d.footer.footerBackground, '');
        d.footer.copyright = {
            ko: '© 2026 My Blog. Powered by SvelteKit Blog Engine.',
            en: '© 2026 My Blog. Powered by SvelteKit Blog Engine.',
            ja: '© 2026 My Blog. Powered by SvelteKit Blog Engine.',
        };
        d.footer.socialLinks = [];
        d.footer.navLinks = [
            { id: 1, label: { ko: '소개', en: 'About', ja: '紹介' }, url: '/about', htmlContent: '' },
            { id: 2, label: { ko: '개인정보 처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー' }, url: '/privacy', htmlContent: '' },
            { id: 3, label: { ko: '이용약관', en: 'Terms of Service', ja: '利用規約' }, url: '/terms', htmlContent: '' },
            { id: 4, label: { ko: '문의', en: 'Contact', ja: 'お問い合わせ' }, url: '/contact', htmlContent: '' },
        ];
        if (d.footer.mobile) {
            d.footer.mobile.copyright = { ko: '', en: '', ja: '' };
            d.footer.mobile.navLinks = [];
        }
    }

    // 5. widgets 정제: HtmlWidget 완전 제거, 5종 순수 위젯만 허용 및 디바이스/컬럼별 sortOrder 재정렬
    if (Array.isArray(d.widgets)) {
        const filtered = d.widgets.filter((w: any) => w && ALLOWED_PRESET_WIDGET_TYPES.has(w.type));
        const orderCounters = new Map<string, number>();

        d.widgets = filtered.map((w: any, idx: number) => {
            const device = w.device === 'mobile' ? 'mobile' : 'desktop';
            const colIdx = Math.max(0, Number(w.column_index ?? w.columnIndex ?? 0));
            const groupKey = `${device}:${colIdx}`;
            const nextOrder = orderCounters.get(groupKey) ?? 0;
            orderCounters.set(groupKey, nextOrder + 1);

            return {
                ...w,
                id: idx + 1,
                device,
                column_index: colIdx,
                columnIndex: colIdx,
                sort_order: nextOrder,
                sortOrder: nextOrder,
                custom_title: DEFAULT_PRESET_WIDGET_TITLES[w.type] || {
                    ko: w.name || '',
                    en: w.type,
                    ja: w.type,
                },
            };
        });
    }

    return preset;
}
