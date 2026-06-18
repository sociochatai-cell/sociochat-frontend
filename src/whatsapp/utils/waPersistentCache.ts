/** Lightweight fetch wrapper (parity with reference waPersistentCache). */
export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, { credentials: 'include', ...options });
}
