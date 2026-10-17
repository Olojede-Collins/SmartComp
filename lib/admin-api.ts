import { getToken } from './admin-auth';
import type { Equipment, Condition } from './supabase';

export type { Equipment, Condition };

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export interface CreateEquipmentPayload {
  name: string;
  core_functionality: string | null;
  other_functionality?: string | null;
  condition: Condition;
  quantity: number;
  image_keys?: string[];
}

export interface UpdateEquipmentPayload {
  name?: string;
  core_functionality?: string | null;
  other_functionality?: string | null;
  condition?: Condition;
  quantity?: number;
  image_keys?: string[];
}

export interface RequestOptions {
  token?: string;
  onSlow?: () => void;
  slowDelayMs?: number;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getBackendBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_RENDER_SERVICE_URL ||
    process.env.RENDER_SERVICE_URL ||
    'http://localhost:3001';
  return url.replace(/\/+$/, '');
}

async function request<T>(
  path: string,
  method: string,
  payload?: unknown,
  options?: RequestOptions,
  requireAuth = true,
): Promise<T> {
  const baseUrl = getBackendBaseUrl();
  const endpoint = `${baseUrl}${path}`;
  const token = requireAuth ? (options?.token ?? getToken()) : undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  let slowTimer: ReturnType<typeof setTimeout> | undefined;
  if (options?.onSlow) {
    const delay = options.slowDelayMs ?? 3000;
    slowTimer = setTimeout(() => {
      options.onSlow?.();
    }, delay);
  }

  try {
    const res = await globalThis.fetch(endpoint, {
      method,
      headers,
      body,
      signal: options?.signal,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    if (!res.ok) {
      let code = 'request-failed';
      let message = `Request failed with status ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) {
          code = errorJson.error;
        }
        if (errorJson.message) {
          message = errorJson.message;
        }
      } catch {}
      throw new ApiError(code, res.status, message);
    }

    return (await res.json()) as T;
  } finally {
    if (slowTimer) {
      clearTimeout(slowTimer);
    }
  }
}

export async function getItems(options?: RequestOptions): Promise<Equipment[]> {
  return request<Equipment[]>('/api/admin/items', 'GET', undefined, options);
}

export async function getItemById(
  id: string,
  options?: RequestOptions,
): Promise<Equipment> {
  return request<Equipment>(
    `/api/admin/items/${id}`,
    'GET',
    undefined,
    options,
  );
}

export async function createItem(
  payload: CreateEquipmentPayload,
  options?: RequestOptions,
): Promise<Equipment> {
  return request<Equipment>('/api/admin/items', 'POST', payload, options);
}

export async function updateItem(
  id: string,
  payload: UpdateEquipmentPayload,
  options?: RequestOptions,
): Promise<Equipment> {
  return request<Equipment>(
    `/api/admin/items/${id}`,
    'PATCH',
    payload,
    options,
  );
}

export async function deleteItem(
  id: string,
  options?: RequestOptions,
): Promise<void> {
  return request<void>(`/api/admin/items/${id}`, 'DELETE', undefined, options);
}

export async function getAdmins(
  options?: RequestOptions,
): Promise<AdminUser[]> {
  return request<AdminUser[]>('/api/admin/admins', 'GET', undefined, options);
}

export async function createInvite(
  email: string,
  options?: RequestOptions,
): Promise<{ id: string; email: string; token: string; acceptUrl?: string }> {
  return request<{
    id: string;
    email: string;
    token: string;
    acceptUrl?: string;
  }>('/api/admin/admins/invites', 'POST', { email }, options);
}

export async function deleteAdmin(
  id: string,
  options?: RequestOptions,
): Promise<void> {
  return request<void>(`/api/admin/admins/${id}`, 'DELETE', undefined, options);
}

export async function getInviteDetails(
  token: string,
  options?: RequestOptions,
): Promise<{ email: string }> {
  return request<{ email: string }>(
    `/api/admin/invites/verify?token=${encodeURIComponent(token)}`,
    'GET',
    undefined,
    options,
    false,
  );
}

export async function acceptInvite(
  token: string,
  name?: string,
  password?: string,
  options?: RequestOptions,
): Promise<{ status: string }> {
  return request<{ status: string }>(
    '/api/admin/invites/accept',
    'POST',
    { token, name, password },
    options,
    false,
  );
}

export async function exportInventory(
  format: 'pdf' | 'csv',
  options?: RequestOptions,
): Promise<Blob> {
  const baseUrl = getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/admin/export/${format}`;
  const token = options?.token ?? getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let slowTimer: ReturnType<typeof setTimeout> | undefined;
  if (options?.onSlow) {
    const delay = options.slowDelayMs ?? 3000;
    slowTimer = setTimeout(() => {
      options.onSlow?.();
    }, delay);
  }

  try {
    const res = await globalThis.fetch(endpoint, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (!res.ok) {
      let code = 'request-failed';
      let message = `Request failed with status ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) {
          code = errorJson.error;
        }
        if (errorJson.message) {
          message = errorJson.message;
        }
      } catch {}
      throw new ApiError(code, res.status, message);
    }

    return await res.blob();
  } finally {
    if (slowTimer) {
      clearTimeout(slowTimer);
    }
  }
}
