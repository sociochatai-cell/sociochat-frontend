/**
 * Agent Layout — sidebar (allowed pages only) + workspace switcher + logout.
 * Wraps the routed page in AgentPageGuard for per-page permission enforcement.
 */

import React, { Suspense, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAgentAuth } from "../contexts/AgentAuthContext";
import { getVisiblePages, AgentPage } from "../config/agentPages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home, MessageSquare, FileText, Users, Database, Send, Zap, Workflow,
  GitBranch, Droplets, BarChart3, LayoutDashboard, UserPlus, Handshake,
  Building2, ChevronDown, LogOut, User, Menu, X, Check, Loader2,
} from "lucide-react";
import AgentPageGuard from "./AgentPageGuard";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: Home,
  whatsapp_inbox: MessageSquare,
  whatsapp_templates: FileText,
  whatsapp_contacts: Users,
  whatsapp_datasets: Database,
  whatsapp_bulk: Send,
  whatsapp_automation: Zap,
  whatsapp_interactive: Workflow,
  whatsapp_flows: GitBranch,
  drip_campaigns: Droplets,
  whatsapp_analytics: BarChart3,
  crm_dashboard: LayoutDashboard,
  crm_leads: UserPlus,
  crm_contacts: Users,
  crm_deals: Handshake,
  analytics: BarChart3,
};

const CATEGORY_ORDER: AgentPage["category"][] = ["General", "WhatsApp", "CRM", "Marketing"];

const AgentLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    agent, workspaces, selectedWorkspaceId, selectWorkspace, logout, getAllowedPages,
  } = useAgentAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = getVisiblePages(getAllowedPages());
  const selectedWs = workspaces.find((w) => w.id === selectedWorkspaceId);

  const isActive = (route: string) => {
    const p = location.pathname.toLowerCase();
    const r = route.toLowerCase();
    if (r === "/agent") return p === "/agent" || p === "/agent/";
    return p === r || p.startsWith(r + "/");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/agent-login", { replace: true });
  };

  const handleWorkspaceChange = (wsId: number) => {
    if (wsId === selectedWorkspaceId) return;
    selectWorkspace(wsId);
    // Reused WhatsApp/CRM components read the workspace from localStorage on
    // mount — reload so they pick up the newly selected workspace.
    window.location.assign("/agent");
  };

  const renderNav = () => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const pages = visible.filter((p) => p.category === cat);
        if (pages.length === 0) return null;
        return (
          <div key={cat} className="space-y-1">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
            {pages.map((page) => {
              const Icon = ICONS[page.key] || Home;
              return (
                <Link
                  key={page.key}
                  to={page.route}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(page.route) && "bg-primary text-primary-foreground font-medium"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{page.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <div className="p-4 border-b flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">S</span>
        </div>
        <span className="font-semibold">Agent Portal</span>
      </div>

      {/* Workspace switcher (only assigned workspaces) */}
      <div className="p-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2">
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {selectedWs?.business_name || (selectedWorkspaceId ? `Workspace ${selectedWorkspaceId}` : "Select workspace")}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.length === 0 && (
              <DropdownMenuItem disabled>No workspaces assigned</DropdownMenuItem>
            )}
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => handleWorkspaceChange(w.id)} className="gap-2">
                {w.id === selectedWorkspaceId ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                <span className="truncate">{w.business_name || `Workspace ${w.id}`}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {renderNav()}

      {/* User menu */}
      <div className="p-2 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 text-left truncate">
                <p className="text-sm font-medium truncate">{agent?.display_name || agent?.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{agent?.username}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{agent?.display_name || agent?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col border-r bg-card w-64">{sidebarInner}</aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <span className="font-semibold">Agent Portal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {mobileOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />}
      <aside className={cn(
        "md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-card border-r flex flex-col transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarInner}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-16 flex flex-col">
        <div className="flex-1 overflow-auto">
          <AgentPageGuard>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </AgentPageGuard>
        </div>
      </main>
    </div>
  );
};

export default AgentLayout;
