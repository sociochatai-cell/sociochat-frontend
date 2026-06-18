import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    loginLocal: () => {},
    logoutLocal: () => {},
    refreshUser: async () => {},
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
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include',
                headers: { 'X-User-Id': userId },
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

    return (
        <AuthContext.Provider value={{ user, loading, loginLocal, logoutLocal, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
