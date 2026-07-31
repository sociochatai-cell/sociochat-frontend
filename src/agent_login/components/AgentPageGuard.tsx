/**
 * Agent Page Guard — per-page permission check.
 * Auto-detects the required permission path from the current /agent/* URL and
 * verifies it against the agent's allowed_paths. Shows Access Denied otherwise.
 */

import React from "react";
import { useLocation, Link } from "react-router-dom";
import { useAgentAuth } from "../contexts/AgentAuthContext";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENT_PAGES, pathMatchesPattern } from "../config/agentPages";

/** Resolve the required permission path for the current /agent/* pathname. */
function requiredPathFor(pathname: string): string {
  const normalized = pathname.replace(/\/$/, "");
  // Longest matching route wins (so /agent/crm/leads beats /agent/crm).
  const match = [...AGENT_PAGES]
    .sort((a, b) => b.route.length - a.route.length)
    .find((p) => normalized === p.route || normalized.startsWith(p.route + "/"));
  return match?.permissionPath || "/dashboard";
}

const AccessDenied: React.FC<{ path: string }> = ({ path }) => (
  <div className="flex-1 flex items-center justify-center p-6">
    <div className="text-center space-y-6 max-w-md">
      <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
        <ShieldX className="h-12 w-12 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">
          You don't have permission to access this page.
          <br />
          Please select a page from the sidebar or contact your administrator.
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <span className="font-medium">Requested:</span>{" "}
        <code className="bg-background px-2 py-1 rounded">{path}</code>
      </div>
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
        <Link to="/agent">
          <Button><Home className="h-4 w-4 mr-2" /> Dashboard</Button>
        </Link>
      </div>
    </div>
  </div>
);

const AgentPageGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { agent } = useAgentAuth();

  const requiredPath = requiredPathFor(location.pathname);

  // Dashboard is always accessible.
  if (requiredPath === "/dashboard") return <>{children}</>;

  const allowed = agent?.allowed_paths || [];
  const ok = allowed.some((pattern) => pathMatchesPattern(requiredPath, pattern));

  if (!ok) return <AccessDenied path={location.pathname} />;
  return <>{children}</>;
};

export default AgentPageGuard;
