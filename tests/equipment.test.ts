import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSupabaseConfig,
  postgrestSelect,
  type Equipment,
} from '@/lib/supabase';
import {
  getEquipment,
  getEquipmentById,
  _clearEquipmentCache,
  _setLastKnownGoodEquipment,
} from '@/lib/equipment';

const mockItem1: Equipment = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Digital Oscilloscope',
  core_functionality: 'Signal waveform capture and frequency analysis',
  other_functionality: 'FFT spectrum analysis and USB data logging',
  condition: 'Working',
  quantity: 4,
  image_keys: ['oscilloscope-hero.webp', 'oscilloscope-front.webp'],
  created_at: '2026-10-15T10:00:00.000Z',
  updated_at: '2026-10-15T10:00:00.000Z',
  updated_by: null,
};

const mockItem2: Equipment = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Soldering Station',
  core_functionality: 'Temperature-controlled precision soldering',
  other_functionality: null,
  condition: 'Under Maintenance',
  quantity: 2,
  image_keys: [],
  created_at: '2026-10-14T08:30:00.000Z',
  updated_at: '2026-10-14T08:30:00.000Z',
  updated_by: '550e8400-e29b-41d4-a716-446655440099',
};

describe('lib/supabase', () => {
  const originalEnvUrl = process.env.SUPABASE_URL;
  const originalEnvKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-anon-key-xyz';
    _clearEquipmentCache();
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalEnvUrl;
    process.env.SUPABASE_ANON_KEY = originalEnvKey;
    vi.restoreAllMocks();
  });

  it('getSupabaseConfig returns SUPABASE_URL and SUPABASE_ANON_KEY from environment', () => {
    const config = getSupabaseConfig();
    expect(config.supabaseUrl).toBe('https://mock.supabase.co');
    expect(config.supabaseAnonKey).toBe('mock-anon-key-xyz');
  });

  it('postgrestSelect executes fetch with expected URL and headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([mockItem1]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await postgrestSelect<Equipment[]>('equipment', {
      order: 'created_at.desc',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://mock.supabase.co/rest/v1/equipment?order=created_at.desc',
      {
        method: 'GET',
        headers: {
          apikey: 'mock-anon-key-xyz',
          Authorization: 'Bearer mock-anon-key-xyz',
          Accept: 'application/json',
        },
      },
    );
    expect(result).toEqual([mockItem1]);
  });

  it('postgrestSelect strips trailing slash from SUPABASE_URL', async () => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co/';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await postgrestSelect<Equipment[]>('equipment');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://mock.supabase.co/rest/v1/equipment',
      expect.any(Object),
    );
  });

  it('postgrestSelect throws structured Error on non-200 HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(postgrestSelect<Equipment[]>('equipment')).rejects.toThrow(
      'PostgREST error: 500 Internal Server Error',
    );
  });

  it('postgrestSelect throws error when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL;
    await expect(postgrestSelect<Equipment[]>('equipment')).rejects.toThrow(
      'Supabase configuration missing',
    );
  });
});

describe('lib/equipment', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-anon-key-xyz';
    _clearEquipmentCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    _clearEquipmentCache();
    vi.restoreAllMocks();
  });

  it('getEquipment returns equipment list on success and updates cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([mockItem1, mockItem2]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const items = await getEquipment();
    expect(items).toEqual([mockItem1, mockItem2]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRejectedValueOnce(new Error('Network error'));
    const cachedItems = await getEquipment();
    expect(cachedItems).toEqual([mockItem1, mockItem2]);
  });

  it('getEquipment falls back to last-known-good cache on fetch failure', async () => {
    _setLastKnownGoodEquipment([mockItem1]);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('PostgREST offline'),
    );

    const items = await getEquipment();
    expect(items).toEqual([mockItem1]);
  });

  it('getEquipment returns empty array when fetch fails and cache is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    const items = await getEquipment();
    expect(items).toEqual([]);
  });

  it('getEquipmentById returns equipment item when found', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([mockItem1]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const item = await getEquipmentById(mockItem1.id);
    expect(item).toEqual(mockItem1);
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://mock.supabase.co/rest/v1/equipment?id=eq.${mockItem1.id}&select=*`,
      expect.any(Object),
    );
  });

  it('getEquipmentById returns null when item is not found in database', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const item = await getEquipmentById('00000000-0000-0000-0000-000000000000');
    expect(item).toBeNull();
  });

  it('getEquipmentById returns null immediately for invalid UUID without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const resultInvalid1 = await getEquipmentById('not-a-uuid');
    const resultInvalid2 = await getEquipmentById('');

    expect(resultInvalid1).toBeNull();
    expect(resultInvalid2).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getEquipmentById falls back to cached item on fetch failure', async () => {
    _setLastKnownGoodEquipment([mockItem1, mockItem2]);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('503 Service Unavailable'),
    );

    const item = await getEquipmentById(mockItem1.id);
    expect(item).toEqual(mockItem1);
  });

  it('getEquipmentById returns null on fetch failure when item is not cached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('503 Service Unavailable'),
    );

    const item = await getEquipmentById(mockItem1.id);
    expect(item).toBeNull();
  });

  it('_clearEquipmentCache resets both list and item cache', async () => {
    _setLastKnownGoodEquipment([mockItem1]);
    _clearEquipmentCache();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Outage'));

    const items = await getEquipment();
    expect(items).toEqual([]);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Outage'));
    const item = await getEquipmentById(mockItem1.id);
    expect(item).toBeNull();
  });
});
