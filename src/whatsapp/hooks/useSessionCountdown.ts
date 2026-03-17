// Hook for real-time session countdown
// =====================================
// Provides a countdown timer that updates every second

import { useState, useEffect } from 'react';

interface SessionCountdownResult {
    timeLeft: number;
    formatted: string;
    isExpired: boolean;
}

/**
 * Custom hook for real-time session countdown timer
 * @param initialSeconds - Initial seconds from API (session_time_left_seconds)
 * @param isActive - Whether the session is active (is_session_open)
 * @returns Object with timeLeft, formatted string, and isExpired status
 */
export function useSessionCountdown(
    initialSeconds: number | undefined,
    isActive: boolean
): SessionCountdownResult {
    const [timeLeft, setTimeLeft] = useState<number>(initialSeconds || 0);

    // Reset when initial value changes (new conversation selected)
    useEffect(() => {
        if (initialSeconds && isActive) {
            setTimeLeft(initialSeconds);
        } else {
            setTimeLeft(0);
        }
    }, [initialSeconds, isActive]);

    // Countdown every second
    useEffect(() => {
        if (!isActive || timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, timeLeft > 0]);

    // Format the time with hours, minutes, and seconds
    const formatTime = (seconds: number): string => {
        if (seconds <= 0) return 'Expired';

        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m ${secs}s left`;
        }
        if (mins > 0) {
            return `${mins}m ${secs}s left`;
        }
        return `${secs}s left`;
    };

    return {
        timeLeft,
        formatted: formatTime(timeLeft),
        isExpired: timeLeft <= 0,
    };
}

/**
 * Format session time in short format for badges (e.g., "23h 45m 32s")
 */
export function formatSessionTimeShort(seconds: number): string {
    if (seconds <= 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
}
