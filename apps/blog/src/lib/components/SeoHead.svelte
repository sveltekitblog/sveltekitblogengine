<!--
 Copyright (C) 2026 kimteamjang

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<script lang="ts">
    import { page } from '$app/state';

    let { seo, settings } = $props();
    const dbDefaultLang = $derived(page.data.dbDefaultLang || 'ko');
    const lang = $derived(page.data.lang || dbDefaultLang);

    // Helper: Normalize translation
    function getTrans(val: any, targetLang: string) {
        if (!val) return "";
        if (typeof val === 'string' && val.startsWith('{')) {
            try {
                const parsed = JSON.parse(val);
                return parsed[targetLang] || parsed[dbDefaultLang] || val;
            } catch(e) { return val; }
        }
        if (typeof val === 'object' && val !== null) {
            return val[targetLang] || val[dbDefaultLang] || Object.values(val)[0] || "";
        }
        return val;
    }

    const siteTitle = $derived(
        getTrans(settings?.header?.logoText, lang) || getTrans(settings?.site_title, lang) || "Blog"
    );
    const siteDescription = $derived(getTrans(settings?.description, lang) || "");

    const title = $derived(seo?.title || siteTitle);
    const description = $derived(seo?.description || siteDescription);
    const url = $derived(seo?.url || "");
    const image = $derived(seo?.image || settings?.logo || "");
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={description} />

    <meta property="og:type" content="website" />
    <meta property="og:url" content={url} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={image} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content={siteTitle} />
    <meta property="og:locale" content={lang === "ko" ? "ko_KR" : lang} />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content={url} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={image} />

    {#if url}
        <link rel="canonical" href={url} />
    {/if}

    {#if seo?.alternates && seo.alternates.length > 0}
        {#each seo.alternates as alt}
            <link rel="alternate" hreflang={alt.lang} href={alt.url} />
        {/each}
        <link rel="alternate" hreflang="x-default" href={seo?.xDefaultUrl || url} />
    {/if}

    {#if seo?.jsonLd}
        {@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
    {/if}
</svelte:head>
