import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL } from "@/config";

const API = `${API_BASE_URL}/api/public/landing-events`;
const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);

let buffer: Record<string, unknown>[] = [];

function flush() {
    if (!buffer.length) return;
    const payload = JSON.stringify({ events: buffer, session_id: sid });
    buffer = [];
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(API, new Blob([payload], { type: "application/json" }));
        } else {
            fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true,
            }).catch(() => {});
        }
    } catch {
        // ignore — never break the page
    }
}

/**
 * Anonymous landing-page tracker. Renders nothing. Only tracks page paths
 * and clicks on elements marked with `data-track-click`. Rate-limited server-side.
 */
export function LandingTracker() {
    const location = useLocation();
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const push = useCallback((type: string, extra?: Record<string, unknown>) => {
        buffer.push({
            event_type: type,
            page_path: location.pathname,
            timestamp: new Date().toISOString(),
            ...extra,
        });
        if (buffer.length >= 20) flush();
    }, [location.pathname]);

    useEffect(() => { push("page_visit"); }, [location.pathname, push]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const el = (e.target as HTMLElement)?.closest?.("[data-track-click]");
            if (el) push("click", { element_id: el.getAttribute("data-track-click") });
        };
        document.addEventListener("click", onClick);
        timerRef.current = setInterval(flush, 15000);
        const onHide = () => { if (document.visibilityState === "hidden") flush(); };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("beforeunload", flush);
        return () => {
            document.removeEventListener("click", onClick);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("beforeunload", flush);
            if (timerRef.current) clearInterval(timerRef.current);
            flush();
        };
    }, [push]);

    return null;
}
