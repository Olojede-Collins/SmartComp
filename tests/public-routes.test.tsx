// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: '--font-mock',
    className: 'font-mock',
  }),
}));

import type { Equipment } from '@/lib/equipment';
import RootLayout from '../app/layout';
import Page, { revalidate as pageRevalidate } from '../app/page';
import RoomPage, { revalidate as roomRevalidate } from '../app/room/page';
import ItemPage, { revalidate as itemRevalidate } from '../app/item/[id]/page';
import PrivacyPage from '../app/privacy/page';

const mockEquipmentData: Equipment[] = [
  {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Smart Create view Screen',
    core_functionality: 'Central screen for the class',
    other_functionality: 'Whiteboard for lectures',
    condition: 'Working',
    quantity: 1,
    image_keys: ['screen1.jpg', 'screen2.jpg'],
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    updated_by: null,
  },
  {
    id: '22222222-3333-4444-5555-666666666666',
    name: 'Monitors',
    core_functionality: 'Student workstations',
    other_functionality: 'Does anything a PC does',
    condition: 'Faulty',
    quantity: 50,
    image_keys: ['monitor.jpg'],
    created_at: '2026-10-08T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    updated_by: null,
  },
];

vi.mock('@/lib/equipment', () => ({
  getEquipment: vi.fn(),
  getEquipmentById: vi.fn(),
}));

import { getEquipment, getEquipmentById } from '@/lib/equipment';

describe('RootLayout', () => {
  it('mounts SkipLink href="#main" and has lang="en"', () => {
    const layoutElement = RootLayout({
      children: <div data-testid="child-content">Child Content</div>,
    });
    expect(layoutElement.props.lang).toBe('en');

    const bodyElement = layoutElement.props.children;
    expect(bodyElement.props.className).toContain('bg-bg-page');
    expect(bodyElement.props.className).toContain('text-fg-default');
    expect(bodyElement.props.className).toContain('min-h-screen');
    expect(bodyElement.props.className).toContain('flex-col');

    render(<div>{bodyElement.props.children}</div>);

    const skipLink = screen.getByRole('link', {
      name: 'Skip to main content',
    });
    expect(skipLink.getAttribute('href')).toBe('#main');
    expect(screen.getByTestId('child-content')).toBeTruthy();
  });
});

describe('S-001 Landing route (app/page.tsx)', () => {
  beforeEach(() => {
    vi.mocked(getEquipment).mockResolvedValue(mockEquipmentData);
  });

  it('exports revalidate = 60', () => {
    expect(pageRevalidate).toBe(60);
  });

  it('renders hero, HeaderRail, Carousel with items, and Footer', async () => {
    const ui = await Page();
    const { container } = render(ui);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const homeLink = nav.querySelector('a[href="/"]');
    expect(homeLink?.getAttribute('aria-current')).toBe('page');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('The Smart Class, on the Record.');

    expect(
      screen.getByText(
        'A digital register and interactive laboratory archive for the smart classroom in the Computer Engineering Department, Faculty of Engineering, Ahmadu Bello University. Maintained directly by the lab team for accreditation, research, and technical operations.',
      ),
    ).toBeTruthy();

    const browseLink = screen.getByRole('link', {
      name: 'Browse the Collection',
    });
    expect(browseLink.getAttribute('href')).toBe('/room');

    const registerTitle = screen.getByRole('heading', { level: 2 });
    expect(registerTitle.textContent).toBe('The Register');
    expect(screen.getByText('2 entries')).toBeTruthy();

    const carousel = container.querySelector('.carousel');
    expect(carousel).toBeTruthy();
    expect(screen.getByText('Smart Create view Screen')).toBeTruthy();
    expect(screen.getByText('Monitors')).toBeTruthy();

    expect(
      screen.getByText('Recorded by the ABU Smart Class lab team.'),
    ).toBeTruthy();
  });
});

describe('S-002 Room collection route (app/room/page.tsx)', () => {
  beforeEach(() => {
    vi.mocked(getEquipment).mockResolvedValue(mockEquipmentData);
  });

  it('exports revalidate = 60', () => {
    expect(roomRevalidate).toBe(60);
  });

  it('renders HeaderRail, collection heading, sorted RegisterRow items, and Footer', async () => {
    const ui = await RoomPage();
    const { container } = render(ui);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const roomLink = nav.querySelector('a[href="/room"]');
    expect(roomLink?.getAttribute('aria-current')).toBe('page');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('The Collection');
    expect(
      screen.getByText('Every item in the smart class, in name order.'),
    ).toBeTruthy();

    const rows = container.querySelectorAll('ul.rows > li');
    expect(rows).toHaveLength(2);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0].textContent).toBe('Monitors');
    expect(headings[1].textContent).toBe('Smart Create view Screen');

    expect(
      screen.getByText('Recorded by the ABU Smart Class lab team.'),
    ).toBeTruthy();
  });
});

describe('S-003 Item detail route (app/item/[id]/page.tsx)', () => {
  beforeEach(() => {
    vi.mocked(getEquipmentById).mockResolvedValue(mockEquipmentData[0]);
  });

  it('exports revalidate = 60', () => {
    expect(itemRevalidate).toBe(60);
  });

  it('renders item details, breadcrumb, ImageGallery, ConditionChip, and label card', async () => {
    const ui = await ItemPage({
      params: Promise.resolve({ id: '11111111-2222-3333-4444-555555555555' }),
    });
    render(ui);

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const backLink = breadcrumb.querySelector('a[href="/room"]');
    expect(backLink?.textContent).toBe('The Collection');
    expect(breadcrumb.textContent).toContain('Detail');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Smart Create view Screen');

    expect(screen.getByText('QUANTITY')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();

    expect(screen.getByText('PRIMARY FUNCTIONALITY')).toBeTruthy();
    expect(screen.getByText('Central screen for the class')).toBeTruthy();
    expect(
      screen.getByText('ADDITIONAL SPECIFICATIONS & CAPABILITIES'),
    ).toBeTruthy();
    expect(screen.getByText('Whiteboard for lectures')).toBeTruthy();

    expect(screen.getByText('2 photograph(s) on file.')).toBeTruthy();

    expect(
      screen.getByText('Recorded by the ABU Smart Class lab team.'),
    ).toBeTruthy();
  });
});

describe('NDPA Privacy route (app/privacy/page.tsx)', () => {
  it('renders Privacy heading, Draft stamp, 6 sections, and Footer', () => {
    const { container } = render(<PrivacyPage />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Privacy');
    expect(
      screen.getByText(
        'Plain words about what this site keeps, and what it does not.',
      ),
    ).toBeTruthy();

    expect(
      screen.getByText(
        'DRAFT — TO BE CHECKED BY THE LEGAL OFFICE BEFORE LAUNCH',
      ),
    ).toBeTruthy();

    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(6);

    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const headingTexts = sectionHeadings.map((h) => h.textContent);
    expect(headingTexts).toContain('What the site holds');
    expect(headingTexts).toContain('The photographs');
    expect(headingTexts).toContain('What we do not do');
    expect(headingTexts).toContain('How long we keep it');
    expect(headingTexts).toContain('Who to ask');
    expect(headingTexts).toContain('Your rights');

    expect(screen.getByText('smartclass@example.invalid')).toBeTruthy();
    expect(
      screen.getByText(
        'Written by the design team in plain words. Last drafted 13 October 2026.',
      ),
    ).toBeTruthy();

    expect(
      screen.getByText('Recorded by the ABU Smart Class lab team.'),
    ).toBeTruthy();
  });
});
