/**
 * useAgentAwareNavigation
 * =======================
 * A hook that provides context-aware navigation for components
 * that can be used in both admin (/dashboard) and agent (/agent) contexts.
 * 
 * This allows the same components to work in both contexts without
 * hardcoded paths.
 */

import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useCallback } from "react";

interface AgentAwareNavigation {
  /** Whether we're in the agent context */
  isAgentContext: boolean;
  /** Base path - either '/agent' or '/dashboard' */
  basePath: string;
  /** Navigate to a path, automatically prefixing with correct base */
  navigateTo: (path: string, options?: { replace?: boolean; state?: any }) => void;
  /** Get the full path with correct base prefix */
  getPath: (path: string) => string;
  /** Convert a /dashboard path to /agent or vice versa based on context */
  convertPath: (path: string) => string;
}

/**
 * Hook to get context-aware navigation utilities
 */
export function useAgentAwareNavigation(): AgentAwareNavigation {
  const location = useLocation();
  const navigate = useNavigate();

  const isAgentContext = useMemo(() => {
    return location.pathname.startsWith("/agent");
  }, [location.pathname]);

  const basePath = useMemo(() => {
    return isAgentContext ? "/agent" : "/dashboard";
  }, [isAgentContext]);

  const getPath = useCallback((path: string): string => {
    // Remove leading slash if present
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    
    // If path already has a base, don't add another
    if (cleanPath.startsWith("agent/") || cleanPath.startsWith("dashboard/")) {
      // Convert to current context
      const withoutBase = cleanPath.replace(/^(agent|dashboard)\//, "");
      return `${basePath}/${withoutBase}`;
    }
    
    return `${basePath}/${cleanPath}`;
  }, [basePath]);

  const convertPath = useCallback((path: string): string => {
    // Convert /dashboard/... to /agent/... or vice versa
    if (path.startsWith("/dashboard/")) {
      return isAgentContext ? path.replace("/dashboard/", "/agent/") : path;
    }
    if (path.startsWith("/agent/")) {
      return isAgentContext ? path : path.replace("/agent/", "/dashboard/");
    }
    // If no prefix, add the appropriate one
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${basePath}/${cleanPath}`;
  }, [basePath, isAgentContext]);

  const navigateTo = useCallback((path: string, options?: { replace?: boolean; state?: any }) => {
    const fullPath = getPath(path);
    navigate(fullPath, options);
  }, [getPath, navigate]);

  return {
    isAgentContext,
    basePath,
    navigateTo,
    getPath,
    convertPath,
  };
}

/**
 * Get the base path from the current URL (for use outside React context)
 */
export function getBasePathFromUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/agent") ? "/agent" : "/dashboard";
  }
  return "/dashboard";
}

/**
 * Check if we're in agent context (for use outside React context)
 */
export function isInAgentContext(): boolean {
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/agent");
  }
  return false;
}

export default useAgentAwareNavigation;
