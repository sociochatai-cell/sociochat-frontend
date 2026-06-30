/**
 * WhatsApp Persistent Cache
 * =========================
 *
 * A small, self-contained, localStorage-backed cache for the WhatsApp module.
 *
 * Why this exists:
 *   The WhatsApp module fetched everything on every mount. Its in-memory caches
 *   (`useDataCache`, the inbox singleton store) survive in-app navigation but are
 *   wiped on a full page reload / reopening the tab — so reopening always hit the
 *   backend and showed a loading screen. This layer persists API results to
 *   localStorage so a reopen paints instantly from cache, then revalidates.
 *
 * Properties:
 *   - Versioned key prefix  → a bump invalidates every old entry on deploy.
 *   - TTL / hard max-age     → never serve indefinitely-stale data.
 *   - Size guard             → never persist oversized payloads (keeps startup fast,
 *                              avoids blowing the localStorage quota).
 *   - Quota-safe writes      → on QuotaExceeded, evict the oldest WhatsApp entries
 *                              and retry once.
 *   - clearWhatsAppCache()   → drop everything on logout / workspace switch.
 *
 * Two consumers build on this:
 *   - `useDataCache` (hydrate + write-through)            → reactive hook usage.
 *   - `cachedFetch`  (cache-first drop-in `fetch` wrapper) → raw-fetch pages.
 */

import { getWorkspaceId } from './workspaceContext';

const VERSION = 'v1';
const PREFIX = `wa_cache:${VERSION}:`;

/** Payloads larger than this are not persisted (kept in memory only by the caller). */
const MAX_ENTRY_BYTES = 512 * 1024; // 512 KB
/** Entries older than this are treated as a cache miss (and purged on read). */
export const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours

interface StoredEntry<T> {
    data: T;
    /** epoch ms when written */
    ts: number;
    /** workspace id at write time (debug / future namespacing) */
    ws: string | null;
}

function storageKey(key: string): string {
    return PREFIX + key;
}

function isStorageAvailable(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

/**
 * Read a cached entry. Returns null on miss, parse error, if older than maxAgeMs
 * (in which case the stale entry is purged), or if the entry was written under a
 * different workspace than the one currently active (cross-workspace bleed guard).
 *
 * The workspace guard matters for non-URL-scoped keys (e.g. `useDataCache` keys like
 * `accounts`/`flows`) which — unlike cachedFetch's `http:` keys that bake `workspace_id`
 * into the URL — carry no workspace in the key itself. We only treat a stored `ws` as a
 * mismatch when both it and the current workspace id are present and differ, so legacy
 * entries (or reads taken before the workspace id resolves) are not spuriously dropped.
 */
export function readCache<T>(key: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): { data: T; ts: number } | null {
    if (!isStorageAvailable()) return null;
    try {
        const raw = window.localStorage.getItem(storageKey(key));
        if (!raw) return null;
        const entry = JSON.parse(raw) as StoredEntry<T>;
        if (!entry || typeof entry.ts !== 'number') return null;
        if (Date.now() - entry.ts > maxAgeMs) {
            window.localStorage.removeItem(storageKey(key));
            return null;
        }
        const currentWs = getWorkspaceId();
        if (entry.ws && currentWs && entry.ws !== currentWs) {
            // Belongs to a different workspace — treat as a miss (and purge it).
            window.localStorage.removeItem(storageKey(key));
            return null;
        }
        return { data: entry.data, ts: entry.ts };
    } catch {
        return null;
    }
}

/** Persist a value. No-ops on oversized payloads. Quota-safe (evicts oldest WA entries and retries once). */
export function writeCache<T>(key: string, data: T): void {
    if (!isStorageAvailable()) return;
    let serialized: string;
    try {
        const entry: StoredEntry<T> = { data, ts: Date.now(), ws: getWorkspaceId() };
        serialized = JSON.stringify(entry);
    } catch {
        return; // non-serializable
    }
    if (serialized.length > MAX_ENTRY_BYTES) return; // too big to persist

    try {
        window.localStorage.setItem(storageKey(key), serialized);
    } catch {
        // Likely QuotaExceededError — free up space and retry once.
        evictOldest(Math.ceil(allKeys().length / 2));
        try {
            window.localStorage.setItem(storageKey(key), serialized);
        } catch {
            /* give up silently — cache is best-effort */
        }
    }
}

export function removeCache(key: string): void {
    if (!isStorageAvailable()) return;
    try {
        window.localStorage.removeItem(storageKey(key));
    } catch {
        /* ignore */
    }
}

/** All raw localStorage keys belonging to this cache. */
function allKeys(): string[] {
    if (!isStorageAvailable()) return [];
    const keys: string[] = [];
    try {
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(PREFIX)) keys.push(k);
        }
    } catch {
        /* ignore */
    }
    return keys;
}

