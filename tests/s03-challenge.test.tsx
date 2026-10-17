// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { revalidatePath } from 'next/cache';
import { POST } from '@/app/api/revalidate/route';
import {
  getEquipment,
  getEquipmentById,
  _clearEquipmentCache,
  _setLastKnownGoodEquipment,
  type Equipment,
} from '@/lib/equipment';
import RootLayout from '@/app/layout';
import Page from '@/app/page';
import RoomPage from '@/app/room/page';
import ItemPage from '@/app/item/[id]/page';
import PrivacyPage from '@/app/privacy/page';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: '--font-mock',
    className: 'font-mock',
  }),
}));

const mockNotFound = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const sampleItem1: Equipment = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Smart Create view Screen',
  core_functionality: 'Central presentation screen for lectures',
  other_functionality: 'Interactive whiteboard and screen casting',
  condition: 'Working',
  quantity: 1,
  image_keys: ['screen-hero.webp', 'screen-rear.webp'],
  created_at: '2026-10-15T10:00:00.000Z',
  updated_at: '2026-10-15T10:00:00.000Z',
  updated_by: null,
};

const sampleItem2: Equipment = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Monitors',
  core_functionality: 'Student workstations',
  other_functionality: null,
  condition: 'Faulty',
  quantity: 50,
  image_keys: [],
  created_at: '2026-10-14T08:30:00.000Z',
  updated_at: '2026-10-14T08:30:00.000Z',
  updated_by: '550e8400-e29b-41d4-a716-446655440099',
};

const sampleItemNullFields: Equipment = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  name: 'HDMI Splitter',
  core_functionality: null,
  other_functionality: null,
  condition: 'Under Maintenance',
  quantity: 2,
  image_keys: [],
  created_at: '2026-10-13T09:00:00.000Z',
  updated_at: '2026-10-13T09:00:00.000Z',
  updated_by: null,
};

