/**
 * Storage adaptador para zustand/middleware `persist` que agrupa escrituras
 * a localStorage. Un drag rápido dispara 60+ sets por segundo; sin debounce,
 * escribimos el proyecto entero a localStorage cada frame (bloquea el main
 * thread y sincroniza con el store de Chrome).
 *
 * Con debounce: reads son instantáneos desde cache; writes se agrupan y
 * aplican `delayMs` después de la última mutación (trailing debounce).
 * Se flushea también en `beforeunload` por seguridad.
 */
import type { StateStorage } from 'zustand/middleware';

export function createDebouncedLocalStorage(delayMs = 300): StateStorage {
  const pending = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (key: string) => {
    const value = pending.get(key);
    if (value !== undefined) {
      try { localStorage.setItem(key, value); } catch (err) { console.warn('localStorage write failed', err); }
      pending.delete(key);
    }
    const t = timers.get(key);
    if (t) clearTimeout(t);
    timers.delete(key);
  };

  // Flush al salir de la página para no perder el último cambio pendiente.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      pending.forEach((_, key) => flush(key));
    });
    // También en visibilitychange (tab hidden) para apps en bg.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        pending.forEach((_, key) => flush(key));
      }
    });
  }

  return {
    getItem: (key) => {
      // Leemos del pending si está ahí (más fresco que localStorage), sino del disco.
      if (pending.has(key)) return pending.get(key) ?? null;
      try { return localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key, value) => {
      pending.set(key, value);
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(key, setTimeout(() => flush(key), delayMs));
    },
    removeItem: (key) => {
      pending.delete(key);
      const t = timers.get(key);
      if (t) clearTimeout(t);
      timers.delete(key);
      try { localStorage.removeItem(key); } catch {}
    },
  };
}
