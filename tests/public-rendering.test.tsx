// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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

import { LEGACY_EQUIPMENT_RECORDS } from '../backend/src/legacy-import.js';

vi.mock('@/lib/equipment', () => ({
  getEquipment: vi.fn(),
  getEquipmentById: vi.fn(),
}));

import { getEquipment, getEquipmentById } from '@/lib/equipment';
import Page from '../app/page';
import RoomPage from '../app/room/page';
import ItemPage from '../app/item/[id]/page';

describe('Public Rendering Integration Test Suite with Legacy Data (S-06 M2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEquipment).mockResolvedValue(LEGACY_EQUIPMENT_RECORDS);
    vi.mocked(getEquipmentById).mockImplementation(async (id: string) => {
      const match = LEGACY_EQUIPMENT_RECORDS.find((i) => i.id === id);
      return match ? { ...match } : null;
    });
  });

  describe('1. Landing Route (/) with Imported Equipment', () => {
    it('renders carousel with all 7 imported equipment items and active photography', async () => {
      const ui = await Page();
      render(ui);

      expect(screen.queryByText('Nothing on the record yet.')).toBeNull();
      expect(screen.getByText('7 entries')).toBeDefined();

      const carousel = screen.getByRole('region', { name: 'Featured items' });
      expect(carousel).toBeDefined();

      for (const item of LEGACY_EQUIPMENT_RECORDS) {
        expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
      }

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(7);

      const monitorsImg = images.find((img) =>
        img.getAttribute('src')?.includes('monitors-1.webp'),
      );
      expect(monitorsImg).toBeDefined();
      expect(monitorsImg?.getAttribute('alt')).toBe('Monitors');

      const studentCameraImg = images.find((img) =>
        img.getAttribute('src')?.includes('student-camera-1.webp'),
      );
      expect(studentCameraImg).toBeDefined();
      expect(studentCameraImg?.getAttribute('alt')).toBe('Student Camera');
    });
  });

  describe('2. Collection Register Route (/room) with Imported Equipment', () => {
    it('renders all 7 imported items in name-sorted order with exact quantities', async () => {
      const ui = await RoomPage();
      const { container } = render(ui);

      expect(screen.queryByText('Nothing on the record yet.')).toBeNull();
      expect(
        screen.getByRole('heading', { level: 1, name: 'The collection' }),
      ).toBeDefined();

      const rows = container.querySelectorAll('ul.rows > li');
      expect(rows.length).toBe(7);

      const expectedNamesSorted = [
        'HDMI splitter and converter',
        'Monitors',
        'Recording Host',
        'Router and switch',
        'Smart Create view Screen',
        'Student Camera',
        'Students screen and camera',
      ];

      rows.forEach((row, idx) => {
        expect(row.textContent).toContain(expectedNamesSorted[idx]);
      });

      const monitorsRow = Array.from(rows).find((r) =>
        r.textContent?.includes('Monitors'),
      );
      expect(monitorsRow).toBeDefined();
      if (monitorsRow) {
        expect(
          within(monitorsRow as HTMLElement).getByText('50'),
        ).toBeDefined();
        const img = within(monitorsRow as HTMLElement).getByRole('img');
        expect(img.getAttribute('src')).toMatch(/monitors-1\.webp/);
      }

      const singleUnitItems = [
        'HDMI splitter and converter',
        'Recording Host',
        'Router and switch',
        'Smart Create view Screen',
        'Student Camera',
        'Students screen and camera',
      ];

      for (const name of singleUnitItems) {
        const row = Array.from(rows).find((r) => r.textContent?.includes(name));
        expect(row).toBeDefined();
        if (row) {
          expect(within(row as HTMLElement).getByText('1')).toBeDefined();
          const img = within(row as HTMLElement).getByRole('img');
          expect(img.getAttribute('src')).toBeTruthy();
        }
      }
    });
  });

  describe('3. Item Detail Route (/item/[id]) with Imported Equipment', () => {
    it('renders Student Camera with 2 gallery photos and zero placeholder fallbacks', async () => {
      const studentCameraId = 'e0000001-0000-4000-a000-000000000004';
      const ui = await ItemPage({
        params: Promise.resolve({ id: studentCameraId }),
      });
      const { container } = render(ui);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Student Camera' }),
      ).toBeDefined();
      expect(screen.getAllByText('e0000001').length).toBe(2);
      expect(screen.getByText('Working')).toBeDefined();
      expect(screen.getByText('1')).toBeDefined();

      expect(
        screen.getByText(/High-definition wide-angle pan-tilt-zoom/),
      ).toBeDefined();
      expect(
        screen.getByText(/laboratory instructors in monitoring/),
      ).toBeDefined();

      expect(screen.queryByText('Photograph unavailable')).toBeNull();
      expect(
        screen.queryByText('No photo available for this equipment'),
      ).toBeNull();

      const images = Array.from(container.querySelectorAll('img'));
      const sources = images.map((img) => img.getAttribute('src'));
      expect(sources.some((s) => s?.includes('student-camera-1.webp'))).toBe(
        true,
      );
      expect(sources.some((s) => s?.includes('student-camera-2.webp'))).toBe(
        true,
      );
    });

    it('renders Monitors with quantity 50 and active photography', async () => {
      const monitorsId = 'e0000001-0000-4000-a000-000000000003';
      const ui = await ItemPage({
        params: Promise.resolve({ id: monitorsId }),
      });
      render(ui);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Monitors' }),
      ).toBeDefined();
      expect(screen.getByText('50')).toBeDefined();
      expect(screen.getByText('Working')).toBeDefined();

      const heroImg = screen
        .getAllByRole('img')
        .find((img) => img.getAttribute('src')?.includes('monitors-1.webp'));
      expect(heroImg).toBeDefined();
    });

    it('triggers notFound() when item ID does not exist', async () => {
      await expect(
        ItemPage({
          params: Promise.resolve({
            id: '00000000-0000-0000-0000-000000000000',
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });
  });
});