/** Evict the N oldest WhatsApp cache entries. */
function evictOldest(count: number): void {
    if (count <= 0) return;
    const entries: Array<{ k: string; ts: number }> = [];
    for (const k of allKeys()) {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(k) || '{}');
            entries.push({ k, ts: typeof parsed?.ts === 'number' ? parsed.ts : 0 });
        } catch {
            entries.push({ k, ts: 0 });
        }
    }
    entries.sort((a, b) => a.ts - b.ts);
    for (const { k } of entries.slice(0, count)) {
        try {
            window.localStorage.removeItem(k);
        } catch {
            /* ignore */
        }
    }
}

/**
 * Remove every WhatsApp cache entry. Call on logout or when switching workspace/account
 * so cached data from one workspace never bleeds into another.
 */
export function clearWhatsAppCache(keyPattern?: string): void {
    for (const k of allKeys()) {
        if (keyPattern && !k.includes(keyPattern)) continue;
        try {
            window.localStorage.removeItem(k);
        } catch {
            /* ignore */
        }
    }
}

// ============================================================
// cachedFetch — cache-first drop-in replacement for fetch (GET only)
// ============================================================

interface CachedHttpResponse {
    status: number;
    statusText: string;
    body: string;
    contentType: string;
}

export interface CachedFetchInit extends RequestInit {
    /** Cached entry is considered fresh for this long; older triggers a non-blocking background revalidate. Default 30s. */
    waStaleMs?: number;
    /** Entries older than this are ignored (blocking refetch). Default 6h. */
    waMaxAgeMs?: number;
    /** Override the cache key (defaults to the request URL). Use when the URL has volatile params that shouldn't affect identity. */
    waCacheKey?: string;
    /** Skip the cache entirely for this call (always hits the network). */
    waBypass?: boolean;
    /** Invoked with a fresh Response when a background revalidation returns changed data — lets a page update reactively if it wants to. */
    waOnRevalidated?: (response: Response) => void;
}

function urlOf(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

/** Pathname of a (possibly relative) URL. */
function pathnameOf(url: string): string {
    try {
        return new URL(url, window.location.origin).pathname;
    } catch {
        return url;
    }
}

/**
 * Resource prefix used to group a request with its siblings — the first three
 * non-empty path segments, e.g. `/api/whatsapp/catalogs`. A mutation invalidates
 * every cached GET that shares this prefix.
 */
function resourcePrefix(url: string): string {
    const segments = pathnameOf(url).split('/').filter(Boolean).slice(0, 3);
    return '/' + segments.join('/');
}

/**
 * Drop cached GET responses whose URL pathname starts with `prefixPath`.
 * Used after a mutation so the follow-up refetch reads fresh data instead of stale cache.
 */
export function invalidateHttpCache(prefixPath: string): void {
    for (const k of allKeys()) {
        // Stored cachedFetch keys look like: `${PREFIX}http:${url}`
        const marker = `${PREFIX}http:`;
        if (!k.startsWith(marker)) continue;
        const url = k.slice(marker.length);
        if (pathnameOf(url).startsWith(prefixPath)) {
            try {
                window.localStorage.removeItem(k);
            } catch {
                /* ignore */
            }
        }
    }
}

function toResponse(cached: CachedHttpResponse): Response {
    const headers = new Headers();
    if (cached.contentType) headers.set('content-type', cached.contentType);
    // 204/205/304 must not carry a body.
    const noBody = cached.status === 204 || cached.status === 205 || cached.status === 304;
    return new Response(noBody ? null : cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
    });
}

async function fetchAndCache(
    input: RequestInfo | URL,
    init: RequestInit,
    key: string,
): Promise<Response> {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    // Read the body once, then hand the caller a fresh Response built from it.
    const body = await res.clone().text().catch(() => '');
    if (res.ok) {
        writeCache<CachedHttpResponse>(`http:${key}`, {
            status: res.status,
            statusText: res.statusText,
            body,
            contentType,
        });
    }
    return res;
}

