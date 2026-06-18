import { API_BASE_URL } from '@/config';

function adminHeaders(): HeadersInit {
    const adminId = localStorage.getItem('sv_admin_id') || sessionStorage.getItem('sv_admin_id');
    return {
        'Content-Type': 'application/json',
        ...(adminId ? { 'X-Admin-Id': adminId } : {}),
    };
}

export const adminApi = {
    login: async (email: string, password: string) => {
        const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });
        return res.json();
    },

    logout: async () => {
        await fetch(`${API_BASE_URL}/api/admin/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
        });
    },

    getUsers: async () => {
        const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    updateUser: async (userId: number, data: Record<string, unknown>) => {
        const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify(data),
        });
        return res.json();
    },

    loginAsUser: async (userId: number) => {
        const res = await fetch(`${API_BASE_URL}/api/admin/login-as-user`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ user_id: userId }),
        });
        return res.json();
    },

    getReviewUsers: async () => {
        const res = await fetch(`${API_BASE_URL}/api/admin/review`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    approveUser: async (userId: number) => {
        const res = await fetch(`${API_BASE_URL}/api/admin/approve/${userId}`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    getSubscriptionStats: async () => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/stats`, {
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    getPlansMatrix: async () => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/plans`, {
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    updatePlanFeatures: async (slug: string, features: Record<string, { enabled: boolean; limit_value?: number | null }>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/plans/${slug}/features`, {
            method: 'PUT',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ features }),
        });
        return res.json();
    },

    updatePlanCatalog: async (slug: string, data: Record<string, unknown>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/plans/${slug}`, {
            method: 'PUT',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify(data),
        });
        return res.json();
    },

    deletePlan: async (slug: string) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/plans/${slug}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    createPlan: async (data: Record<string, unknown>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/plans`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify(data),
        });
        return res.json();
    },

    getAuditLogs: async () => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/audit`, {
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    getPrivateSlot: async (search?: string) => {
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot${q}`, {
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    setPrivateSlotScope: async (userId: number, billing_scope: 'global' | 'private') => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/users/${userId}/scope`, {
            method: 'PATCH',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ billing_scope }),
        });
        return res.json();
    },

    setPrivateSlotScopeBulk: async (userIds: number[], billing_scope: 'global' | 'private') => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/users/scope`, {
            method: 'PATCH',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ user_ids: userIds, billing_scope }),
        });
        return res.json();
    },

    setPrivateSlotPlan: async (userId: number, plan: string) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/users/${userId}/plan`, {
            method: 'PUT',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ plan }),
        });
        return res.json();
    },

    createPrivatePlan: async (data: Record<string, unknown>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/plans`, {
            method: 'POST',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify(data),
        });
        return res.json();
    },

    updatePrivatePlan: async (slug: string, data: Record<string, unknown>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/plans/${slug}`, {
            method: 'PUT',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify(data),
        });
        return res.json();
    },

    deletePrivatePlan: async (slug: string) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/plans/${slug}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: adminHeaders(),
        });
        return res.json();
    },

    updatePrivatePlanFeatures: async (slug: string, features: Record<string, { enabled: boolean; limit_value?: number | null }>) => {
        const res = await fetch(`${API_BASE_URL}/api/subscription/admin/private-slot/plans/${slug}/features`, {
            method: 'PUT',
            credentials: 'include',
            headers: adminHeaders(),
            body: JSON.stringify({ features }),
        });
        return res.json();
    },
};