describe('S-03 Adversarial Challenge Suite', () => {
  const originalEnvSecret = process.env.REVALIDATE_SECRET;
  const originalEnvUrl = process.env.SUPABASE_URL;
  const originalEnvKey = process.env.SUPABASE_ANON_KEY;
  const TEST_SERVER_SECRET = 'challenge-revalidate-secret-98765';

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    _clearEquipmentCache();
    process.env.REVALIDATE_SECRET = TEST_SERVER_SECRET;
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-anon-key-xyz';
  });

  afterEach(() => {
    cleanup();
    process.env.REVALIDATE_SECRET = originalEnvSecret;
    process.env.SUPABASE_URL = originalEnvUrl;
    process.env.SUPABASE_ANON_KEY = originalEnvKey;
    _clearEquipmentCache();
    vi.restoreAllMocks();
  });

  describe('Seam 1: POST /api/revalidate secret verification, timing attacks & payload resilience', () => {
    it('handles variable length candidate secrets without RangeError or crashing', async () => {
      const candidateLengths = [
        '',
        'a',
        'x'.repeat(16),
        'y'.repeat(31),
        'z'.repeat(32),
        'w'.repeat(64),
        'k'.repeat(1024),
      ];

      for (const candidate of candidateLengths) {
        const req = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'x-revalidate-secret': candidate,
          },
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data).toEqual({ error: 'invalid-secret' });
        expect(revalidatePath).not.toHaveBeenCalled();
      }
    });

    it('rejects multi-byte UTF-8, emojis, and null bytes when forged without throwing', async () => {
      const maliciousSecrets = [
        '\0',
        '🔒secret🔑',
        'ünîcødé-tökên',
        'null\x00byte\x00leak',
        '⚡'.repeat(100),
      ];

      for (const forged of maliciousSecrets) {
        const req = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ secret: forged }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data).toEqual({ error: 'invalid-secret' });
      }
    });

    it('verifies complex multi-byte and emoji secret when exact match', async () => {
      const complexSecret = '⚡🔒-abū-smårtcømp-këy-🔑-日本語';
      process.env.REVALIDATE_SECRET = complexSecret;

      const req = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secret: complexSecret }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.revalidated).toBe(true);
      expect(typeof data.now).toBe('number');
      expect(data.paths).toEqual(['/', '/room']);
      expect(revalidatePath).toHaveBeenCalledWith('/');
      expect(revalidatePath).toHaveBeenCalledWith('/room');
    });

    it('returns 401 when secret is missing in request headers and body', async () => {
      const req = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: 'invalid-secret' });
    });

    it('returns 401 on empty secret values across header, bearer, and body', async () => {
      const emptyHeaderReq = new Request(
        'http://localhost:3000/api/revalidate',
        {
          method: 'POST',
          headers: {
            'x-revalidate-secret': '',
          },
        },
      );
      const emptyHeaderRes = await POST(emptyHeaderReq);
      expect(emptyHeaderRes.status).toBe(401);

      const emptyBearerReq = new Request(
        'http://localhost:3000/api/revalidate',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer ',
          },
        },
      );
      const emptyBearerRes = await POST(emptyBearerReq);
      expect(emptyBearerRes.status).toBe(401);

      const emptyBodyReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: '' }),
      });
      const emptyBodyRes = await POST(emptyBodyReq);
      expect(emptyBodyRes.status).toBe(401);
    });

    it('returns 401 on forged secret across all accepted vectors', async () => {
      const headerReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'x-revalidate-secret': 'forged-secret-header' },
      });
      expect((await POST(headerReq)).status).toBe(401);

      const bearerReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { authorization: 'Bearer forged-secret-bearer' },
      });
      expect((await POST(bearerReq)).status).toBe(401);

      const bodyReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'forged-secret-body' }),
      });
      expect((await POST(bodyReq)).status).toBe(401);
    });

    it('returns 500 when REVALIDATE_SECRET is unset, empty, or whitespace on server', async () => {
      delete process.env.REVALIDATE_SECRET;
      const reqUnset = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'x-revalidate-secret': TEST_SERVER_SECRET },
      });
      const resUnset = await POST(reqUnset);
      expect(resUnset.status).toBe(500);
      expect(await resUnset.json()).toEqual({
        error: 'revalidate-secret-missing',
      });

      process.env.REVALIDATE_SECRET = '';
      const reqEmpty = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'x-revalidate-secret': TEST_SERVER_SECRET },
      });
      const resEmpty = await POST(reqEmpty);
      expect(resEmpty.status).toBe(500);
      expect(await resEmpty.json()).toEqual({
        error: 'revalidate-secret-missing',
      });

      process.env.REVALIDATE_SECRET = '    ';
      const reqWhitespace = new Request(
        'http://localhost:3000/api/revalidate',
        {
          method: 'POST',
          headers: { 'x-revalidate-secret': TEST_SERVER_SECRET },
        },
      );
      const resWhitespace = await POST(reqWhitespace);
      expect(resWhitespace.status).toBe(500);
      expect(await resWhitespace.json()).toEqual({
        error: 'revalidate-secret-missing',
      });
    });

    it('returns 200 on valid secret via x-revalidate-secret, Bearer auth, and JSON body', async () => {
      const headerReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'x-revalidate-secret': TEST_SERVER_SECRET },
      });
      const headerRes = await POST(headerReq);
      expect(headerRes.status).toBe(200);
      const headerData = await headerRes.json();
      expect(headerData.revalidated).toBe(true);

      const bearerReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { authorization: `Bearer ${TEST_SERVER_SECRET}` },
      });
      const bearerRes = await POST(bearerReq);
      expect(bearerRes.status).toBe(200);
      const bearerData = await bearerRes.json();
      expect(bearerData.revalidated).toBe(true);

      const bodyReq = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: TEST_SERVER_SECRET }),
      });
      const bodyRes = await POST(bodyReq);
      expect(bodyRes.status).toBe(200);
      const bodyData = await bodyRes.json();
      expect(bodyData.revalidated).toBe(true);
    });

    it('sanitizes injected paths and passes only valid leading-slash strings to revalidatePath', async () => {
      const req = new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': TEST_SERVER_SECRET,
        },
        body: JSON.stringify({
          paths: [
            '/../../etc/passwd',
            'https://attacker.com',
            '',
            null,
            42,
            '/valid-path',
            'item/550e8400-e29b-41d4-a716-446655440001',
            true,
            {},
            ['nested'],
          ],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.paths).toEqual([
        '/',
        '/room',
        '/../../etc/passwd',
        '/valid-path',
      ]);
      expect(revalidatePath).toHaveBeenCalledWith('/');
      expect(revalidatePath).toHaveBeenCalledWith('/room');
      expect(revalidatePath).toHaveBeenCalledWith('/../../etc/passwd');
      expect(revalidatePath).toHaveBeenCalledWith('/valid-path');
      expect(revalidatePath).not.toHaveBeenCalledWith('https://attacker.com');
      expect(revalidatePath).not.toHaveBeenCalledWith('');
      expect(revalidatePath).not.toHaveBeenCalledWith(
        'item/550e8400-e29b-41d4-a716-446655440001',
      );
    });

    it('safely parses malformed JSON bodies without throwing 500 error', async () => {
      const malformedBodies = [
        '{ invalid json syntax',
        '',
        JSON.stringify('plain string payload'),
        JSON.stringify(1337),
        JSON.stringify([1, 2, 3]),
        JSON.stringify(true),
        JSON.stringify(null),
      ];

      for (const malformedBody of malformedBodies) {
        const reqWithSecret = new Request(
          'http://localhost:3000/api/revalidate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-revalidate-secret': TEST_SERVER_SECRET,
            },
            body: malformedBody,
          },
        );
        const resValid = await POST(reqWithSecret);
        expect(resValid.status).toBe(200);

        const reqWithoutSecret = new Request(
          'http://localhost:3000/api/revalidate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: malformedBody,
          },
        );
        const resInvalid = await POST(reqWithoutSecret);
        expect(resInvalid.status).toBe(401);
      }
    });
  });

  describe('Seam 2: Public Data Layer resilience (lib/equipment.ts & lib/supabase.ts)', () => {
    it('returns null immediately for malformed IDs without invoking fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const adversarialIds = [
        "' OR '1'='1",
        "'; DROP TABLE equipment; --",
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '123',
        'abc-def',
        'not-a-valid-uuid',
        '550e8400-e29b-41d4-a716',
        '',
        '   ',
        undefined as unknown as string,
        null as unknown as string,
        {} as unknown as string,
        42 as unknown as string,
      ];

      for (const id of adversarialIds) {
        const item = await getEquipmentById(id);
        expect(item).toBeNull();
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('falls back to empty array on cold cache fetch rejection without crashing', async () => {
      _clearEquipmentCache();
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );

      const items = await getEquipment();
      expect(items).toEqual([]);
    });

    it('falls back to last-known-good cache on fetch rejection when warm', async () => {
      _setLastKnownGoodEquipment([sampleItem1, sampleItem2]);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );

      const items = await getEquipment();
      expect(items).toEqual([sampleItem1, sampleItem2]);
    });

    it('falls back to cached item or null on getEquipmentById fetch rejection', async () => {
      _clearEquipmentCache();
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );
      const coldItem = await getEquipmentById(sampleItem1.id);
      expect(coldItem).toBeNull();

      _setLastKnownGoodEquipment([sampleItem1]);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );
      const warmItem = await getEquipmentById(sampleItem1.id);
      expect(warmItem).toEqual(sampleItem1);
    });

    it('protects in-memory cache against external array mutation', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([sampleItem1, sampleItem2]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const receivedList = await getEquipment();
      expect(receivedList).toHaveLength(2);
      receivedList.pop();
      expect(receivedList).toHaveLength(1);

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );
      const cachedList = await getEquipment();
      expect(cachedList).toHaveLength(2);
      expect(cachedList[0].id).toBe(sampleItem1.id);
      expect(cachedList[1].id).toBe(sampleItem2.id);

      const externalSource = [sampleItem1];
      _setLastKnownGoodEquipment(externalSource);
      externalSource.push(sampleItem2);

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );
      const cachedListAfterSourceMutation = await getEquipment();
      expect(cachedListAfterSourceMutation).toHaveLength(1);
      expect(cachedListAfterSourceMutation[0].id).toBe(sampleItem1.id);
    });

    it('handles missing Supabase environment variables gracefully with fallbacks', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      _clearEquipmentCache();
      const coldList = await getEquipment();
      expect(coldList).toEqual([]);
      const coldItem = await getEquipmentById(sampleItem1.id);
      expect(coldItem).toBeNull();

      _setLastKnownGoodEquipment([sampleItem1]);
      const warmList = await getEquipment();
      expect(warmList).toEqual([sampleItem1]);
      const warmItem = await getEquipmentById(sampleItem1.id);
      expect(warmItem).toEqual(sampleItem1);
    });
  });

  describe('Seam 3: Public Routes & Product States', () => {
    it('S-001 Landing: renders EmptyState with verbatim copy when inventory is empty', async () => {
      _clearEquipmentCache();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const ui = await Page();
      render(ui);

      expect(screen.getByText('0 entries')).toBeTruthy();
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      expect(
        screen.getByText(
          'The register has no entries. Everything the lab team records will appear here.',
        ),
      ).toBeTruthy();

      const checkAgainLink = screen.getByRole('link', { name: 'Check again' });
      expect(checkAgainLink.getAttribute('href')).toBe('/');
      expect(checkAgainLink.className).toContain('btn--primary');
    });

    it('S-002 Room Grid: renders EmptyState with verbatim copy when inventory is empty', async () => {
      _clearEquipmentCache();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const ui = await RoomPage();
      render(ui);

      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      expect(
        screen.getByText(
          'The register has no entries. Everything the lab team records will appear here.',
        ),
      ).toBeTruthy();

      const checkAgainLink = screen.getByRole('link', { name: 'Check again' });
      expect(checkAgainLink.getAttribute('href')).toBe('/room');
      expect(checkAgainLink.className).toContain('btn--primary');
    });

    it('S-003 Item Detail: renders without throwing and displays "No photograph on file yet." when image_keys is empty', async () => {
      _setLastKnownGoodEquipment([sampleItem2]);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );

      const ui = await ItemPage({
        params: Promise.resolve({ id: sampleItem2.id }),
      });
      render(ui);

      expect(screen.getByText('No photograph on file yet.')).toBeTruthy();
      expect(screen.getByText('Monitors')).toBeTruthy();
    });

    it('S-003 Item Detail: falls back to "—" and "No other functionality recorded." when optional fields are null', async () => {
      _setLastKnownGoodEquipment([sampleItemNullFields]);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );

      const ui = await ItemPage({
        params: Promise.resolve({ id: sampleItemNullFields.id }),
      });
      render(ui);

      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.getByText('No other functionality recorded.')).toBeTruthy();
    });

    it('S-003 Item Detail: invokes notFound() when ID is nonexistent or malformed', async () => {
      _clearEquipmentCache();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(
        ItemPage({
          params: Promise.resolve({
            id: '00000000-0000-0000-0000-000000000000',
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mockNotFound).toHaveBeenCalledTimes(1);

      await expect(
        ItemPage({
          params: Promise.resolve({
            id: "' OR '1'='1",
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mockNotFound).toHaveBeenCalledTimes(2);
    });

    it('Root Layout: SkipLink targets #main landmark and #main is mounted across all routes', async () => {
      const layoutElement = RootLayout({
        children: <div data-testid="child-content">Child Content</div>,
      });
      expect(layoutElement.props.lang).toBe('en');

      const bodyElement = layoutElement.props.children;
      render(<div>{bodyElement.props.children}</div>);

      const skipLink = screen.getByRole('link', {
        name: 'Skip to main content',
      });
      expect(skipLink.getAttribute('href')).toBe('#main');

      _setLastKnownGoodEquipment([sampleItem1]);
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async () =>
          new Response(JSON.stringify([sampleItem1]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      );

      cleanup();
      const { container: pageContainer } = render(await Page());
      const pageMain = pageContainer.querySelector('main');
      expect(pageMain).not.toBeNull();
      expect(pageMain?.getAttribute('id')).toBe('main');

      cleanup();
      const { container: roomContainer } = render(await RoomPage());
      const roomMain = roomContainer.querySelector('main');
      expect(roomMain).not.toBeNull();
      expect(roomMain?.getAttribute('id')).toBe('main');

      cleanup();
      const { container: itemContainer } = render(
        await ItemPage({ params: Promise.resolve({ id: sampleItem1.id }) }),
      );
      const itemMain = itemContainer.querySelector('main');
      expect(itemMain).not.toBeNull();
      expect(itemMain?.getAttribute('id')).toBe('main');

      cleanup();
      const { container: privacyContainer } = render(<PrivacyPage />);
      const privacyMain = privacyContainer.querySelector('main');
      expect(privacyMain).not.toBeNull();
      expect(privacyMain?.getAttribute('id')).toBe('main');
    });
  });
});
