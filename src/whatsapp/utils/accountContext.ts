/**
 * WhatsApp Account Context
 * ========================
 * 
 * Centralized management for the active WhatsApp account ID.
 * This ensures all WhatsApp features use the same account consistently.
 * 
 * Storage Key: sv_whatsapp_account_id
 * Stored in: sessionStorage (cleared on tab close) + localStorage (persisted)
 */

const ACCOUNT_STORAGE_KEY = 'sv_whatsapp_account_id';

/**
 * Get the stored active WhatsApp account ID
 * Checks sessionStorage first, then localStorage
 */
export function getStoredAccountId(): number | null {
    const sessionValue = sessionStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (sessionValue) {
        return parseInt(sessionValue, 10);
    }

    const localValue = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (localValue) {
        return parseInt(localValue, 10);
    }

    return null;
}

/**
 * Set the active WhatsApp account ID
 * Stores in both sessionStorage and localStorage for persistence
 */
export function setStoredAccountId(accountId: number): void {
    const value = accountId.toString();
    sessionStorage.setItem(ACCOUNT_STORAGE_KEY, value);
    localStorage.setItem(ACCOUNT_STORAGE_KEY, value);
    console.log(`[WhatsApp] Active account set to: ${accountId}`);
}

/**
 * Clear the stored account ID (e.g., on logout or unlink)
 */
export function clearStoredAccountId(): void {
    sessionStorage.removeItem(ACCOUNT_STORAGE_KEY);
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    console.log('[WhatsApp] Active account cleared');
}

/**
 * Get the active account ID, with fallback to fetching from API
 * This is the main function to use throughout the app
 */
export async function getActiveAccountId(apiBase: string): Promise<number | null> {
    // First check stored value
    const storedId = getStoredAccountId();
    if (storedId) {
        return storedId;
    }

    // If not stored, fetch from API and store the active one
    try {
        const res = await fetch(`${apiBase}/api/whatsapp/accounts`, {
            credentials: 'include',
        });
        const data = await res.json();

        if (data.success && data.accounts?.length > 0) {
            // Priority: is_active=true > most recently created
            const activeAccount = data.accounts.find((a: any) => a.is_active);
            const account = activeAccount || data.accounts[data.accounts.length - 1];

            if (account?.id) {
                setStoredAccountId(account.id);
                return account.id;
            }
        }
    } catch (err) {
        console.error('[WhatsApp] Failed to fetch accounts:', err);
    }

    return null;
}

/**
 * Sync stored account ID with API (call this on app init or settings page)
 * Validates that the stored account still exists and is active
 */
export async function validateStoredAccount(apiBase: string): Promise<number | null> {
    const storedId = getStoredAccountId();

    try {
        const res = await fetch(`${apiBase}/api/whatsapp/accounts`, {
            credentials: 'include',
        });
        const data = await res.json();

        if (data.success && data.accounts?.length > 0) {
            // Check if stored account exists in the list
            const storedExists = storedId && data.accounts.some((a: any) => a.id === storedId);

            if (storedExists) {
                return storedId;
            }

            // Stored account doesn't exist, set to active account
            const activeAccount = data.accounts.find((a: any) => a.is_active)
                || data.accounts[data.accounts.length - 1];

            if (activeAccount?.id) {
                setStoredAccountId(activeAccount.id);
                return activeAccount.id;
            }
        }
    } catch (err) {
        console.error('[WhatsApp] Failed to validate account:', err);
    }

    // Clear invalid stored ID
    if (storedId) {
        clearStoredAccountId();
    }

    return null;
}
