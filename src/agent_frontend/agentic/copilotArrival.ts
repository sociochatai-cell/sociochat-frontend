// Cross-app copilot ARRIVAL for SocioChat.
//
// The AdOptimizer launchpad copilot hands WhatsApp/CRM flows OFF to SocioChat by
// SSO-redirecting here with `?copilot_run=<id>&copilot_flow=<flow_key>` appended
// (see launchpad Copilot2.copilotHandoff). This module resumes the drive on
// arrival: fetch the agentos run, read its ui_directive.spec, map it through the
// SocioChat flowRegistry, and driveFill the live form — prepare-only (never
// submits). Mirrors how SocioEngage receives the same handoff.

import { useEffect, useRef } from "react";
import { buildDirectiveFromSpec, driveFill, highlightSubmit } from "./uiDriver";
import { FLOW_REGISTRY, FLOW_KEYS } from "./flowRegistry";

// Agentos copilot API base — same host the launchpad talks to. Override with
// VITE_AGENTOS_API_BASE; defaults to the AdOptimizer agentos gateway.
const AGENTOS_BASE =
  (((import.meta as any).env?.VITE_AGENTOS_API_BASE as string) || "https://adoptimizer.sociovia.com")
    .replace(/\/+$/, "") + "/api/v1/agent";

const AGENT_TOKEN_KEY = "sociovia_agent_token";

function agentAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const t = localStorage.getItem(AGENT_TOKEN_KEY);
    if (t) h["Authorization"] = `Bearer ${t}`;
  } catch { /* storage blocked — rely on cookies */ }
  return h;
}

async function fetchRun(runId: string): Promise<any | null> {
  try {
    const res = await fetch(`${AGENTOS_BASE}/runs/${encodeURIComponent(runId)}`, {
      credentials: "include",
      headers: agentAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// The backend flow_key may arrive as `target` alias; resolve to a registry key.
function resolveFlowKey(flowParam: string, directive: any): string | null {
  const cand = [flowParam, directive?.flow, directive?.target].filter(Boolean) as string[];
  for (const c of cand) {
    if (FLOW_REGISTRY[c]) return c;
  }
  // tolerate a prose/aliased value by exact-token match
  for (const k of FLOW_KEYS) if (cand.some((c) => c === k)) return k;
  return null;
}

function stripCopilotParams(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("copilot_run");
    url.searchParams.delete("copilot_flow");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
  } catch { /* no-op */ }
}

/** Resume a handed-off copilot run on SocioChat: navigate + autofill the flow. */
export async function runCopilotArrival(navigate: (to: string) => void): Promise<boolean> {
  let runId = "", flowParam = "";
  try {
    const q = new URLSearchParams(window.location.search);
    runId = q.get("copilot_run") || "";
    flowParam = q.get("copilot_flow") || "";
  } catch { /* no window */ }
  if (!runId || !flowParam) return false;

  stripCopilotParams(); // consume immediately so a reload / re-mount doesn't re-drive

  const run = await fetchRun(runId);
  const directive = run?.run?.intent?.ui_directive ?? run?.intent?.ui_directive ?? null;
  const flowKey = resolveFlowKey(flowParam, directive);
  if (!flowKey) return false;

  const spec = (directive && directive.spec) || {};
  const dir = buildDirectiveFromSpec(flowKey, spec);
  if (!dir) return false;

  try {
    await driveFill(dir, (to) => navigate(to));
    const def = FLOW_REGISTRY[flowKey];
    if (def?.finalSubmitButtons?.length) highlightSubmit(...def.finalSubmitButtons);
    return true;
  } catch {
    return false;
  }
}

/** Mount once at the app root (inside the Router). Fires the arrival drive when
 *  SocioChat loads with copilot_run/copilot_flow params present. */
export function useCopilotArrival(navigate: (to: string) => void): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    let has = false;
    try {
      const q = new URLSearchParams(window.location.search);
      has = !!(q.get("copilot_run") && q.get("copilot_flow"));
    } catch { /* no-op */ }
    if (!has) return;
    done.current = true;
    // defer so the SPA shell + router have mounted before we navigate/fill
    const t = setTimeout(() => { void runCopilotArrival(navigate); }, 400);
    return () => clearTimeout(t);
  }, [navigate]);
}
