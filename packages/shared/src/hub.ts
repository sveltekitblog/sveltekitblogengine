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

export const HUB_MIN_CONTENT_LENGTH = 700;
export const HUB_SAMPLED_MAX_LENGTH = 900;
export const HUB_SAMPLED_PART_LENGTH = 300;

export const HUB_CATEGORIES = [
    {
        slug: 'dev',
        labels: { ko: '개발 · 코딩', en: 'Development', ja: '開発' },
        hint: {
            ko: '프론트엔드, 백엔드, 프로그래밍 언어, 프레임워크, 알고리즘, 앱/게임 개발',
            en: 'Frontend, backend, programming languages, frameworks, algorithms, app/game dev',
            ja: 'フロントエンド、バックエンド、プログラミング言語、フレームワーク、アルゴリズム'
        }
    },
    {
        slug: 'infra',
        labels: { ko: '인프라 · DB · 보안', en: 'Infra & Cloud', ja: 'インフラ' },
        hint: {
            ko: '리눅스, 서버, 클라우드, Docker/Podman, Proxmox, 네트워크, DB, 보안',
            en: 'Linux, servers, cloud, Docker/Podman, Proxmox, networking, DB, security',
            ja: 'Linux、サーバー、クラウド、Docker/Podman、Proxmox、ネットワーク、DB、セキュリティ'
        }
    },
    {
        slug: 'ai',
        labels: { ko: 'AI · 데이터', en: 'AI & Data', ja: 'AI・データ' },
        hint: {
            ko: 'LLM, 머신러닝, 딥러닝, 프롬프트 엔지니어링, 데이터 분석, 파이프라인',
            en: 'LLM, machine learning, deep learning, prompt engineering, data analysis',
            ja: 'LLM、機械学習、ディープラーニング、プロンプトエンジニアリング、データ分析'
        }
    },
    {
        slug: 'design',
        labels: { ko: '디자인 · UI/UX', en: 'Design & UX', ja: 'デザイン' },
        hint: {
            ko: 'UI/UX, CSS/스타일링, 타이포그래피, 피그마, 모션/인터랙션, 디자인 시스템',
            en: 'UI/UX, CSS/styling, typography, Figma, motion/interaction, design systems',
            ja: 'UI/UX、CSS/スタイリング、タイポグラフィ、Figma、デザインシステム'
        }
    },
    {
        slug: 'tech',
        labels: { ko: 'IT · 기어 · 리뷰', en: 'Tech & Review', ja: 'IT・レビュー' },
        hint: {
            ko: '하드웨어, 미니 PC, 키보드, 모니터, 모바일 기기, 테크 제품/소프트웨어 리뷰',
            en: 'Hardware, mini PC, keyboards, monitors, mobile devices, tech product/SW reviews',
            ja: 'ハードウェア、ミニPC、キーボード、モニター、モバイル機器、製品/SWレビュー'
        }
    },
    {
        slug: 'music',
        labels: { ko: '음악 · 오디오', en: 'Music & Audio', ja: '音楽' },
        hint: {
            ko: '데스크파이, DAC/앰프, 헤드폰/이어폰, 작곡/DAW, 음반/플레이리스트 리뷰',
            en: 'Desk-fi, DAC/amp, headphones/IEMs, composition/DAW, album/playlist reviews',
            ja: 'オーディオ、DAC/アンプ、ヘッドホン/イヤホン、作曲/DAW、音楽レビュー'
        }
    },
    {
        slug: 'insight',
        labels: { ko: '커리어 · 인사이트', en: 'Career & Insight', ja: 'キャリア' },
        hint: {
            ko: '개발자 커리어, 회고, 기술 문서 작성법, 아키텍처 철학, 업계 트렌드/에세이',
            en: 'Developer career, retrospectives, technical writing, architecture philosophy, essays',
            ja: 'エンジニアキャリア、振り返り、技術文書作成、設計思想、トレンド/エッセイ'
        }
    },
    {
        slug: 'life',
        labels: { ko: '라이프 · 자유', en: 'Life & General', ja: 'ライフ' },
        hint: {
            ko: '일상 기록, 취미, 커피, 건강, 여행 등 키워드 제약 없는 자유 주제',
            en: 'Daily life, hobbies, coffee, health, travel, and general topics',
            ja: '日常記録、趣味、コーヒー、健康、旅行など自由なテーマ'
        }
    }
] as const;

export type HubCategorySlug = (typeof HUB_CATEGORIES)[number]['slug'];

export function isValidHubCategory(slug: string | undefined | null): slug is HubCategorySlug {
    if (!slug) return false;
    return HUB_CATEGORIES.some((c) => c.slug === slug);
}

export function getHubCategoryLabel(slug: string | undefined | null, lang: string = 'ko'): string {
    const found = HUB_CATEGORIES.find((c) => c.slug === slug);
    if (!found) return slug || '';
    const labels = found.labels as Record<string, string>;
    return labels[lang] || labels.ko;
}

/**
 * HTML 또는 Markdown 본문에서 순수 텍스트를 추출
 */
export function extractHubPlainText(content: string | undefined | null, contentType: string = 'html'): string {
    if (!content) return '';
    if (contentType === 'markdown') {
        const parts = content.split(/^---\s*$/m);
        const body = parts.length >= 3 ? parts.slice(2).join('---') : content;
        return body
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]*>/g, '')
            .replace(/[#*`_~-]/g, '')
            .trim();
    }
    return content
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
}

/**
 * 허브 전송용 본문 추출:
 * - 순수 텍스트가 900자 이하이면 전체 텍스트를 그대로 반환
 * - 900자 초과이면 앞 300자 + 중간 300자 + 뒤 300자 (총 900자)로 3등분 추출하여 반환
 */
export function extractThreePartHubContent(content: string | undefined | null, contentType: string = 'html'): string {
    const plain = extractHubPlainText(content, contentType).replace(/\s+/g, ' ').trim();
    if (plain.length <= HUB_SAMPLED_MAX_LENGTH) {
        return plain;
    }
    const partSize = HUB_SAMPLED_PART_LENGTH;
    const head = plain.slice(0, partSize);
    const midStart = Math.floor((plain.length - partSize) / 2);
    const mid = plain.slice(midStart, midStart + partSize);
    const tail = plain.slice(plain.length - partSize);
    return `${head}\n\n${mid}\n\n${tail}`;
}
