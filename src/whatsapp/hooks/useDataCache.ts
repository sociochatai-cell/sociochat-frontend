// Data Caching Hook for WhatsApp
// ================================
// Provides cached data with background polling and refresh capabilities

import { useState, useEffect, useRef, useCallback } from 'react';

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {};

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
    // Initialize from cache if available
    const cachedEntry = cache[key];
    const [data, setDataState] = useState<T | null>(cachedEntry?.data ?? null);
    const [isLoading, setIsLoading] = useState(!cachedEntry);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(cachedEntry?.timestamp ?? null);

    const isMountedRef = useRef(true);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const fetchingRef = useRef(false);

    // Fetch data function
    const fetchData = useCallback(async (isRefresh = false) => {
        if (fetchingRef.current) return;
        if (!enabled) return;

        fetchingRef.current = true;
        
        if (isRefresh) {
            setIsRefreshing(true);
        } else if (!cache[key]) {
            setIsLoading(true);
        }

        try {
            const result = await fetcher();
            
            if (!isMountedRef.current) return;

            // Update cache
            const now = Date.now();
            cache[key] = { data: result, timestamp: now };
            
            setDataState(result);
            setLastUpdated(now);
            setError(null);
            onSuccess?.(result);
        } catch (err) {
            if (!isMountedRef.current) return;
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            onError?.(error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
            fetchingRef.current = false;
        }
    }, [key, fetcher, enabled, onError, onSuccess]);

    // Manual refresh function
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    // Set data manually (useful for optimistic updates)
    const setData = useCallback((newData: T | ((prev: T | null) => T)) => {
        setDataState(prev => {
            const updated = typeof newData === 'function' 
                ? (newData as (prev: T | null) => T)(prev) 
                : newData;
            
            // Update cache
            const now = Date.now();
            cache[key] = { data: updated, timestamp: now };
            setLastUpdated(now);
            
            return updated;
        });
    }, [key]);

    // Initial fetch and polling setup
    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            setIsLoading(false);
            return;
        }

        // Check if cache is stale
        const cachedEntry = cache[key];
        const isStale = !cachedEntry || (Date.now() - cachedEntry.timestamp > staleTime);

        if (isStale) {
            fetchData(!!cachedEntry); // isRefresh if we have cached data
        } else {
            // Use cached data
            setDataState(cachedEntry.data);
            setLastUpdated(cachedEntry.timestamp);
            setIsLoading(false);
        }

        // Set up polling
        if (pollInterval > 0) {
            pollingRef.current = setInterval(() => {
                fetchData(true);
            }, pollInterval);
        }

        return () => {
            isMountedRef.current = false;
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [key, enabled, pollInterval, staleTime, fetchData]);

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

// Utility to clear cache
export function clearCache(keyPattern?: string) {
    if (keyPattern) {
        Object.keys(cache).forEach(key => {
            if (key.includes(keyPattern)) {
                delete cache[key];
            }
        });
    } else {
        Object.keys(cache).forEach(key => delete cache[key]);
    }
}

// Utility to get cached value
export function getCachedValue<T>(key: string): T | null {
    return cache[key]?.data ?? null;
}
