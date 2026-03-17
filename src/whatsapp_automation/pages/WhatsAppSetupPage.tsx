/**
 * WhatsApp Setup Page
 * ====================
 * 
 * Wrapper component that handles workspace ID resolution and renders
 * the WhatsAppConnectionRouter with proper context.
 * 
 * Resolves workspace ID from (in priority order):
 * 1. URL params (workspace/:id/whatsapp-setup)
 * 2. Query params (?workspace_id=xxx)
 * 3. sessionStorage / localStorage
 * 4. User session object
 * 5. API fetch (/api/workspaces)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { WhatsAppConnectionRouter } from './WhatsAppConnectionRouter';
import { API_BASE_URL } from '@/config';

export const WhatsAppSetupPage: React.FC = () => {
    const { id: paramWorkspaceId } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [workspaceId, setWorkspaceId] = useState<string>('');
    const [resolving, setResolving] = useState(true);

    useEffect(() => {
        const resolveWorkspaceId = async () => {
            const urlParams = new URLSearchParams(location.search);
            const queryWorkspaceId = urlParams.get('workspace_id');

            // Priority 1: URL path param
            if (paramWorkspaceId) {
                setWorkspaceId(paramWorkspaceId);
                setResolving(false);
                return;
            }

            // Priority 2: Query param
            if (queryWorkspaceId) {
                setWorkspaceId(queryWorkspaceId);
                setResolving(false);
                return;
            }

            // Priority 3: Storage (session first, then local)
            const storageId =
                sessionStorage.getItem('sv_whatsapp_workspace_id') ||
                localStorage.getItem('sv_whatsapp_workspace_id') ||
                sessionStorage.getItem('sv_selected_workspace_id') ||
                localStorage.getItem('sv_selected_workspace_id');
            if (storageId) {
                setWorkspaceId(storageId);
                setResolving(false);
                return;
            }

            // Priority 4: User session object
            try {
                const userJson = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
                if (userJson) {
                    const user = JSON.parse(userJson);
                    const id = user.workspace_id || user.default_workspace_id;
                    if (id) {
                        setWorkspaceId(String(id));
                        setResolving(false);
                        return;
                    }
                }
            } catch { /* ignore */ }

            // Priority 5: Fetch from API
            try {
                const token = localStorage.getItem('sv_token') || sessionStorage.getItem('sv_token');
                const userId = localStorage.getItem('sv_user_id');
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                if (userId) headers['X-User-Id'] = userId;

                const res = await fetch(`${API_BASE_URL}/api/workspaces`, {
                    credentials: 'include',
                    headers,
                });
                const data = await res.json();
                if (data.workspaces?.length > 0) {
                    const wsId = String(data.workspaces[0].id);
                    sessionStorage.setItem('sv_whatsapp_workspace_id', wsId);
                    setWorkspaceId(wsId);
                    setResolving(false);
                    return;
                }
            } catch (err) {
                console.error('[WhatsAppSetupPage] Failed to fetch workspaces:', err);
            }

            // Nothing found
            setResolving(false);
        };

        resolveWorkspaceId();
    }, [paramWorkspaceId, location.search]);

    const handleConnectionComplete = () => {
        navigate('/dashboard');
    };

    if (resolving) {
        return null; // DashboardLayout shows its own loading
    }

    return (
        <WhatsAppConnectionRouter
            workspaceId={workspaceId}
            onConnectionComplete={handleConnectionComplete}
        />
    );
};

export default WhatsAppSetupPage;
