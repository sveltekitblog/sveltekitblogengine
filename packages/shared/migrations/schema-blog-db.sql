-- SQLite Schema for BLOG_DB (D1)
-- Multi-language supported schema

-- 1. Languages
CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    fallback_message TEXT
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    lang TEXT DEFAULT 'ko',
    translation_group_id TEXT,
    PRIMARY KEY (slug, lang)
);

-- 3. Posts
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    excerpt TEXT,
    type TEXT DEFAULT 'post',
    status TEXT DEFAULT 'draft',
    author_id TEXT NOT NULL,
    category_slug TEXT,
    featured_image TEXT,
    tags TEXT, -- JSON string
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    published_at TEXT,
    lang TEXT DEFAULT 'ko',
    translation_group_id TEXT,
    content_type TEXT DEFAULT 'html',
    content_markdown TEXT,
    thumbnail_fit TEXT DEFAULT 'cover',
    is_syndicated INTEGER DEFAULT 0,
    UNIQUE(lang, slug)
);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_translation_group ON posts(translation_group_id);

-- 4. Layouts
CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    column_count INTEGER DEFAULT 3,
    column_widths TEXT DEFAULT '1-2-1',
    mobile_column_count INTEGER DEFAULT 1,
    mobile_column_widths TEXT DEFAULT '1fr',
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 5. Widgets
CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT, -- JSON string
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 6. Layout Widgets (Mapping layouts to widgets)
CREATE TABLE IF NOT EXISTS layout_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_id INTEGER REFERENCES layouts(id) ON DELETE CASCADE,
    widget_id INTEGER REFERENCES widgets(id) ON DELETE CASCADE,
    column_index INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    custom_title TEXT,
    device TEXT DEFAULT 'desktop',
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 7. Blog Settings (Key-Value)
CREATE TABLE IF NOT EXISTS blog_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 8. Visitor Stats
CREATE TABLE IF NOT EXISTS visitor_stats (
    date TEXT PRIMARY KEY,
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0
);

-- 9. Media Library (R2 images metadata)
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 10. UI Dictionary (Multilingual UI translations)
CREATE TABLE IF NOT EXISTS ui_dictionary (
    key TEXT NOT NULL,
    lang TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    PRIMARY KEY (key, lang)
);
