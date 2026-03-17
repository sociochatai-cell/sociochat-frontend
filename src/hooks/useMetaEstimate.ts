import { useState, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/config";

export interface MetaEstimateRequest {
  workspace?: string;
  audience?: {
    location?: { country?: string };
    age?: [number, number];
    gender?: string;
    interests?: string[];
  };
  budget?: {
    amount?: number;
    value?: number;
  };
  creative?: any;
  objective?: string;
  // client can add "run" flag here; hook will also add it based on options
  run?: boolean;
}

export interface MetaEstimateResponse {
  ok: boolean;
  estimated_reach: number;
  estimated_daily_impressions: number;
  estimated_daily_clicks: number;
  estimated_cpc: number;
  estimated_cpa: number;
  estimated_conversions_per_week: number;
  estimated_leads: number;
  confidence: number;
  predicted_audience: {
    location: { country: string };
    age: [number, number];
    gender: string;
    interests: string[];
  };
  breakdown: {
    by_country: Record<string, number>;
  };
  meta_raw: any;
  error?: string;
}

/**
 * useMetaEstimate
 *
 * fetchEstimate(payload, options)
 *  - options.run: (boolean) when true forces server to compute a fresh estimate (default true).
 *  - options.signal: optional AbortSignal to attach to fetch.
 *
 * Returned object:
 *  { fetchEstimate, loading, error, abort }
 *
 * NOTE: endpoint path is relative -> '/api/meta/estimate' (use dev proxy or same-origin server)
 */
export function useMetaEstimate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    try {
      if (ctrlRef.current) {
        ctrlRef.current.abort();
        ctrlRef.current = null;
      }
    } catch (e) {
      // noop
    }
  }, []);

  const fetchEstimate = useCallback(
    async (
      payload: MetaEstimateRequest,
      options?: { run?: boolean; signal?: AbortSignal; timeoutMs?: number }
    ): Promise<MetaEstimateResponse | null> => {
      setLoading(true);
      setError(null);

      // use AbortController for this request
      const controller = new AbortController();
      ctrlRef.current = controller;
      const combinedSignal = options?.signal
        ? (() => {
            // if caller passed a signal, create a race between them and our internal controller
            const s = options.signal;
            const ch = new AbortController();
            const onAbort = () => ch.abort();
            s.addEventListener("abort", onAbort);
            controller.signal.addEventListener("abort", onAbort);
            // return ch.signal and cleanup when done
            (ch as any).__cleanup = () => {
              s.removeEventListener("abort", onAbort);
              controller.signal.removeEventListener("abort", onAbort);
            };
            return ch.signal;
          })()
        : controller.signal;

      // default run = true (force compute) for explicit behavior; pass run=false to request cache only
      const runFlag = options?.run === undefined ? true : !!options.run;

      const bodyPayload = { ...payload, run: runFlag };

      // optional timeout wrapper
      let timeoutId: number | undefined;
      if (options?.timeoutMs && options.timeoutMs > 0) {
        timeoutId = window.setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, options.timeoutMs);
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/meta/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
          signal: (combinedSignal as AbortSignal) || controller.signal,
        });

        // cleanup combined signal resources if created above
        if ((combinedSignal as any)?.__cleanup) {
          (combinedSignal as any).__cleanup();
        }

        if (!resp.ok) {
          // try to parse JSON error body
          const txt = await resp.text().catch(() => "");
          let parsedErr = null;
          try {
            parsedErr = JSON.parse(txt);
          } catch {
            parsedErr = null;
          }
          const msg =
            parsedErr?.error ||
            parsedErr?.message ||
            `HTTP error ${resp.status}` +
              (txt ? ` — ${txt.substring(0, 300)}` : "");
          setError(msg);
          return null;
        }

        const data = (await resp.json()) as MetaEstimateResponse;
        return data;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setError("Request aborted");
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg || "Failed to fetch estimate");
        }
        return null;
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        setLoading(false);
        // clear controller if it's still ours
        if (ctrlRef.current === controller) ctrlRef.current = null;
      }
    },
    []
  );

  return { fetchEstimate, loading, error, abort };
}
