import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/apiClient";

export function useSessionCheck() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        let mounted = true;

        async function checkSession() {
            try {
                // Use apiClient to ensure X-User-Id is sent
                const resp = await apiClient.get("/me");

                if (!mounted) return;

                if (!resp.ok) {
                    // Try to recover user from localStorage if request fails (fallback for non-cookie auth)
                    const raw = localStorage.getItem("sv_user");
                    if (raw) {
                        try {
                            const u = JSON.parse(raw);
                            if (u?.id) {
                                setUser(u);
                                return;
                            }
                        } catch { }
                    }

                    navigate("/login");
                    return;
                }

                const fetchedUser = resp.data?.user ?? resp.data;

                if (!fetchedUser?.id) {
                    navigate("/login");
                    return;
                }

                setUser(fetchedUser);

                // Update storage to keep it fresh
                try {
                    localStorage.setItem("sv_user", JSON.stringify(fetchedUser));
                    sessionStorage.setItem("sv_user", JSON.stringify(fetchedUser));
                    if (fetchedUser.id) localStorage.setItem("sv_user_id", String(fetchedUser.id));
                } catch { }

            } catch (err) {
                console.error("Session check failed:", err);
                if (mounted) navigate("/login");
            } finally {
                if (mounted) setLoading(false);
            }
        }

        checkSession();

        return () => {
            mounted = false;
        };
    }, [navigate]);

    return { loading, user };
}
