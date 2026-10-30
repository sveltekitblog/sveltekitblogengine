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

/** 여러 날짜 범위를 단 1개의 GraphQL Alias 쿼리로 결합하는 쿼리 빌더 */
function buildMultiDayRumQuery(dates: string[]): string {
  const variableDecls = dates.map((_, i) => `$from_${i}: Time!, $to_${i}: Time!`).join(', ');
  const fragments = dates.map((_, i) => `
    day_${i}_traffic: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: 100) {
      count sum { visits } avg { sampleInterval }
    }
    day_${i}_pages: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { requestPath }
    }
    day_${i}_referrers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { refererHost }
    }
    day_${i}_countries: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { countryName }
    }
    day_${i}_devices: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { deviceType }
    }
    day_${i}_browsers: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { userAgentBrowser }
    }
    day_${i}_os: rumPageloadEventsAdaptiveGroups(filter: {siteTag: $siteTag, datetime_geq: $from_${i}, datetime_leq: $to_${i}}, limit: ${DETAIL_LIMIT}) {
      count sum { visits } avg { sampleInterval } dimensions { userAgentOS }
    }
  `).join('\n');

  return `
query GetMultiDayRum($accountTag: String!, $siteTag: String!, ${variableDecls}) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      ${fragments}
    }
  }
}`;
}

