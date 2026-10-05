interface Env {
  BLOG_DB: D1Database;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_WEB_ANALYTICS_SITE_TAG: string;
}

type DetailName = 'pages' | 'referrers' | 'countries' | 'devices' | 'browsers' | 'os';

interface DetailItem {
  name: string;
  views: number;
  visitors: number;
  sampleInterval: number;
}

interface DailySnapshot {
  date: string;
  pageViews: number;
  visitors: number;
  details: Record<DetailName, DetailItem[]>;
  sampleInterval: number;
  isExact: boolean;
}

const DETAIL_NAMES: DetailName[] = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os'];
const DETAIL_LIMIT = 10_000;

// Each detailed alias is grouped by date. Do not lower DETAIL_LIMIT silently: an
// incomplete result must fail instead of becoming a misleading historical record.
const RUM_QUERY = `
query GetDailyRum($accountTag: String!, $siteTag: String!, $from: Time!, $to: Time!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      traffic: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: 100) {
        count sum { visits } avg { sampleInterval } dimensions { date }
      }
      pages: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date requestPath }
      }
      referrers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date refererHost }
      }
      countries: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date countryName }
      }
      devices: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date deviceType }
      }
      browsers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date userAgentBrowser }
      }
      os: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to}, limit: ${DETAIL_LIMIT}) {
        count sum { visits } avg { sampleInterval } dimensions { date userAgentOS }
      }
    }
  }
}`;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function datesEndingToday(days: number): string[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(today);
    value.setUTCDate(today.getUTCDate() - (days - index - 1));
    return isoDate(value);
  });
}

function asDate(value: unknown): string {
  const raw = String(value ?? '');
  return raw.slice(0, 10);
}

function asCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function asSampleInterval(value: unknown): number {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function canonicalDetails(details: Record<DetailName, DetailItem[]>): Record<DetailName, DetailItem[]> {
  const result = {} as Record<DetailName, DetailItem[]>;
  for (const name of DETAIL_NAMES) {
    result[name] = [...details[name]].sort((left, right) =>
      left.name.localeCompare(right.name) || left.views - right.views || left.visitors - right.visitors
    );
  }
  return result;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchSnapshots(env: Env, dates: string[]): Promise<DailySnapshot[]> {
  const from = `${dates[0]}T00:00:00Z`;
  const to = `${dates[dates.length - 1]}T23:59:59Z`;
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CF_API_TOKEN}` },
    body: JSON.stringify({
      query: RUM_QUERY,
      variables: { accountTag: env.CF_ACCOUNT_ID, siteTag: env.CF_WEB_ANALYTICS_SITE_TAG, from, to }
    })
  });

  if (!response.ok) throw new Error(`CFA request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as any;
  if (payload.errors?.length) throw new Error(payload.errors.map((item: any) => item.message).join(', '));
  const data = payload.data?.viewer?.accounts?.[0];
  if (!data) throw new Error('CFA returned no account data');

  for (const name of DETAIL_NAMES) {
    if ((data[name] || []).length >= DETAIL_LIMIT) {
      throw new Error(`CFA ${name} result reached the ${DETAIL_LIMIT} row safety limit; refusing incomplete snapshot`);
    }
  }

  const byDate = new Map<string, DailySnapshot>();
  for (const date of dates) {
    byDate.set(date, {
      date,
      pageViews: 0,
      visitors: 0,
      details: { pages: [], referrers: [], countries: [], devices: [], browsers: [], os: [] },
      sampleInterval: 1,
      isExact: true
    });
  }

  for (const row of data.traffic || []) {
    const snapshot = byDate.get(asDate(row.dimensions?.date));
    if (!snapshot) continue;
    snapshot.pageViews = asCount(row.count);
    snapshot.visitors = asCount(row.sum?.visits);
    const interval = asSampleInterval(row.avg?.sampleInterval);
    snapshot.sampleInterval = Math.max(snapshot.sampleInterval, interval);
    snapshot.isExact &&= interval === 1;
  }

  const dimensionKey: Record<DetailName, string> = {
    pages: 'requestPath', referrers: 'refererHost', countries: 'countryName',
    devices: 'deviceType', browsers: 'userAgentBrowser', os: 'userAgentOS'
  };
  for (const name of DETAIL_NAMES) {
    for (const row of data[name] || []) {
      const snapshot = byDate.get(asDate(row.dimensions?.date));
      if (!snapshot) continue;
      const rawName = String(row.dimensions?.[dimensionKey[name]] ?? '').trim();
      const fallback = name === 'referrers' ? 'Direct / None' : 'Unknown';
      const interval = asSampleInterval(row.avg?.sampleInterval);
      snapshot.details[name].push({
        name: rawName || fallback,
        views: asCount(row.count),
        visitors: asCount(row.sum?.visits),
        sampleInterval: interval
      });
      snapshot.sampleInterval = Math.max(snapshot.sampleInterval, interval);
      snapshot.isExact &&= interval === 1;
    }
  }
  return [...byDate.values()];
}

async function sync(env: Env): Promise<{ bootstrap: boolean; written: number }> {
  const state = await env.BLOG_DB.prepare('SELECT initialized_at FROM cf_sync_state WHERE id = 1').first();
  const bootstrap = !state;
  const dates = datesEndingToday(bootstrap ? 7 : 2);
  const snapshots = await fetchSnapshots(env, dates);
  const existing = new Map<string, string>();
  const placeholders = dates.map(() => '?').join(', ');
  const existingRows = await env.BLOG_DB.prepare(
    `SELECT date, data_hash FROM cf_daily_snapshots WHERE date IN (${placeholders})`
  ).bind(...dates).all<{ date: string; data_hash: string }>();
  for (const row of existingRows.results || []) existing.set(row.date, row.data_hash);

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let written = 0;
  for (const snapshot of snapshots) {
    const detailsJson = JSON.stringify(canonicalDetails(snapshot.details));
    const hash = await sha256(JSON.stringify({
      pageViews: snapshot.pageViews,
      visitors: snapshot.visitors,
      details: JSON.parse(detailsJson),
      sampleInterval: snapshot.sampleInterval,
      isExact: snapshot.isExact
    }));
    if (existing.get(snapshot.date) === hash) continue;
    statements.push(env.BLOG_DB.prepare(`
      INSERT INTO cf_daily_snapshots
        (date, page_views, visitors, details_json, data_hash, sample_interval, is_exact, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        page_views = excluded.page_views,
        visitors = excluded.visitors,
        details_json = excluded.details_json,
        data_hash = excluded.data_hash,
        sample_interval = excluded.sample_interval,
        is_exact = excluded.is_exact,
        fetched_at = excluded.fetched_at
    `).bind(snapshot.date, snapshot.pageViews, snapshot.visitors, detailsJson, hash, snapshot.sampleInterval, snapshot.isExact ? 1 : 0, now));
    statements.push(env.BLOG_DB.prepare(`
      INSERT INTO visitor_stats (date, unique_visitors, page_views)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET unique_visitors = excluded.unique_visitors, page_views = excluded.page_views
    `).bind(snapshot.date, snapshot.visitors, snapshot.pageViews));
    written++;
  }
  statements.push(env.BLOG_DB.prepare(`
    INSERT INTO cf_sync_state (id, initialized_at, last_synced_at, last_error)
    VALUES (1, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_error = NULL
  `).bind(now, now));
  await env.BLOG_DB.batch(statements);
  return { bootstrap, written };
}

async function runSync(env: Env): Promise<{ bootstrap: boolean; written: number }> {
  try {
    return await sync(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();
    await env.BLOG_DB.prepare(`
      INSERT INTO cf_sync_state (id, initialized_at, last_synced_at, last_error)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_error = excluded.last_error
    `).bind(now, now, message).run();
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization') || '';
    const queryKey = url.searchParams.get('key') || '';
    if (authHeader !== `Bearer ${env.CF_API_TOKEN}` && queryKey !== env.CF_API_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      const result = await runSync(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSync(env));
  }
} satisfies ExportedHandler<Env>;
