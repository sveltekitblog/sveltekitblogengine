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
    allowMobile?: boolean;
    mobile?: Omit<BackgroundConfig, 'mobile'>;
}

export interface ThemeConfig {
    colors: {
        primary: string;
        secondary: string;
        background: string;
        surface: string;
        text: string;
    };
    fonts: {
        heading: string;
        body: string;
    };
    header: {
        type: 'fixed' | 'sticky' | 'static';
        height: string;
        logo: {
            type: 'text' | 'image';
            content: string;
            url?: string;
        };
        nav: Array<{ label: string; href: string }>;
    };
    layout: {
        maxWidth: string;
        sidebar: 'none' | 'left' | 'right';
        gridColumns: number;
    };
}

export interface ThemeVariant {
    id: string;
    name: string;
    description?: string;
    is_system: boolean;
    config: ThemeConfig;
    created_at: string;
    updated_at: string;
}

export const DEFAULT_THEME: ThemeConfig = {
    colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#ffffff',
        surface: '#f3f4f6',
        text: '#1f2937'
    },
    fonts: {
        heading: 'Inter',
        body: 'Inter'
    },
    header: {
        type: 'sticky',
        height: '64px',
        logo: {
            type: 'text',
            content: 'My Blog'
        },
        nav: [
            { label: 'Home', href: '/' },
            { label: 'Categories', href: '/categories' }
        ]
    },
    layout: {
        maxWidth: '1200px',
        sidebar: 'none',
        gridColumns: 3
    }
};

export interface Post {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    type: 'post' | 'page';
    status: 'draft' | 'published' | 'archived';
    published_at?: string;
    author_id: string;
    category_slug?: string;
    featured_image?: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    content_type?: 'html' | 'markdown';
    content_markdown?: string;
    thumbnail_fit?: 'cover' | 'contain';
}
