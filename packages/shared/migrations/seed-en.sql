-- BLOG_DB English Initial Seed Data
-- 1. Languages
INSERT OR IGNORE INTO languages (code, name, is_default, sort_order, fallback_message) VALUES
('en', 'English', 1, 1, 'This post is written in English.'),
('ko', '한국어', 0, 2, '이 포스트는 한국어로 작성되었습니다.'),
('ja', '日本語', 0, 3, 'この投稿は日本語で書かれています。');

-- 2. Blog Settings (Pure English Default with Premium Minimal Georgia Layout & Japanese Translations)
INSERT OR IGNORE INTO blog_settings (key, value, updated_at) VALUES
('description', '{"ko":"새로운 블로그에 오신 것을 환영합니다. (설정에서 이 문구를 수정하세요.)","en":"Welcome to the new blog. (Please modify this text in settings.)","ja":"新しいブログへようこそ。（設定でこの文章を修正してください。）"}', datetime('now', '+9 hours')),
('authorName', '{"ko":"블로그 주인 (설정에서 수정)","en":"Blog Owner (Edit in settings)","ja":"ブログオーナー（設定で修正）"}', datetime('now', '+9 hours')),
('siteUrl', '', datetime('now', '+9 hours')),
('theme', '{"primary":"#0f172a","secondary":"#64748b","bodyBackground":{"type":"solid","value":"#ffffff","jsCode":"","jsConfig":{},"opacity":1,"blur":0,"layerBlur":0,"overlayColor":"#000000","overlayOpacity":0,"allowMobile":false,"fallbackColor":""},"text":"#1c1917","accent":"#0f172a","cardBg":"transparent","border":"#e7e5e4","sideMargin":"2rem","fontFamily":"Noto Serif KR, serif","googleFontName":"Noto Serif KR, Newsreader","baseFontSize":"16px","maxWidth":"1200px","widgetItemStyle":{"fontSize":"0.95rem","fontWeight":"600","color":"","fontFamily":"","padding":"1.5rem"},"widgetTitleStyle":{"fontSize":"1.1rem","fontWeight":"700","color":"","fontFamily":""}}', datetime('now', '+9 hours')),
('header', '{"logoFont":"Newsreader","logoFontSize":"1.4rem","logoAlignment":"center","sideMargin":"2rem","logoPadding":{"top":30,"right":0,"bottom":30,"left":0},"navPadding":{"top":0,"right":0,"bottom":0,"left":0},"logoColor":{"type":"gradient","value":"linear-gradient(90deg, #3b82f6, #06b6d4)","jsCode":"","jsConfig":{},"opacity":1,"blur":0,"layerBlur":0,"overlayColor":"oklch(0% 0 0)","overlayOpacity":0,"allowMobile":false,"fallbackColor":""},"logoHoverEffect":"scale","logoHoverScale":1.02,"logoHoverColor":{"type":"solid","value":""},"logoHoverFloatOffset":2,"logoHoverShadowEnabled":false,"logoHoverShadowColor":{"type":"solid","value":"rgba(59, 130, 246, 0.2)"},"logoFontWeight":"700","logoLetterSpacing":"0px","navAlignment":"center","headerLayout":"two-line","logoVerticalAlignment":"top","navVerticalAlignment":"bottom","scrolledLogoVerticalAlignment":"middle","scrolledLogoAlignment":"left","scrolledNavAlignment":"right","scrolledNavVerticalAlignment":"bottom","scrolledHeight":"80px","scrolledMaxWidth":"1200px","scrolledNavSpacing":"1rem","scrolledLogoPadding":{"top":0,"right":0,"bottom":0,"left":10},"scrolledNavPadding":{"top":0,"right":0,"bottom":10,"left":2},"navSpacing":"2rem","navTextColor":"#57534e","navHoverBackground":{"type":"solid","value":"transparent"},"navHoverTextColor":"#1c1917","showCategories":false,"showLanguageSwitcher":true,"headerBackground":{"type":"solid","value":"#ffffff","jsCode":"","jsConfig":{},"opacity":1,"blur":0,"layerBlur":0,"overlayColor":"#000000","overlayOpacity":0,"allowMobile":false,"fallbackColor":""},"headerBackgroundBlur":0,"headerBackgroundOpacity":1,"useBottomFade":false,"bottomFadeStrength":20,"useTextShadow":false,"headerBackgroundOverlayColor":"#000000","headerBackgroundOverlayOpacity":0,"height":"8rem","borderRadius":{"topLeft":0,"topRight":0,"bottomLeft":0,"bottomRight":0},"boxShadow":"0px 0px 0px 0px oklch(62.31% 0.188 259.81)","logoText":{"ko":"My Blog","en":"My Blog","ja":"My Blog"},"menuItems":[{"id":1,"type":"category_drawer","label":{"ko":"카테고리","en":"Categories","ja":"カテゴリー"},"url":"/","icon":"Menu"},{"id":2,"type":"link","label":{"ko":"방명록","en":"Guestbook","ja":"ゲストブック"},"url":"/guestbook","icon":"MessageSquare"}]}', datetime('now', '+9 hours')),
('footer', '{"navFontSize":"0.85rem","navColor":"#44403c","navHoverColor":"#1c1917","footerBackground":{"type":"solid","value":"#ffffff","jsCode":"","jsConfig":{},"opacity":1,"blur":0,"layerBlur":0,"overlayColor":"#000000","overlayOpacity":0,"allowMobile":false,"fallbackColor":""},"text":{"color":"#57534e","fontSize":"0.85rem"},"borderRadius":{"topLeft":0,"topRight":0,"bottomLeft":0,"bottomRight":0},"boxShadow":"0px 0px 0px 0px #3b82f6","footerBackgroundBlur":0,"footerBackgroundOpacity":1,"shareDesign":true,"copyright":{"ko":"© 2026 My Blog. All rights reserved.","en":"© 2026 My Blog. All rights reserved.","ja":"© 2026 My Blog. All rights reserved."},"socialLinks":[],"navLinks":[]}', datetime('now', '+9 hours')),
('auth_providers', '[]', datetime('now', '+9 hours')),
('widget_shadow_global', '{"enabled":false,"normal":"none","hover":"none","hoverTranslateY":0}', datetime('now', '+9 hours')),
('enable_cdn_cache', 'false', datetime('now', '+9 hours')),
('cdn_cache_ttl', '86400', datetime('now', '+9 hours'));

