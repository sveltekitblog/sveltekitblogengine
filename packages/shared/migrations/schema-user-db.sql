-- USER_DB (User & Interaction Database) Schema (Finalized Version)

-- 1. Better Auth Tables
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0 NOT NULL,
    image TEXT,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    updated_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    role TEXT,
    banned INTEGER,
    ban_reason TEXT,
    ban_expires INTEGER,
    show_ban_reason INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    impersonated_by TEXT
);
CREATE INDEX IF NOT EXISTS session_userId_idx ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    password TEXT,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_userId_idx ON account(user_id);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    updated_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

-- 2. Unified Entries (Comments + Guestbook)
CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'comment' | 'guestbook'
    target_id TEXT, -- postId for comments, NULL for guestbook
    user_id TEXT NOT NULL,
    parent_id TEXT,
    content TEXT NOT NULL,
    is_private INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now', '+9 hours'))
);
CREATE INDEX IF NOT EXISTS idx_entries_type_target ON entries(type, target_id);
CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);

CREATE TABLE IF NOT EXISTS deleted_entries (
    id TEXT PRIMARY KEY,
    deleted_by TEXT,
    original_data TEXT,
    deleted_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

CREATE TABLE IF NOT EXISTS deleted_users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    image TEXT,
    deleted_by TEXT, -- 'admin' | 'user' (withdrawal)
    delete_behavior TEXT, -- 'cascade' (all entries deleted) | 'anonymize' (entries kept)
    original_data TEXT, -- JSON backup of original user account metadata
    deleted_at TEXT DEFAULT (datetime('now', '+9 hours'))
);

-- 3. Views and Likes
CREATE TABLE IF NOT EXISTS post_views (
    post_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    views INTEGER DEFAULT 0,
    lang TEXT,
    PRIMARY KEY (post_id, date)
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
