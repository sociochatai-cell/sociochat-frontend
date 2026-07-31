/**
 * Agent Protected Route — redirects to /agent-login when not authenticated.
 * Per-page permission is enforced by AgentPageGuard inside AgentLayout.
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAgentAuth } from "../contexts/AgentAuthContext";
import { Loader2 } from "lucide-react";

const AgentProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAgentAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/agent-login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default AgentProtectedRoute;