-- 3. Layouts (1-Column Minimal)
INSERT OR IGNORE INTO layouts (id, name, column_count, column_widths, mobile_column_count, mobile_column_widths, is_active) VALUES
(1, 'Minimal Single Layout', 1, '1fr', 1, '1fr', 1);

-- 4. Widgets
INSERT OR IGNORE INTO widgets (id, name, type, config) VALUES
(1, 'Recent Posts', 'RecentPosts', '{}'),
(2, 'Categories', 'CategoryMenu', '{}'),
(3, 'Popular Posts', 'PopularPosts', '{}'),
(4, 'Tags', 'TagCloud', '{"mobile":{"sortOrder":"popular","maxTags":10},"desktop":{"sortOrder":"popular","maxTags":20}}'),
(5, 'Main Content', 'PostContent', '{"desktop":{"columns":1,"layout":"horizontal","imageRatio":25,"badgeBg":"#e2e8f0","badgeColor":"#475569","cardBg":"transparent","cardTextColor":"#1c1917","cardFontSize":"1rem","itemsPerPage":7,"hoverEffect":"none","paginationStyle":"default","cardHeight":"250px"},"mobile":{"columns":1,"layout":"horizontal","imageRatio":20,"badgeBg":"#e2e8f0","badgeColor":"#475569","cardBg":"transparent","cardTextColor":"#1c1917","cardFontSize":"0.8rem","itemsPerPage":5,"hoverEffect":"none","paginationStyle":"default","cardHeight":"175px"}}');

-- 5. Layout Widgets Mapping (Minimal Single Setup)
INSERT OR IGNORE INTO layout_widgets (layout_id, widget_id, column_index, sort_order, custom_title, device) VALUES
(1, 5, 0, 1, '{"ko":"저널","en":"Journal","ja":"ジャーナル"}', 'desktop'),
(1, 4, 0, 1, '{"ko":"태그","en":"","ja":"タグ"}', 'desktop'),
(1, 5, 0, 0, '{"ko":"저널","en":"Journal","ja":"ジャーナル"}', 'mobile'),
(1, 4, 0, 1, '{"ko":"태그","en":"","ja":"タグ"}', 'mobile');