/** DB에서 사이트 대표 시간대 조회 (기본값: UTC) */
async function getSiteTimezone(db: D1Database): Promise<string> {
  try {
    const row = await db.prepare('SELECT value FROM blog_settings WHERE key = ?').bind('timezone').first<{ value: string }>();
    return row?.value?.trim() || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 사이트 대표 시간대 기준 YYYY-MM-DD 날짜 문자열 산출 */
function getSiteDateStr(timeZone: string, offsetDays = 0): string {
  try {
    const target = new Date(Date.now() + offsetDays * 86400 * 1000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(target);
  } catch {
    const target = new Date(Date.now() + offsetDays * 86400 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(target);
  }
}

/** 사이트 시간대 기준 과거 N일치 날짜 목록 생성 */
function getSiteDatesEndingToday(timeZone: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => getSiteDateStr(timeZone, -(days - i - 1)));
}

/** 특정 IANA 시간대의 UTC 대비 오프셋(ms) 계산 */
function getTimezoneOffsetMs(timeZone: string, refDate: Date): number {
  try {
    const utcDate = new Date(refDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(refDate.toLocaleString('en-US', { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
  } catch {
    return 0;
  }
}

/** 임의의 IANA 시간대 기준 특정 날짜의 00:00:00 ~ 23:59:59.999 범위를 UTC ISO로 변환 */
function getSiteDayRangeUtc(dateStr: string, timeZone: string): { from: string; to: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const baseUtcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMs = getTimezoneOffsetMs(timeZone, new Date(baseUtcMidnight));

  const fromUtc = new Date(baseUtcMidnight - offsetMs);
  const toUtc = new Date(baseUtcMidnight + 86400 * 1000 - 1 - offsetMs);
  const now = new Date();
  const effectiveTo = toUtc > now ? now : toUtc;
  return { from: fromUtc.toISOString(), to: effectiveTo.toISOString() };
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

/** 지수 백오프(1s→2s→4s) 재시도. 네트워크/GraphQL 일시 오류 대응 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchMultiDaySnapshots(env: Env, dates: string[], timeZone: string): Promise<DailySnapshot[]> {
  if (dates.length === 0) return [];
  const query = buildMultiDayRumQuery(dates);
  const variables: Record<string, string> = {
    accountTag: env.CF_ACCOUNT_ID,
    siteTag: env.CF_WEB_ANALYTICS_SITE_TAG
  };
  for (let i = 0; i < dates.length; i++) {
    const range = getSiteDayRangeUtc(dates[i], timeZone);
    variables[`from_${i}`] = range.from;
    variables[`to_${i}`] = range.to;
  }

  const response = await withRetry(() =>
    fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: JSON.stringify({ query, variables })
    })
  );

  if (!response.ok) throw new Error(`CFA multi-day request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as any;
  if (payload.errors?.length) throw new Error(payload.errors.map((item: any) => item.message).join(', '));
  const data = payload.data?.viewer?.accounts?.[0];
  if (!data) throw new Error('CFA returned no account data');

  const dimensionKey: Record<DetailName, string> = {
    pages: 'requestPath', referrers: 'refererHost', countries: 'countryName',
    devices: 'deviceType', browsers: 'userAgentBrowser', os: 'userAgentOS'
  };

  const snapshots: DailySnapshot[] = [];

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    const snapshot: DailySnapshot = {
      date: dateStr,
      pageViews: 0,
      visitors: 0,
      details: { pages: [], referrers: [], countries: [], devices: [], browsers: [], os: [] },
      sampleInterval: 1,
      isExact: true
    };

    const trafficRows = data[`day_${i}_traffic`] || [];
    for (const row of trafficRows) {
      snapshot.pageViews += asCount(row.count);
      snapshot.visitors += asCount(row.sum?.visits);
      const interval = asSampleInterval(row.avg?.sampleInterval);
      snapshot.sampleInterval = Math.max(snapshot.sampleInterval, interval);
      snapshot.isExact &&= interval === 1;
    }

    for (const name of DETAIL_NAMES) {
      const rows = data[`day_${i}_${name}`] || [];
      if (rows.length >= DETAIL_LIMIT) {
        throw new Error(`CFA ${name} result reached ${DETAIL_LIMIT} row limit on ${dateStr}; refusing incomplete snapshot`);
      }
      for (const row of rows) {
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

    // ── CFA 응답 완전 붕괴 방어 가드 ──────────────────────────────────────
    if (snapshot.pageViews > 0) {
      const allEmpty = DETAIL_NAMES.every((name) => snapshot.details[name].length === 0);
      if (allEmpty) {
        console.warn(`[CFA] Corrupted snapshot for ${dateStr}: all dimensions empty while pageViews=${snapshot.pageViews}; skipping`);
        continue;
      }
    }

    snapshots.push(snapshot);
  }

  return snapshots;
}

async function sync(env: Env): Promise<{ bootstrap: boolean; written: number }> {
  const state = await env.BLOG_DB.prepare('SELECT initialized_at FROM cf_sync_state WHERE id = 1').first();
  const timeZone = await getSiteTimezone(env.BLOG_DB);
  const lastTzRow = await env.BLOG_DB.prepare("SELECT value FROM blog_settings WHERE key = 'cfa_synced_timezone'").first<{ value: string }>();
  const isTimezoneChanged = Boolean(lastTzRow && lastTzRow.value !== timeZone);
  const bootstrap = !state || isTimezoneChanged;
  // 과거 7일간의 CFA 보정 데이터를 일치시키기 위해 항상 최근 7일치를 단일 호출로 동기화
  const dates = getSiteDatesEndingToday(timeZone, 7);
  const todayStr = getSiteDateStr(timeZone, 0);
  const snapshots = await fetchMultiDaySnapshots(env, dates, timeZone);
  const existingHashes = new Map<string, string>();
  const existingViews = new Map<string, number>();
  const placeholders = dates.map(() => '?').join(', ');
  const existingRows = await env.BLOG_DB.prepare(
    `SELECT date, page_views, data_hash FROM cf_daily_snapshots WHERE date IN (${placeholders})`
  ).bind(...dates).all<{ date: string; page_views: number; data_hash: string }>();
  for (const row of existingRows.results || []) {
    existingHashes.set(row.date, row.data_hash);
    existingViews.set(row.date, Number(row.page_views) || 0);
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let written = 0;
  for (const snapshot of snapshots) {
    // 오늘(Today) 진행형 데이터 역행(조회수 축소) 방지 가드:
    // API 일시 오류 등으로 오늘 데이터가 기존 수치보다 비정상적으로 줄어든 경우 덮어쓰지 않고 스킵
    const isToday = snapshot.date === todayStr;
    const prevViews = existingViews.get(snapshot.date);
    if (isToday && prevViews !== undefined && snapshot.pageViews < prevViews) {
      console.warn(`[CFA] Regression detected for today (${snapshot.date}): new(${snapshot.pageViews}) < existing(${prevViews}). Skipping update to protect data.`);
      continue;
    }

    const detailsJson = JSON.stringify(canonicalDetails(snapshot.details));
    const hash = await sha256(JSON.stringify({
      pageViews: snapshot.pageViews,
      visitors: snapshot.visitors,
      details: JSON.parse(detailsJson),
      sampleInterval: snapshot.sampleInterval,
      isExact: snapshot.isExact
    }));
    if (existingHashes.get(snapshot.date) === hash) continue;
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
  statements.push(env.BLOG_DB.prepare(`
    INSERT INTO blog_settings (key, value, updated_at) VALUES ('cfa_synced_timezone', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(timeZone, now));
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
    // 에러는 cf_sync_state.last_error에 기록되므로 rethrow 하지 않음
    // rethrow 시 Cloudflare가 scriptThrewException으로 집계하여 오류율 100% 표시됨
    ctx.waitUntil(runSync(env).catch(() => {}));
  }
} satisfies ExportedHandler<Env>;
