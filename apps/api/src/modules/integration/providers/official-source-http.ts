export interface OfficialJsonRequest<T> {
  url: string;
  sourceName: string;
  emptyBody: T;
  timeoutMs?: number;
  maxAttempts?: number;
  headers?: Record<string, string>;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

class OfficialSourceHttpError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'OfficialSourceHttpError';
  }
}

function retryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(10_000, retryAfterSeconds * 1_000);
  }

  const exponential = 250 * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(5_000, exponential + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOfficialJson<T>({
  url,
  sourceName,
  emptyBody,
  timeoutMs = 30_000,
  maxAttempts = 4,
  headers = {},
}: OfficialJsonRequest<T>): Promise<T> {
  const attempts = Math.max(1, maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LicitaIA-PublicSource/1.0',
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();

      if (!response.ok) {
        const error = new OfficialSourceHttpError(
          `${sourceName} HTTP ${response.status}: ${text.slice(0, 300)}`,
          RETRYABLE_STATUS.has(response.status),
        );
        if (!error.retryable || attempt >= attempts) throw error;
        lastError = error;
        await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
        continue;
      }

      if (!text.trim()) return emptyBody;

      try {
        return JSON.parse(text) as T;
      } catch {
        const error = new OfficialSourceHttpError(
          `${sourceName} returned a non-JSON body: ${text.slice(0, 300)}`,
          true,
        );
        if (attempt >= attempts) throw error;
        lastError = error;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof OfficialSourceHttpError && !error.retryable) throw error;
      if (attempt >= attempts) throw error;
    }

    await sleep(retryDelayMs(attempt));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${sourceName} request failed after retries`);
}
