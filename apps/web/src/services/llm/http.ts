/**
 * Helpers HTTP compartidos por los providers LLM.
 *   - `mergeSignals`: combina el AbortSignal del usuario con un timeout interno.
 *   - `fetchWithRetry`: reintentos exponenciales en errores de red, 429 y 5xx.
 *
 * Por qué importa: providers free (Groq, Gemini, Mistral) tiran 429 con frecuencia
 * y Ollama local puede colgar minutos si el modelo está cargando — sin esto,
 * la UI quedaba inerte.
 */

const DEFAULT_TIMEOUT_MS = 45_000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface FetchWithRetryOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Cantidad de reintentos además del primer intento (0 = solo 1 intento). */
  retries?: number;
}

/** Combina varios AbortSignal en uno solo. Aborta cuando cualquiera aborta. */
export function mergeSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const filtered = signals.filter((s): s is AbortSignal => !!s);
  // AbortSignal.any es ES2024; fallback manual para compatibilidad.
  type AnyFn = (signals: AbortSignal[]) => AbortSignal;
  const anyFn = (AbortSignal as unknown as { any?: AnyFn }).any;
  if (typeof anyFn === 'function') return anyFn(filtered);
  const ctrl = new AbortController();
  for (const s of filtered) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => ctrl.abort(s.reason), { once: true });
  }
  return ctrl.signal;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Fetch con timeout + reintentos exponenciales (1.5s, 3s, 6s).
 *
 * - Reintenta en errores de red (TypeError) y respuestas con status retryable.
 * - NO reintenta en 4xx (excepto 408/425/429).
 * - NO reintenta si el AbortController del usuario aborta.
 */
export async function fetchWithRetry(
  input: string,
  init: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    signal: userSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 2,
    ...rest
  } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
    try {
      const resp = await fetch(input, {
        ...rest,
        signal: mergeSignals(userSignal, timeoutCtrl.signal),
      });
      clearTimeout(timeoutId);
      if (!RETRYABLE_STATUSES.has(resp.status)) return resp;
      // 429/5xx: leemos para liberar el body, esperamos backoff y reintentamos.
      if (attempt === retries) return resp;
      lastErr = new Error(`HTTP ${resp.status}`);
      // intentamos respetar Retry-After (segundos) si vino, capeado a 8s
      const ra = resp.headers.get('retry-after');
      const baseBackoff = 1500 * Math.pow(2, attempt);
      const retryAfterMs = ra ? Math.min(8000, Number(ra) * 1000 || 0) : 0;
      await resp.text().catch(() => '');
      await delay(Math.max(baseBackoff, retryAfterMs), userSignal);
    } catch (err) {
      clearTimeout(timeoutId);
      // Aborto del usuario: salir inmediato.
      if ((err as Error).name === 'AbortError' && userSignal?.aborted) throw err;
      lastErr = err;
      if (attempt === retries) throw err;
      await delay(1500 * Math.pow(2, attempt), userSignal);
    }
  }
  // Inalcanzable, pero TS no lo sabe.
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry: sin respuesta');
}
