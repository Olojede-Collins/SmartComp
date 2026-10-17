import type { Condition } from '@/app/_components/condition-enum';

export type { Condition };

export interface Equipment {
  id: string;
  name: string;
  core_functionality: string | null;
  other_functionality: string | null;
  condition: Condition;
  quantity: number;
  image_keys: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export function getSupabaseConfig(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';
  return { supabaseUrl, supabaseAnonKey };
}

export async function postgrestSelect<T>(
  table: string,
  queryParams?: Record<string, string>,
): Promise<T> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  const cleanUrl = supabaseUrl.replace(/\/+$/, '');
  const search =
    queryParams && Object.keys(queryParams).length > 0
      ? `?${new URLSearchParams(queryParams).toString()}`
      : '';
  const endpoint = `${cleanUrl}/rest/v1/${table}${search}`;

  const res = await globalThis.fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`PostgREST error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}
