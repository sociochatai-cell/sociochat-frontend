/**
 * Fetch with AbortController timeout — avoids requests stuck "pending" for minutes.
 */
export class FetchTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchTimeoutError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
        timeoutMs,
      );
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
