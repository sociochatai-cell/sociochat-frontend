/**
 * Agent Dashboard — welcome + quick access to the agent's allowed pages.
 */

import React from "react";
import { Link } from "react-router-dom";
import { useAgentAuth } from "../contexts/AgentAuthContext";
import { getVisiblePages } from "../config/agentPages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, LayoutGrid, Building2 } from "lucide-react";

const AgentDashboard: React.FC = () => {
  const { agent, workspaces, selectedWorkspaceId, getAllowedPages } = useAgentAuth();
  const allowedPages = getAllowedPages();
  const quickPages = getVisiblePages(allowedPages).filter((p) => p.key !== "dashboard");
  const selectedWs = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome back, {agent?.display_name || agent?.username}!</h1>
        <p className="text-muted-foreground">
          You're signed in to{" "}
          <span className="font-medium text-foreground">
            {selectedWs?.business_name || (selectedWorkspaceId ? `Workspace ${selectedWorkspaceId}` : "—")}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your Permissions</CardDescription>
            <CardTitle className="text-2xl">{allowedPages.length}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">pages you can access</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workspaces</CardDescription>
            <CardTitle className="text-2xl">{workspaces.length}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">assigned to you</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${agent?.is_active ? "bg-green-500" : "bg-red-500"}`} />
              {agent?.is_active ? "Active" : "Inactive"}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">@{agent?.username}</p></CardContent>
        </Card>
      </div>

      {quickPages.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" /> Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickPages.map((page) => (
              <Link key={page.key} to={page.route}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{page.category}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardTitle className="text-lg mt-2">{page.label}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Pages Assigned</h3>
          <p className="text-muted-foreground">Contact your administrator to get access to features.</p>
        </Card>
      )}
    </div>
  );
};

export default AgentDashboard;
