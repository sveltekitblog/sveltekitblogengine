-- SQLite Schema for BLOG_DB (D1)
-- Multi-language & Multi-tenant supported schema

-- 0. Tenants (블로그 인스턴스/도메인 매핑)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    custom_domain TEXT UNIQUE,
    owner_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 1. Languages
CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    tenant_id TEXT NOT NULL DEFAULT 'default',
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    lang TEXT DEFAULT 'ko',
    translation_group_id TEXT,
    PRIMARY KEY (tenant_id, slug, lang)
);

-- 3. Posts
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
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
    UNIQUE(tenant_id, lang, slug)
);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_slug ON posts(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_status ON posts(tenant_id, status, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_trans ON posts(tenant_id, translation_group_id);

-- 4. Layouts
CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    column_count INTEGER DEFAULT 3,
    column_widths TEXT DEFAULT '1-2-1',
    mobile_column_count INTEGER DEFAULT 1,
    mobile_column_widths TEXT DEFAULT '1fr',
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours'))
);
CREATE INDEX IF NOT EXISTS idx_layouts_tenant ON layouts(tenant_id);

-- 5. Widgets
CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    layout_id INTEGER NOT NULL,
    column_index INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    is_visible INTEGER DEFAULT 1,
    config TEXT, -- JSON configuration
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE
);

-- 6. Blog Settings (Key-Value)
CREATE TABLE IF NOT EXISTS blog_settings (
    tenant_id TEXT NOT NULL DEFAULT 'default',
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    PRIMARY KEY (tenant_id, key)
);

-- 7. Media Library (R2 images metadata)
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 8. UI Dictionary (Multilingual UI translations)
CREATE TABLE IF NOT EXISTS ui_dictionary (
    key TEXT NOT NULL,
    lang TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', '+9 hours')),
    updated_at TEXT DEFAULT (datetime('now', '+9 hours')),
    PRIMARY KEY (key, lang)
);

-- 9. Visitor Stats
CREATE TABLE IF NOT EXISTS visitor_stats (
    tenant_id TEXT NOT NULL DEFAULT 'default',
    date TEXT NOT NULL,
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    PRIMARY KEY (tenant_id, date)
);

-- 기본 테넌트 초기화
INSERT OR IGNORE INTO tenants (id, slug, name, status) VALUES ('default', 'default', '메인 블로그', 'active');
