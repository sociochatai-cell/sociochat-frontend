// WhatsApp Polling Hook
// =====================
// Simple polling hook for Phase-1 (no websockets yet)

import { useEffect, useRef, useCallback } from 'react';

export interface UsePollingOptions {
  enabled: boolean;
  interval: number; // milliseconds
  onPoll: () => void | Promise<void>;
}

export function useWhatsAppPolling({ enabled, interval, onPoll }: UsePollingOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (!enabled || isPollingRef.current) return;
    
    isPollingRef.current = true;
    try {
      await onPoll();
    } catch (error) {
      console.error('Polling error:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [enabled, onPoll]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Initial poll
    poll();

    // Set up interval
    const scheduleNext = () => {
      timeoutRef.current = setTimeout(() => {
        poll();
        scheduleNext();
      }, interval);
    };

    scheduleNext();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, interval, poll]);
}

