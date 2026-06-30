// Data Caching Hook for WhatsApp
// ================================
// Provides cached data with background polling and refresh capabilities

import { useState, useEffect, useRef, useCallback } from 'react';
import { readCache, writeCache, removeCache, clearWhatsAppCache } from '../utils/waPersistentCache';

// L1 in-memory cache. Backed by a persistent L2 (localStorage) so data survives a
// full page reload / reopening the tab — see waPersistentCache.ts.
const cache: Record<string, { data: unknown; timestamp: number }> = {};

/**
 * Resolve a cache entry: L1 (memory) first, falling back to L2 (persistent storage).
 * A persistent hit is promoted into L1 so subsequent reads are synchronous.
 */
function getEntry(key: string): { data: unknown; timestamp: number } | undefined {
    if (cache[key]) return cache[key];
    const persisted = readCache<unknown>(key);
    if (persisted) {
        cache[key] = { data: persisted.data, timestamp: persisted.ts };
        return cache[key];
    }
    return undefined;
}

/** Write through to both L1 and L2. */
function setEntry(key: string, data: unknown, timestamp: number): void {
    cache[key] = { data, timestamp };
    writeCache(key, data);
}

export interface UseDataCacheOptions<T> {
    key: string;
    fetcher: () => Promise<T>;
    pollInterval?: number; // milliseconds, 0 to disable polling
    staleTime?: number; // milliseconds, how long data is considered fresh
    enabled?: boolean;
    onError?: (error: Error) => void;
    onSuccess?: (data: T) => void;
}

export interface UseDataCacheResult<T> {
    data: T | null;
    isLoading: boolean;
    isRefreshing: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    setData: (data: T | ((prev: T | null) => T)) => void;
    lastUpdated: number | null;
}

export function useDataCache<T>({
    key,
    fetcher,
    pollInterval = 0,
    staleTime = 30000, // 30 seconds default
    enabled = true,
    onError,
    onSuccess,
}: UseDataCacheOptions<T>): UseDataCacheResult<T> {
    const cachedEntry = getEntry(key);
    const [data, setDataState] = useState<T | null>((cachedEntry?.data as T) ?? null);
    const [isLoading, setIsLoading] = useState(!cachedEntry);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(cachedEntry?.timestamp ?? null);

    const isMountedRef = useRef(true);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const fetchingRef = useRef(false);
    const fetcherRef = useRef(fetcher);
    const onErrorRef = useRef(onError);
    const onSuccessRef = useRef(onSuccess);

    fetcherRef.current = fetcher;
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;

    const runFetch = useCallback(async (isRefresh = false) => {
        if (fetchingRef.current || !enabled) return;

        fetchingRef.current = true;

        if (isRefresh) {
            setIsRefreshing(true);
        } else if (!cache[key]) {
            setIsLoading(true);
        }

        try {
            const result = await fetcherRef.current();

            if (!isMountedRef.current) return;

            const now = Date.now();
            setEntry(key, result, now);

            setDataState(result);
            setLastUpdated(now);
            setError(null);
            onSuccessRef.current?.(result);
        } catch (err) {
            if (!isMountedRef.current) return;
            const nextError = err instanceof Error ? err : new Error('Unknown error');
            setError(nextError);
            onErrorRef.current?.(nextError);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
            fetchingRef.current = false;
        }
    }, [key, enabled]);

    const refresh = useCallback(async () => {
        await runFetch(true);
    }, [runFetch]);

    const setData = useCallback((newData: T | ((prev: T | null) => T)) => {
        setDataState(prev => {
            const updated = typeof newData === 'function'
                ? (newData as (prev: T | null) => T)(prev)
                : newData;

            const now = Date.now();
            setEntry(key, updated, now);
            setLastUpdated(now);

            return updated;
        });
    }, [key]);

    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            setIsLoading(false);
            return () => {
                isMountedRef.current = false;
            };
        }

        const entry = getEntry(key);
        const isStale = !entry || (Date.now() - entry.timestamp > staleTime);

        if (isStale) {
            void runFetch(!!entry);
        } else {
            setDataState(entry.data as T);
            setLastUpdated(entry.timestamp);
            setIsLoading(false);
        }

        if (pollInterval > 0) {
            pollingRef.current = setInterval(() => {
                void runFetch(true);
            }, pollInterval);
        }

        return () => {
            isMountedRef.current = false;
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [key, enabled, pollInterval, staleTime, runFetch]);

    return {
        data,
        isLoading,
        isRefreshing,
        error,
        refresh,
        setData,
        lastUpdated,
    };
}

export function clearCache(keyPattern?: string) {
    if (keyPattern) {
        Object.keys(cache).forEach(key => {
            if (key.includes(keyPattern)) {
                delete cache[key];
                removeCache(key);
            }
        });
        clearWhatsAppCache(keyPattern);
    } else {
        Object.keys(cache).forEach(key => delete cache[key]);
        clearWhatsAppCache();
    }
}

export function getCachedValue<T>(key: string): T | null {
    return (getEntry(key)?.data as T) ?? null;
}
