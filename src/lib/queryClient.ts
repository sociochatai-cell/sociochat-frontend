import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

// 30 minutes in milliseconds
const STALE_TIME = 1000 * 60 * 30;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_TIME,
            gcTime: 1000 * 60 * 60 * 24, // Keep unused data for 24 hours
            retry: 1,
            refetchOnWindowFocus: false, // Don't refetch on window focus by default if data is fresh
        },
    },
});

const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'REACT_QUERY_OFFLINE_CACHE',
});

persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: STALE_TIME, // Persist for 30 minutes
});
