/** A request that never got an HTTP response (offline, blocked, DNS, timeout). */
export class NetworkError extends Error {
  readonly host: string
  constructor(host: string, cause: unknown) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    super(timedOut ? `${host} took too long to respond` : `Couldn’t reach ${host}`, { cause })
    this.name = 'NetworkError'
    this.host = host
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Options = RequestInit & {
  /** Abort after this long (default 12s). */
  timeoutMs?: number
  /** Extra attempts after a network error, 429 or 5xx (default 1). */
  retries?: number
}

/**
 * `fetch` for third-party APIs (explorers, prices): adds a timeout and retries
 * transient failures with backoff. 4xx responses are returned, not retried.
 */
export async function fetchWithRetry(url: string, { timeoutMs = 12_000, retries = 1, ...init }: Options = {}) {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init.signal && 'any' in AbortSignal ? AbortSignal.any([init.signal, timeout]) : timeout
    try {
      const res = await fetch(url, { ...init, signal })
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const wait = Number(res.headers.get('retry-after'))
        await sleep(wait > 0 && wait <= 10 ? wait * 1000 : 800 * 2 ** attempt)
        continue
      }
      return res
    } catch (error) {
      if (init.signal?.aborted) throw error
      if (attempt >= retries) throw new NetworkError(hostOf(url), error)
      await sleep(800 * 2 ** attempt)
    }
  }
}

/** A non-OK HTTP response from a third-party API. */
export class HttpError extends Error {
  readonly status: number
  constructor(res: Response, what = 'Request') {
    super(`${what} failed (${res.status}) at ${hostOf(res.url)}`)
    this.name = 'HttpError'
    this.status = res.status
  }
}

/** React Query retry policy: don't retry answers that won't change (bad request, not found…). */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof HttpError && error.status < 500 && error.status !== 408 && error.status !== 429) return false
  return failureCount < 2
}
