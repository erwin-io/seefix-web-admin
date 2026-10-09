import { effect, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { toAppError } from '../http/app-error';

/**
 * Page data holder: loading / error / value signals plus reload().
 * Signals read while building the request (route id, filters) re-trigger it.
 * Must be called in an injection context (field initializer).
 */
export function load<T>(fetch: () => Observable<T>) {
  const value = signal<T | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);
  let seq = 0;

  async function run(request: Observable<T>): Promise<void> {
    const mine = ++seq;
    loading.set(true);
    error.set(null);
    try {
      const v = await firstValueFrom(request);
      if (mine === seq) value.set(v);
    } catch (e) {
      if (mine === seq) error.set(toAppError(e).message);
    } finally {
      if (mine === seq) loading.set(false);
    }
  }

  effect(() => {
    const request = fetch();
    untracked(() => void run(request));
  });

  return { value, loading, error, reload: () => run(untracked(fetch)) };
}
