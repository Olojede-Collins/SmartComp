export interface AdminUser {
  id: string;
  email: string;
  app_metadata: {
    role?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AdminSession {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  user: AdminUser;
}

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

let testingSession: AdminSession | null = null;

export function getAdminAuthConfig(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  return { supabaseUrl, supabaseAnonKey };
}

export function setSessionForTesting(session: AdminSession | null): void {
  testingSession = session;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    if (session) {
      window.sessionStorage.setItem(
        'sb-admin-session',
        JSON.stringify(session),
      );
      window.sessionStorage.setItem('sb-admin-token', session.access_token);
    } else {
      window.sessionStorage.removeItem('sb-admin-session');
      window.sessionStorage.removeItem('sb-admin-token');
    }
  }
  if (typeof document !== 'undefined') {
    if (session) {
      document.cookie = `sb-admin-token=${session.access_token}; path=/; SameSite=Lax`;
    } else {
      document.cookie =
        'sb-admin-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  }
}

export function getSession(): AdminSession | null {
  if (testingSession) {
    return testingSession;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const raw = window.sessionStorage.getItem('sb-admin-session');
    if (raw) {
      try {
        return JSON.parse(raw) as AdminSession;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getToken(): string | null {
  const session = getSession();
  if (session?.access_token) {
    return session.access_token;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const token = window.sessionStorage.getItem('sb-admin-token');
    if (token) return token;
  }
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)sb-admin-token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AdminSession> {
  const { supabaseUrl, supabaseAnonKey } = getAdminAuthConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError(
      'config-missing',
      500,
      'Supabase configuration missing',
    );
  }

  const cleanUrl = supabaseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/auth/v1/token?grant_type=password`;

  const res = await globalThis.fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let errorCode = 'invalid-credentials';
    let errorMessage = 'Invalid credentials';
    try {
      const errorJson = await res.json();
      if (errorJson.error_code) {
        errorCode = errorJson.error_code;
      } else if (errorJson.error) {
        errorCode = errorJson.error;
      }
      if (errorJson.msg) {
        errorMessage = errorJson.msg;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      } else if (errorJson.error_description) {
        errorMessage = errorJson.error_description;
      }
    } catch {}
    if (
      errorCode === 'invalid_grant' ||
      res.status === 400 ||
      res.status === 401
    ) {
      errorCode = 'invalid-credentials';
    }
    throw new AuthError(errorCode, res.status, errorMessage);
  }

  const data = (await res.json()) as AdminSession;

  if (data.user?.app_metadata?.role !== 'admin') {
    throw new AuthError('forbidden', 403, 'Admin privileges required');
  }

  setSessionForTesting(data);
  return data;
}

export function signOut(): void {
  setSessionForTesting(null);
}
