-- BLOG_DB (Content Database) Schema (Finalized Version)

-- 1. Blog Settings
CREATE TABLE IF NOT EXISTS blog_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    slug TEXT,
    lang TEXT DEFAULT 'ko',
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
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

-- 6. Layout Widgets
CREATE TABLE IF NOT EXISTS layout_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_id INTEGER REFERENCES layouts(id),
    widget_id INTEGER REFERENCES widgets(id),
    column_index INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    custom_title TEXT,
    device TEXT DEFAULT 'both'
);

-- 7. Visitor Stats
CREATE TABLE IF NOT EXISTS visitor_stats (
    date TEXT PRIMARY KEY,
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0
);

-- 8. Languages
CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    fallback_message TEXT
);

-- (Initial Seed Data has been decoupled and moved to seed-ko.sql, seed-en.sql, and seed-ja.sql)
