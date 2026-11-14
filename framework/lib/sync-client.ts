// HTTP client for the framework's sync API (see framework/cloudflare/).
// Framework-owned: eject with `qb reveal framework/lib/sync-client.ts`.

import type { Bank } from '../../core/types.ts';

/** What the storage modules need from a bank: its namespace and optional sync endpoint. */
export type StorageTarget = Pick<Bank, 'namespace' | 'sync'>;

export function syncEnabled(target: StorageTarget): boolean {
  return typeof window !== 'undefined' && !!target.sync?.url;
}

/** JSON request against `<sync.url>/<namespace><path>`. Throws on network or HTTP errors. */
export async function syncRequest<T>(
  target: StorageTarget,
  path: string,
  init?: { method?: 'GET' | 'PUT' | 'DELETE'; body?: unknown },
): Promise<{ status: number; data: T }> {
  if (!target.sync?.url) throw new Error('Sync is not configured for this bank.');
  const base = target.sync.url.replace(/\/+$/, '');
  const response = await fetch(`${base}/${encodeURIComponent(target.namespace)}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
  });
  if (!response.ok && response.status !== 410) {
    throw new Error(`Sync request failed: ${response.status} ${response.statusText}`);
  }
  return { status: response.status, data: (await response.json()) as T };
}

export function readLocal<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
}
