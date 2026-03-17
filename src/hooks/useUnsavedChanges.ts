/**
 * useUnsavedChanges Hook
 * =======================
 * Navigation guard that warns users before leaving a page with unsaved changes.
 * Uses React Router's useBlocker for SPA navigation blocking.
 * 
 * @example
 * const [hasChanges, setHasChanges] = useState(false);
 * const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasChanges);
 * 
 * // In your JSX:
 * {showDialog && <ConfirmDialog onConfirm={confirmNavigation} onCancel={cancelNavigation} />}
 */

import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';

export interface UseUnsavedChangesResult {
    /** True when the confirmation dialog should be shown */
    showDialog: boolean;
    /** Call this to confirm navigation and leave the page */
    confirmNavigation: () => void;
    /** Call this to cancel navigation and stay on the page */
    cancelNavigation: () => void;
    /** The blocker state for advanced use cases */
    isBlocked: boolean;
}

/**
 * Hook to block navigation when there are unsaved changes.
 * 
 * Features:
 * - Blocks React Router navigation (breadcrumbs, links, back button)
 * - Shows browser confirmation on page refresh/close
 * - Does not block if no changes
 * - Clean API for showing custom confirmation dialogs
 * 
 * @param hasChanges - Whether there are unsaved changes to protect
 * @param message - Optional custom message for browser beforeunload
 */
export function useUnsavedChanges(
    hasChanges: boolean,
    message: string = 'You have unsaved changes. Are you sure you want to leave?'
): UseUnsavedChangesResult {
    const [showDialog, setShowDialog] = useState(false);

    // Block React Router navigation
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasChanges && currentLocation.pathname !== nextLocation.pathname
    );

    // Show dialog when blocked
    useEffect(() => {
        if (blocker.state === 'blocked') {
            setShowDialog(true);
        }
    }, [blocker.state]);

    // Handle browser refresh/close
    useEffect(() => {
        if (!hasChanges) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            // Modern browsers ignore custom messages, but we need to set returnValue
            e.returnValue = message;
            return message;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges, message]);

    const confirmNavigation = useCallback(() => {
        setShowDialog(false);
        if (blocker.state === 'blocked') {
            blocker.proceed();
        }
    }, [blocker]);

    const cancelNavigation = useCallback(() => {
        setShowDialog(false);
        if (blocker.state === 'blocked') {
            blocker.reset();
        }
    }, [blocker]);

    return {
        showDialog,
        confirmNavigation,
        cancelNavigation,
        isBlocked: blocker.state === 'blocked',
    };
}

/**
 * Dialog component for unsaved changes confirmation.
 * Can be used standalone or customized.
 */
export interface UnsavedChangesDialogProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    description?: string;
}
