<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
      <head>
        <title>RSS Feed - <xsl:value-of select="/rss/channel/title"/></title>
        <meta charset="utf-8"/>
        <meta http-equiv="content-type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7f6;
            color: #333;
            line-height: 1.6;
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }
          header {
            border-bottom: 2px solid #eee;
            margin-bottom: 30px;
            padding-bottom: 20px;
          }
          h1 {
            color: #2c3e50;
            margin: 0 0 10px 0;
            font-size: 2.2em;
          }
          .description {
            color: #666;
            font-size: 1.1em;
          }
          .meta-info {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 30px;
            font-size: 0.9em;
            color: #555;
          }
          .item {
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 1px solid #f0f0f0;
          }
          .item:last-child {
            border-bottom: none;
          }
          .item-title {
            font-size: 1.5em;
            margin: 0 0 10px 0;
          }
          .item-title a {
            color: #3498db;
            text-decoration: none;
            font-weight: bold;
          }
          .item-title a:hover {
            text-decoration: underline;
          }
          .item-meta {
            font-size: 0.85em;
            color: #999;
            margin-bottom: 15px;
          }
          .item-content {
            color: #444;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            background: #3498db;
            color: white;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 10px;
          }
          .alert {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert">
            <strong>RSS Feed</strong> 이 페이지는 RSS 구독기를 위한 XML 파일입니다. 이 URL을 RSS 리더(Feedly 등)에 복사하여 구독하실 수 있습니다.
          </div>
          <header>
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p class="description"><xsl:value-of select="/rss/channel/description"/></p>
            <div class="meta-info">
              URL: <a href="{/rss/channel/link}"><xsl:value-of select="/rss/channel/link"/></a><br/>
              마지막 업데이트: <xsl:value-of select="/rss/channel/lastBuildDate"/>
            </div>
          </header>

          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <h2 class="item-title">
                <a href="{link}"><xsl:value-of select="title"/></a>
              </h2>
              <div class="item-meta">
                <span class="badge"><xsl:value-of select="category"/></span>
                발행일: <xsl:value-of select="pubDate"/>
              </div>
              <div class="item-content">
                <xsl:value-of select="description" disable-output-escaping="yes"/>
              </div>
            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
