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

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

// 1. Blog Settings
export const blogSettings = sqliteTable("blog_settings", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
});

// 2. Categories
export const categories = sqliteTable("categories", {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at").default(sql`(datetime('now', '+9 hours'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now', '+9 hours'))`),
    lang: text("lang").default('ko'),
    translationGroupId: text("translation_group_id"),
}, (table) => [
    primaryKey({ columns: [table.slug, table.lang] })
]);

// 3. Posts
export const posts = sqliteTable("posts", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    content: text("content"),
    excerpt: text("excerpt"),
    status: text("status").default('draft'), // 'draft', 'published', 'archived'
    authorId: text("author_id").notNull(),
    categorySlug: text("category_slug"),
    featuredImage: text("featured_image"),
    tags: text("tags"), // JSON string
    createdAt: text("created_at").default(sql`(datetime('now', '+9 hours'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now', '+9 hours'))`),
    publishedAt: text("published_at"),
    lang: text("lang").default('ko'),
    translationGroupId: text("translation_group_id"),
}, (table) => [
    index("idx_posts_slug").on(table.slug),
    index("idx_posts_status_published").on(table.status, table.publishedAt),
    index("idx_posts_translation_group").on(table.translationGroupId)
]);

// 4. Layouts
export const layouts = sqliteTable("layouts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    columnCount: integer("column_count").default(3),
    columnWidths: text("column_widths").default('1-2-1'),
    mobileColumnCount: integer("mobile_column_count").default(1),
    mobileColumnWidths: text("mobile_column_widths").default('1fr'),
    isActive: integer("is_active", { mode: 'boolean' }).default(false),
    createdAt: text("created_at").default(sql`(datetime('now', '+9 hours'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now', '+9 hours'))`),
});

// 5. Widgets
export const widgets = sqliteTable("widgets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    config: text("config"), // JSON string
    createdAt: text("created_at").default(sql`(datetime('now', '+9 hours'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now', '+9 hours'))`),
});

// 6. Layout Widgets
export const layoutWidgets = sqliteTable("layout_widgets", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    layoutId: integer("layout_id").references(() => layouts.id),
    widgetId: integer("widget_id").references(() => widgets.id),
    columnIndex: integer("column_index").notNull(),
    sortOrder: integer("sort_order").notNull(),
    customTitle: text("custom_title"),
    device: text("device").default('desktop'), // 'desktop' | 'mobile' | 'both'
});

// 7. Visitor Stats
export const visitorStats = sqliteTable("visitor_stats", {
    date: text("date").primaryKey(),
    uniqueVisitors: integer("unique_visitors").default(0),
    pageViews: integer("page_views").default(0),
});

// 8. Post Views
// 8. Post Views (MOVED TO USER_DB)
/*
export const postViews = sqliteTable("post_views", {
    postId: text("post_id").notNull(),
    date: text("date").notNull(),
    views: integer("views").default(0),
}, (table) => [
    primaryKey({ columns: [table.postId, table.date] })
]);
*/

// Obsolete model below for reference (we can remove it once verify all logic is migrated)
// export const themeVariants = sqliteTable("theme_variants", ...);