/**
 * GET keys already served once in this JS session. Reset on full page reload.
 * Used to distinguish a *cold* read (first time after a reopen → serve cache instantly)
 * from a *warm* read (manual refresh, post-mutation reload, filter change → fetch fresh).
 */
const sessionServedKeys = new Set<string>();

/** Test/escape hatch: forget which keys were served this session (e.g. after logout). */
export function resetCachedFetchSession(): void {
    sessionServedKeys.clear();
}

/**
 * The WhatsApp backend enforces workspace scoping (STRICT_WORKSPACE_ACCESS on Cloud Run):
 * flow/account endpoints reject requests without a workspace via the `X-Workspace-ID` header
 * or a `?workspace_id=` query param. We attach the query param (no CORS preflight, unlike a
 * custom header) to any `/api/whatsapp/*` request that doesn't already carry one.
 */
function ensureWorkspaceParam(rawUrl: string): string {
    try {
        if (!rawUrl.includes('/api/whatsapp')) return rawUrl;
        if (/[?&]workspace_id=/.test(rawUrl)) return rawUrl;
        const ws = getWorkspaceId();
        if (!ws) return rawUrl;
        return rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'workspace_id=' + encodeURIComponent(ws);
    } catch {
        return rawUrl;
    }
}

/**
 * Drop-in for `fetch` on idempotent WhatsApp GET endpoints. Solves two things at once:
 *
 *   1. Instant reopen — the FIRST read of a URL in a session (i.e. right after a full page
 *      reload / reopening the tab) returns the persisted cached Response *immediately*, with
 *      no loading spinner, and (if the entry is stale) revalidates in the background.
 *
 *   2. Working refresh — every SUBSEQUENT read of that URL (a refresh button, a re-fetch
 *      after a filter change, or a reload after a mutation) goes to the network and returns
 *      fresh data. So refresh controls behave exactly as before — they always pull the latest.
 *
 *   - GET with no cache → network request, caches a successful result.
 *   - Non-GET / waBypass → passes straight through to `fetch` (never cached); a mutation also
 *     invalidates sibling cached GETs so even the next cold reopen won't show pre-mutation data.
 *
 * Pages keep their existing logic and refresh buttons; they only swap `fetch(` → `cachedFetch(`.
 */
export async function cachedFetch(input: RequestInfo | URL, init?: CachedFetchInit): Promise<Response> {
    const method = (init?.method || 'GET').toUpperCase();
    const {
        waStaleMs = 60_000,
        waMaxAgeMs = DEFAULT_MAX_AGE_MS,
        waCacheKey,
        waBypass = false,
        waOnRevalidated,
        ...fetchInit
    } = init || {};

    // Normalize the target so every WhatsApp-service call carries workspace scoping and the
    // session cookie. Rewriting to a string URL is safe here — callers pass string/URL inputs.
    const rawUrl = urlOf(input);
    const url = ensureWorkspaceParam(rawUrl);
    const reqInput: RequestInfo | URL =
        typeof input === 'string' || input instanceof URL ? url : input;
    const reqInit: RequestInit = { credentials: 'include', ...fetchInit };

    if (method !== 'GET' || waBypass) {
        // A mutation may change data a sibling GET has cached — invalidate the
        // resource group so the next read (and the next cold reopen) sees fresh data.
        if (method !== 'GET') {
            try {
                invalidateHttpCache(resourcePrefix(rawUrl));
            } catch {
                /* best-effort */
            }
        }
        return fetch(reqInput, reqInit);
    }

    const key = waCacheKey ?? url;
    const isColdRead = !sessionServedKeys.has(key);
    sessionServedKeys.add(key);

    if (isColdRead) {
        const cached = readCache<CachedHttpResponse>(`http:${key}`, waMaxAgeMs);
        if (cached) {
            // Paint instantly from cache; freshen storage in the background if it's stale.
            if (Date.now() - cached.ts > waStaleMs) {
                void fetchAndCache(reqInput, reqInit, key)
                    .then((fresh) => {
                        if (waOnRevalidated && fresh.ok) waOnRevalidated(fresh);
                    })
                    .catch(() => {
                        /* keep serving cache on network error */
                    });
            }
            return toResponse(cached.data);
        }
    }

    // Warm read (refresh / re-fetch) or a cold read with no cache → go to the network.
    return fetchAndCache(reqInput, reqInit, key);
}
