import { useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPageLabel } from "./pageLabels";
import { API_BASE_URL } from "@/config";

interface TrackingEvent {
    event_type: "page_view" | "page_exit" | "feature";
    page_path: string;
    page_label?: string;
    duration_seconds?: number;
    referrer_path?: string;
    timestamp: string;
}

const FLUSH_INTERVAL = 30_000;
const MAX_BUFFER = 50;

/**
 * Passively tracks in-app page navigation for logged-in users. Renders nothing.
 * Safe to mount at the app root — sends nothing when the user is anonymous.
 */
export function PageTrackingProvider() {
    const { user } = useAuth();
    const location = useLocation();
    const bufferRef = useRef<TrackingEvent[]>([]);
    const prevRef = useRef({ path: "", enteredAt: Date.now() });
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const flush = useCallback(() => {
        const events = bufferRef.current;
        if (events.length === 0) return;
        bufferRef.current = [];
        const payload = JSON.stringify({ events });
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    `${API_BASE_URL}/api/activity/events`,
                    new Blob([payload], { type: "application/json" })
                );
            } else {
                fetch(`${API_BASE_URL}/api/activity/events`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    credentials: "include",
                    keepalive: true,
                }).catch(() => {});
            }
        } catch {
            // never let tracking break the app
        }
    }, []);

    const addEvent = useCallback((ev: Omit<TrackingEvent, "timestamp">) => {
        bufferRef.current.push({ ...ev, timestamp: new Date().toISOString() });
        if (bufferRef.current.length >= MAX_BUFFER) flush();
    }, [flush]);

    useEffect(() => {
        if (!user) return;
        timerRef.current = setInterval(flush, FLUSH_INTERVAL);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            flush();
        };
    }, [user, flush]);

    useEffect(() => {
        const onHide = () => { if (document.visibilityState === "hidden") flush(); };
        const onUnload = () => {
            const prev = prevRef.current;
            if (prev.path) {
                bufferRef.current.push({
                    event_type: "page_exit",
                    page_path: prev.path,
                    page_label: getPageLabel(prev.path),
                    duration_seconds: Math.round((Date.now() - prev.enteredAt) / 1000),
                    timestamp: new Date().toISOString(),
                });
            }
            flush();
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [flush]);

    useEffect(() => {
        if (!user) return;
        const prev = prevRef.current;
        if (prev.path && prev.path !== location.pathname) {
            addEvent({
                event_type: "page_exit",
                page_path: prev.path,
                page_label: getPageLabel(prev.path),
                duration_seconds: Math.round((Date.now() - prev.enteredAt) / 1000),
            });
        }
        addEvent({
            event_type: "page_view",
            page_path: location.pathname,
            page_label: getPageLabel(location.pathname),
            referrer_path: prev.path || undefined,
        });
        prevRef.current = { path: location.pathname, enteredAt: Date.now() };
    }, [location.pathname, user, addEvent]);

    return null;
}
