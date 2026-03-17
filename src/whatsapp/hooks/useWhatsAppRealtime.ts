import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { WhatsAppRealtimeEvent } from '../types';
import { API_BASE_URL } from '@/config';

const API_BASE = API_BASE_URL;

// ── SSE health tracker ──
// Tracks whether SSE has delivered any data recently.
// Used by the polling fallback to decide whether to skip ticks.
let _lastSseEventTime = 0;
const SSE_HEALTHY_THRESHOLD_MS = 30_000; // 30 seconds

/** Returns true if SSE delivered an event or heartbeat within the last 30 s. */
export function isSseHealthy(): boolean {
  return Date.now() - _lastSseEventTime < SSE_HEALTHY_THRESHOLD_MS;
}

interface UseWhatsAppRealtimeOptions {
    workspaceId: string;
    onEvent?: (event: WhatsAppRealtimeEvent) => void;
}

export function useWhatsAppRealtime({ workspaceId, onEvent }: UseWhatsAppRealtimeOptions) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const onEventRef = useRef(onEvent);

    // Update ref when handler changes
    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    useEffect(() => {
        if (!workspaceId) return;

        // Connect to SSE endpoint
        const url = `${API_BASE}/api/notifications/stream?workspace_id=${workspaceId}`;

        // Check if already connected to same URL
        if (eventSourceRef.current?.url === url && eventSourceRef.current?.readyState === EventSource.OPEN) {
            console.log('🔌 reuse existing connection');
            return;
        }

        // Close existing connection if any (different URL)
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        console.log('🔌 Connecting to Real-Time Inbox:', url);
        const eventSource = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('✅ Real-Time Inbox Connected');
            _lastSseEventTime = Date.now();
        };

        eventSource.onerror = (err) => {
            // SSE disconnected / errored — polling will kick in automatically
        };

        // Generic message handler for all events
        eventSource.onmessage = (event) => {
            // Any data from the server (including heartbeat comments are NOT
            // delivered via onmessage — they are stripped by EventSource spec).
            // But real data events DO arrive here, so mark SSE as healthy.
            _lastSseEventTime = Date.now();

            try {
                const parsed = JSON.parse(event.data);
                console.log('📩 Real-Time Event:', parsed);

                if (onEventRef.current) {
                    onEventRef.current(parsed as WhatsAppRealtimeEvent);
                }
            } catch (e) {
                console.error('Error parsing SSE event:', e);
            }
        };

        return () => {
            console.log('🔌 Disconnecting Real-Time Inbox');
            eventSource.close();
            eventSourceRef.current = null;
        };
    }, [workspaceId]); // Removed onEvent dependency to prevent reconnection loops
}
