<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform" 
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>XML Sitemap</title>
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
            max-width: 900px;
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
            font-size: 1.05em;
          }
          .alert {
            background: #e8f4f8;
            border: 1px solid #b8daff;
            color: #004085;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 25px;
            font-size: 0.95em;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
            font-size: 0.9em;
          }
          th {
            background: #f8f9fa;
            color: #2c3e50;
            font-weight: bold;
            border-bottom: 2px solid #ddd;
          }
          tr:hover {
            background-color: #f8f9fa;
          }
          td a {
            color: #3498db;
            text-decoration: none;
            word-break: break-all;
          }
          td a:hover {
            text-decoration: underline;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            background: #3498db;
            color: white;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 5px;
          }
          .meta-info {
            color: #7f8c8d;
            font-size: 0.85em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>XML Sitemap Index</h1>
            <p class="description">This XML Sitemap is generated for search engines (Google, Bing, Naver, etc.) to crawl and index your site efficiently.</p>
          </header>
          <div class="alert">
            💡 Total Submitted URLs: <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>URL Path</th>
                <th style="width: 180px;">Last Modified</th>
                <th style="width: 100px;">Change Freq</th>
                <th style="width: 70px;">Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td><xsl:value-of select="position()"/></td>
                  <td>
                    <a href="{sitemap:loc}" target="_blank"><xsl:value-of select="sitemap:loc"/></a>
                    <xsl:if test="xhtml:link">
                      <div style="margin-top: 4px;">
                        <xsl:for-each select="xhtml:link">
                          <span class="badge"><xsl:value-of select="@hreflang"/></span>
                        </xsl:for-each>
                      </div>
                    </xsl:if>
                  </td>
                  <td class="meta-info"><xsl:value-of select="sitemap:lastmod"/></td>
                  <td class="meta-info"><xsl:value-of select="sitemap:changefreq"/></td>
                  <td class="meta-info"><xsl:value-of select="sitemap:priority"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
