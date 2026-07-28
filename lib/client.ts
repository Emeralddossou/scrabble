export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type ApiResponse<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string }; requestId: string };

export async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
      credentials: 'same-origin',
      signal: controller.signal,
    });
    const result = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !result.ok) {
      const error = result.ok
        ? { code: 'HTTP_ERROR', message: 'La requête a échoué.' }
        : result.error;
      throw new ApiClientError(error.code, error.message, response.status);
    }
    return result.data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function cached<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export function putCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}

export function clearPrivateCache(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key === 'dashboard' || key?.startsWith('game:')) localStorage.removeItem(key);
    }
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}

/** Compatibility facade for existing screens; it dispatches to resource routes, never to an RPC endpoint. */
export async function rpc<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (action === 'dashboard') return api<T>('/api/dashboard');
  if (action === 'logout') {
    const result = await api<T>('/api/auth/logout', { method: 'POST', body: '{}' });
    clearPrivateCache();
    return result;
  }
  if (action === 'state') return api<T>(`/api/games/${payload.gameId}`);
  if (action === 'createSolo') {
    return api<T>('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        mode: payload.mode,
        timeLimitMinutes: payload.timeLimit,
        incrementSeconds: payload.increment,
        aiLevel: payload.aiLevel ?? 'medium',
      }),
    });
  }
  if (action === 'invite') {
    return api<T>('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({
        toUserId: payload.toUserId,
        mode: payload.mode,
        timeLimitMinutes: payload.timeLimit,
        incrementSeconds: payload.increment,
      }),
    });
  }
  if (action === 'respondInvite') {
    return api<T>(`/api/invitations/${payload.inviteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: payload.accept ? 'accept' : 'decline' }),
    });
  }
  if (action === 'cancelInvite') {
    return api<T>(`/api/invitations/${payload.inviteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    });
  }
  if (action === 'play') {
    return api<T>(`/api/games/${payload.gameId}/moves`, {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: payload.version,
        placements: payload.placements,
        actionId: crypto.randomUUID(),
      }),
    });
  }
  if (action === 'gameAction') {
    return api<T>(`/api/games/${payload.gameId}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: payload.version,
        kind: payload.kind,
        tileIds: payload.tileIds,
        actionId: crypto.randomUUID(),
      }),
    });
  }
  throw new ApiClientError('UNSUPPORTED_CLIENT_ACTION', 'Action client inconnue.', 400);
}
