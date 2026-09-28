/**
 * Agent Login Page — SocioChat.
 * Login with Username + Password.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentAuth } from "../contexts/AgentAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Users, Lock } from "lucide-react";

const AgentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithSso, isAuthenticated, loading: authLoading } = useAgentAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [ssoBusy, setSsoBusy] = useState(false);
  // Guard against React 18 StrictMode double-invoke burning the single-use token twice.
  const ssoTried = useRef(false);

  // Cross-app SSO landing: the Sociovia monolith redirects a logged-in agent here as
  // `/agent-login?token=<one-time>&next=<path>&workspace_id=<id>`. Consume it once,
  // strip it from the URL immediately (single-use; keep it out of history/Referer),
  // exchange it for a SocioChat agent session, then land on the requested surface.
  useEffect(() => {
    if (ssoTried.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("token") || "").trim();
    if (!token) return;
    ssoTried.current = true;

    const nextRaw = params.get("next") || "";
    // Open-redirect guard: only honor an /agent-scoped next; anything else -> /agent.
    const next = nextRaw.startsWith("/agent") ? nextRaw : "/agent";
    const wsRaw = params.get("workspace_id") || params.get("ws") || "";
    const workspaceId = /^\d+$/.test(wsRaw) ? Number(wsRaw) : null;

    try { window.history.replaceState({}, "", "/agent-login"); } catch { /* ignore */ }

    setSsoBusy(true);
    (async () => {
      try {
        const res = await loginWithSso(token, workspaceId);
        if (res.success) {
          navigate(next, { replace: true });
        } else {
          setError(res.message || "This sign-in link is invalid or has expired.");
          setSsoBusy(false);
        }
      } catch {
        setError("We couldn't sign you in. Please try again.");
        setSsoBusy(false);
      }
    })();
  }, [loginWithSso, navigate]);

  useEffect(() => {
    // Don't auto-bounce while an SSO token is being consumed (the effect above owns
    // navigation in that case).
    if (ssoBusy || ssoTried.current) return;
    if (isAuthenticated && !authLoading) navigate("/agent", { replace: true });
  }, [isAuthenticated, authLoading, navigate, ssoBusy]);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const t = setInterval(() => setRetryAfter((p) => (p === null || p <= 1 ? null : p - 1)), 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRetryAfter(null);

    if (!username.trim()) return setError("Username is required");
    if (!password) return setError("Password is required");

    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        navigate("/agent", { replace: true });
      } else if (res.error === "too_many_attempts" && res.retry_after) {
        setRetryAfter(res.retry_after);
        setError(`Too many failed attempts. Try again in ${res.retry_after}s.`);
      } else {
        setError(res.message || "Login failed. Check your credentials.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Cross-app SSO in progress (no error yet) — show a dedicated "signing you in" state
  // instead of the username/password form.
  if (ssoBusy && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Signing you in…</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connecting your Sociovia agent access to SocioChat.</p>
        </div>
      </div>
    );
  }

  const disabled = loading || retryAfter !== null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Agent Login</CardTitle>
          <CardDescription>Sign in to your assigned workspace</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={disabled}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={disabled}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={disabled}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
              ) : retryAfter !== null ? (
                `Try again in ${retryAfter}s`
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Not an agent?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">Owner Login</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentLoginPage;
