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
 * 저장 시점(Save-Time) 및 로딩 시점(Load-Time) 본문 HTML 가공/복원 어드민 전용 유틸리티
 */

// Svelte와 일치하는 slugify 규칙
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        // 한글/일본어/영어/숫자/공백/하이픈/언더바 제외 제거
        .replace(/[^\w\s\-\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FBF]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * 1. 저장 시 가공 (Save-Time Wrapping)
 * HTML 본문 문자열을 분석하여:
 * - 이미 <figure>로 감싸진 영역은 무시하고, 독립된 <img> 태그 중 캡션/정렬 속성이 있는 이미지만 figure로 래핑하여 저장합니다.
 * - <h1-6> 제목 태그들에 고유한 id 속성을 부여합니다.
 */
export function processContentHtml(html: string): string {
    if (!html) return '';

    // ── 1. Image Wrapping ──────────────────────────────────────────
    const imageWrapRegex = /(<figure[^>]*>[\s\S]*?<\/figure>)|<img([^>]+)>/gi;
    let processed = html.replace(imageWrapRegex, (match, figureGroup, imgAttrs) => {
        // 이미 figure 태그로 감싸져 있는 경우, 추가 변환 없이 그대로 반환
        if (figureGroup) {
            return figureGroup;
        }

        // figure 태그로 감싸져 있지 않은 단독 이미지의 경우 속성 추출 및 래핑 진행
        const attrs = imgAttrs || '';
        const captionMatch = attrs.match(/data-caption="([^"]+)"/i);
        const alignMatch = attrs.match(/data-align="([^"]+)"/i);
        
        const caption = captionMatch ? captionMatch[1] : '';
        const align = alignMatch ? alignMatch[1] : 'center';
        
        // 캡션이 있거나, 정렬이 center가 아닌 경우 figure 래핑
        if (caption || align !== 'center') {
            const cleanImg = match;
            const captionHtml = caption ? `<figcaption>${caption}</figcaption>` : '';
            return `<figure data-align="${align}">${cleanImg}${captionHtml}</figure>`;
        }
        
        return match;
    });

    // ── 2. Heading IDs Injection ───
    const idMap = new Map<string, number>();
    processed = processed.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/h[1-6]>/gi, (match, tag, attrs, content) => {
        if (/id="/i.test(attrs)) {
            return match;
        }

        const textContent = content.replace(/<[^>]*>/g, '').trim();
        let baseId = slugify(textContent);
        if (!baseId) {
            baseId = 'heading';
        }

        let uniqueId = baseId;
        if (idMap.has(baseId)) {
            const count = idMap.get(baseId)! + 1;
            idMap.set(baseId, count);
            uniqueId = `${baseId}-${count}`;
        } else {
            idMap.set(baseId, 0);
        }

        return `<${tag}${attrs} id="${uniqueId}">${content}</${tag}>`;
    });

    return processed;
}

/**
 * 2. 에디터 로드 시 복원 (Load-Time Stripping)
 * 이미 완제품 형태로 DB에 구워져 있는 <figure> 구조 중,
 * 오직 이미지(및 링크) 캡션 레이아웃 영역만 타겟팅하여 해체(HTML 복원)시킵니다.
 * 다른 용도의 figure (코드블럭, 비디오 등)는 완전히 격리하여 0%의 영향도로 보존합니다.
 */
export function stripFigureWrapper(html: string): string {
    if (!html) return '';
    
    // 오직 내부에 <img> 또는 <a><img></a>만 존재하고, 옵션으로 figcaption이 들어있는 figure만 매칭
    const targetFigureRegex = /<figure[^>]*>\s*(<a[^>]*>)?\s*(<img[^>]+>)\s*(<\/a>)?\s*(<figcaption>[\s\S]*?<\/figcaption>)?\s*<\/figure>/gi;
    
    return html.replace(targetFigureRegex, (match, openAnchor, imgTag, closeAnchor, figcaption) => {
        const anchorOpen = openAnchor || '';
        const anchorClose = closeAnchor || '';
        // figure와 figcaption은 완전히 뜯어내고, 알맹이인 <img> 태그(및 링크)만 복원하여 반환
        return `${anchorOpen}${imgTag}${anchorClose}`;
    });
}
