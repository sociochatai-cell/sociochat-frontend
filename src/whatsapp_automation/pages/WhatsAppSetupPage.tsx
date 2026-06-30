/**
 * WhatsApp Setup Page
 * ====================
 * 
 * Wrapper component that handles workspace ID resolution and renders
 * the WhatsAppConnectionRouter with proper context.
 * 
 * This ensures workspace ID is always available from:
 * 1. URL params (workspace/:id/whatsapp-setup)
 * 2. localStorage (sv_whatsapp_workspace_id or sv_selected_workspace_id)
 * 3. User session
 */

import React, { useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { WhatsAppConnectionRouter } from './WhatsAppConnectionRouter';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';

export const WhatsAppSetupPage: React.FC = () => {
    const { id: paramWorkspaceId } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    // Get workspace ID from URL query params
    const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const queryWorkspaceId = urlParams.get('workspace_id');

    // Resolve workspace ID with priority: URL param > query param > localStorage > user session
    const workspaceId = useMemo(() => {
        // Priority 1: URL path param (/workspace/:id/whatsapp-setup)
        if (paramWorkspaceId) {
            return paramWorkspaceId;
        }

        // Priority 2: Query param (?workspace_id=xxx)
        if (queryWorkspaceId) {
            return queryWorkspaceId;
        }

        // Priority 3: Centralized workspace ID utility
        const storedWorkspaceId = getWorkspaceId();
        if (storedWorkspaceId) {
            return storedWorkspaceId;
        }

        // Priority 5: Try to get from user session
        try {
            const userJson = localStorage.getItem('sv_user');
            if (userJson) {
                const user = JSON.parse(userJson);
                if (user.workspace_id) {
                    return String(user.workspace_id);
                }
                // Some users have default_workspace_id
                if (user.default_workspace_id) {
                    return String(user.default_workspace_id);
                }
            }
        } catch {
            // Ignore parse errors
        }

        // Fallback: empty string (router will handle gracefully)
        return '';
    }, [paramWorkspaceId, queryWorkspaceId]);

    const handleConnectionComplete = () => {
        // Navigate back to the main dashboard after successful connection
        navigate('/dashboard/whatsapp');
    };

    return (
        <WhatsAppConnectionRouter
            workspaceId={workspaceId}
            onConnectionComplete={handleConnectionComplete}
        />
    );
};

export default WhatsAppSetupPage;
