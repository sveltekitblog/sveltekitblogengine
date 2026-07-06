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

/**
 * 배경 설정 데이터를 정규화하고 CSS에서 사용할 수 있는 값을 추출하는 유틸리티
 */

export interface BackgroundConfig {
    type: 'solid' | 'gradient' | 'image' | 'js' | 'inherit' | 'none';
    value: string;
    jsCode?: string;
    jsConfig?: Record<string, any>;
    opacity?: number;
    blur?: number;
    layerBlur?: number;
    overlayColor?: string;
    overlayOpacity?: number;
    fallbackColor?: string;
    allowMobile?: boolean;
    mobile?: BackgroundConfig;
}

/**
 * 배경 설정을 표준 객체 구조로 변환합니다.
 */
export function normalizeBackground(bg: any, legacyOpacity?: number, legacyBlur?: number, legacyLayerBlur?: number): BackgroundConfig {
    let result: BackgroundConfig = { type: "solid", value: "transparent" };
    if (!bg) {
        result.opacity = legacyOpacity !== undefined ? legacyOpacity : 1;
        result.blur = legacyBlur !== undefined ? legacyBlur : 0;
        result.layerBlur = legacyLayerBlur !== undefined ? legacyLayerBlur : 0;
        return result;
    }

    if (typeof bg === "string") {
        const trimmed = bg.trim();
        if (trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && parsed.type) {
                    result = parsed;
                }
            } catch {
                result = { type: "solid", value: bg };
            }
        } else {
            result = { type: "solid", value: bg };
        }
    } else if (bg && bg.type) {
        result = { ...bg };
    }

    // 기본값 설정 (객체에 값이 없으면 레거시 값 우선 적용, 없으면 최후의 기본값)
    if (result.jsCode === undefined) result.jsCode = "";
    if (result.jsConfig === undefined) result.jsConfig = {};
    if (result.opacity === undefined) result.opacity = legacyOpacity !== undefined ? legacyOpacity : 1;
    if (result.blur === undefined) result.blur = legacyBlur !== undefined ? legacyBlur : 0;
    if (result.layerBlur === undefined) result.layerBlur = legacyLayerBlur !== undefined ? legacyLayerBlur : 0;
    if (result.overlayColor === undefined) result.overlayColor = '#000000';
    if (result.overlayOpacity === undefined) result.overlayOpacity = 0;
    if (result.allowMobile === undefined) result.allowMobile = false;
    if (result.fallbackColor === undefined) result.fallbackColor = "";

    // 모바일 설정이 객체인 경우 재귀 정규화 수행
    if (result.mobile !== undefined && result.mobile !== null) {
        result.mobile = normalizeBackground(result.mobile);
    }

    return result;
}

/**
 * CSS 변수(--header-bg 등)에 직접 주입할 수 있는 배경 값을 반환합니다.
 */
export function getBgValue(bg: any): string {
    const normalized = normalizeBackground(bg);
    if (normalized.type === "inherit") return "transparent";
    if (normalized.type === "none") return "transparent";
    if (normalized.type === "solid") return normalized.value;
    if (normalized.type === "gradient") return normalized.value;
    if (normalized.type === "image") return `url("${normalized.value}")`;
    if (normalized.type === "js") return "transparent"; // JS 배경은 Renderer에서 처리
    return normalized.value || "transparent";
}

/**
 * 인라인 스타일에 직접 사용할 수 있는 background 속성 문자열을 반환합니다.
 */
export function getBgStyle(bg: any): string {
    const normalized = normalizeBackground(bg);
    if (normalized.type === "inherit") return "";
    if (normalized.type === "none") return "";
    if (normalized.type === "solid") return `background: ${normalized.value}`;
    if (normalized.type === "gradient") return `background: ${normalized.value}`;
    if (normalized.type === "image") return `background: url("${normalized.value}") center/cover no-repeat`;
    if (normalized.type === "js") return ""; // JS 배경은 Renderer에서 처리
    return "";
}
