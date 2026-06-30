import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import apiClient from '@/lib/apiClient';
import {
    getWorkspaceId,
    setWorkspaceId,
    getWorkspaces as loadCachedWorkspaces,
    setWorkspaces as cacheWorkspaces,
    type Workspace,
} from '@/whatsapp/utils/workspaceContext';

export interface AuthUser {
    id: number;
    name?: string;
    email?: string;
    role?: string;
    plan?: string;
    status?: string;
    is_admin?: boolean;
    admin_override?: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    loginLocal: (user: AuthUser) => void;
    logoutLocal: () => void;
    refreshUser: () => Promise<void>;
    /** The user's workspaces (cached + refreshed from GET /api/workspaces). */
    workspaces: Workspace[];
    /** The active workspace id (from workspaceContext), or null. */
    activeWorkspaceId: string | null;
    /** Re-fetch the workspace list from the backend and update the cache. */
    refreshWorkspaces: () => Promise<Workspace[]>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    loginLocal: () => {},
    logoutLocal: () => {},
    refreshUser: async () => {},
    workspaces: [],
    activeWorkspaceId: null,
    refreshWorkspaces: async () => [],
});

function loadStoredUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser());
    const [loading, setLoading] = useState(false);
    const [workspaces, setWorkspacesState] = useState<Workspace[]>(() => loadCachedWorkspaces());
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => getWorkspaceId());

    const loginLocal = useCallback((u: AuthUser) => {
        setUser(u);
        localStorage.setItem('sv_user', JSON.stringify(u));
        sessionStorage.setItem('sv_user', JSON.stringify(u));
        if (u.id) {
            localStorage.setItem('sv_user_id', String(u.id));
        }
    }, []);

    const logoutLocal = useCallback(() => {
        setUser(null);
        setWorkspacesState([]);
        setActiveWorkspaceId(null);
    }, []);

    /**
     * Fetch the workspace list from GET /api/workspaces, cache it via the
     * workspaceContext helper, and reflect it in context state. If no
     * workspace is active yet, default the active id to the first one.
     */
    const refreshWorkspaces = useCallback(async (): Promise<Workspace[]> => {
        const userId = localStorage.getItem('sv_user_id');
        if (!userId) {
            setWorkspacesState([]);
            return [];
        }
        try {
            const res = await apiClient.get<{ success: boolean; workspaces: Workspace[] }>('/workspaces');
            if (res.ok && res.data?.success && Array.isArray(res.data.workspaces)) {
                const list = res.data.workspaces;
                cacheWorkspaces(list);
                setWorkspacesState(list);
                // Ensure an active workspace is set when one is missing.
                if (!getWorkspaceId() && list.length > 0) {
                    setWorkspaceId(list[0].id);
                    setActiveWorkspaceId(String(list[0].id));
                }
                return list;
            }
        } catch {
            // keep cached list
        }
        return loadCachedWorkspaces();
    }, []);

    const refreshUser = useCallback(async () => {
        const userId = localStorage.getItem('sv_user_id');
        if (!userId) {
            setUser(null);
            return;
        }
        setLoading(true);
        try {
            const { API_BASE_URL } = await import('@/config');
            const token = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    loginLocal(data.user);
                }
            }
        } catch {
            // keep cached user
        } finally {
            setLoading(false);
        }
    }, [loginLocal]);

    useEffect(() => {
        if (!user) {
            const stored = loadStoredUser();
            if (stored) setUser(stored);
        }
        setLoading(false);
    }, [user]);

    // Load the workspace list once we have a logged-in user (on mount / login).
    useEffect(() => {
        if (user?.id) {
            refreshWorkspaces();
        }
    }, [user?.id, refreshWorkspaces]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            loginLocal,
            logoutLocal,
            refreshUser,
            workspaces,
            activeWorkspaceId,
            refreshWorkspaces,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
