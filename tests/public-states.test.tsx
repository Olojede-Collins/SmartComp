// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Equipment } from '@/lib/equipment';
import Page from '../app/page';
import RoomPage from '../app/room/page';
import ItemPage from '../app/item/[id]/page';

const mockNotFound = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/equipment', () => ({
  getEquipment: vi.fn(),
  getEquipmentById: vi.fn(),
}));

import { getEquipment, getEquipmentById } from '@/lib/equipment';

describe('Public product states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('S-001 empty state: renders EmptyState with verbatim heading, body and Check again action', async () => {
    vi.mocked(getEquipment).mockResolvedValue([]);

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

  it('S-002 empty state: renders EmptyState with verbatim heading, body and Check again action', async () => {
    vi.mocked(getEquipment).mockResolvedValue([]);

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

  it('S-003 not-found: calls notFound() when getEquipmentById returns null', async () => {
    vi.mocked(getEquipmentById).mockResolvedValue(null);

    await expect(
      ItemPage({
        params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('S-003 photograph block: renders "No photograph on file yet." when image_keys is empty', async () => {
    const itemWithoutImages: Equipment = {
      id: '33333333-4444-5555-6666-777777777777',
      name: 'Router and switch',
      core_functionality: 'Network connectivity',
      other_functionality: 'Basic routing',
      condition: 'Working',
      quantity: 1,
      image_keys: [],
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: null,
    };

    vi.mocked(getEquipmentById).mockResolvedValue(itemWithoutImages);

    const ui = await ItemPage({
      params: Promise.resolve({ id: '33333333-4444-5555-6666-777777777777' }),
    });
    render(ui);

    expect(screen.getByText('No photograph on file yet.')).toBeTruthy();
  });

  it('S-003 graceful fallbacks: renders dashes and fallback notes when optional fields are null or empty', async () => {
    const itemWithNullFields: Equipment = {
      id: '44444444-5555-6666-7777-888888888888',
      name: 'HDMI splitter and converter',
      core_functionality: null,
      other_functionality: null,
      condition: 'Working',
      quantity: 1,
      image_keys: [],
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: null,
    };

    vi.mocked(getEquipmentById).mockResolvedValue(itemWithNullFields);

    const ui = await ItemPage({
      params: Promise.resolve({ id: '44444444-5555-6666-7777-888888888888' }),
    });
    render(ui);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('No other functionality recorded.')).toBeTruthy();
  });
});
