// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HeaderRail } from '../app/_components/header-rail';
import { Footer } from '../app/_components/footer';
import { Banner } from '../app/_components/banner';
import { ColdStartPanel } from '../app/_components/cold-start-panel';
import { Stamp } from '../app/_components/stamp';
import { RegisterRow, RegisterRows } from '../app/_components/register-row';
import { DataStrip } from '../app/_components/data-strip';
import { ImagePlaceholder } from '../app/_components/image-placeholder';
import { EmptyState } from '../app/_components/empty-state';
import { LoadingSkeleton } from '../app/_components/loading-skeleton';
import { DataTable } from '../app/_components/data-table';
import { Button } from '../app/_components/button';
import { cn } from '../lib/utils';

function classes(el: Element | null | undefined): string[] {
  if (!el) return [];
  const raw = el.getAttribute('class') || '';
  return raw.trim().split(/\s+/).filter(Boolean);
}

describe('M2-CHALLENGE Seam 1: Missing §4 declared states across all 12 composites', () => {
  it('C-001 & C-002: Public vs admin header rail states and link chrome', () => {
    const { container: pubContainer } = render(<HeaderRail variant="public" />);
    const pubNav = pubContainer.querySelector('nav');
    expect(pubNav).not.toBeNull();
    const pubLinks = Array.from(pubNav!.querySelectorAll('a'));
    expect(pubLinks.map((a) => a.textContent?.trim())).toEqual([
      'Home',
      'The collection',
    ]);
    expect(pubContainer.querySelector('button')).toBeNull();
    expect(pubContainer.querySelector('.banner-slot')).toBeNull();

    const { container: adminContainer } = render(
      <HeaderRail variant="admin">
        <div data-testid="banner-content">Banner inside slot</div>
      </HeaderRail>,
    );
    const adminNav = adminContainer.querySelector('nav');
    expect(adminNav).not.toBeNull();
    const adminLinks = Array.from(adminNav!.querySelectorAll('a'));
    expect(adminLinks.map((a) => a.textContent?.trim())).toEqual([
      'Items',
      'Admins',
    ]);
    const signOutBtn = adminContainer.querySelector('button');
    expect(signOutBtn).not.toBeNull();
    expect(signOutBtn?.textContent?.trim()).toBe('Sign out');

    const slot = adminContainer.querySelector('.banner-slot');
    expect(slot).not.toBeNull();
    expect(slot?.textContent).toContain('Banner inside slot');
  });

  it('C-001/C-002: active page state delegates aria-current="page"', () => {
    const { container } = render(<HeaderRail variant="public" current="/" />);
    const activeLink = container.querySelector('a[aria-current="page"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.getAttribute('href')).toBe('/');
    expect(classes(activeLink)).toContain(
      'aria-[current=page]:border-bg-rail-active',
    );
  });

  it('C-004: Footer public vs admin states and verbatim copy strings', () => {
    const { container: pubFooter } = render(<Footer variant="public" />);
    const pubLinks = Array.from(pubFooter.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(pubLinks).toContain('/room');
    expect(pubLinks).toContain('/privacy');

    const { container: adminFooter } = render(<Footer variant="admin" />);
    const adminLinks = Array.from(adminFooter.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(adminLinks).toContain('/room');
    expect(adminLinks).toContain('/admin');
    expect(adminLinks).not.toContain('/privacy');

    const provenance = pubFooter.querySelector('p');
    expect(provenance?.textContent?.trim()).toBe(
      'Recorded by the ABU Smart Class lab team. Wording is kept as submitted.',
    );
    expect(classes(provenance)).toContain('text-caption');
    expect(classes(provenance)).toContain('text-fg-muted');

    const stamp = pubFooter.querySelector('.bg-bg-stamp');
    expect(stamp).not.toBeNull();
    expect(stamp?.textContent).toContain(
      'ENGINEERING FACULTY HOOD COLOUR — ACADEMIC BRIEF TABLE 2.1',
    );
  });

  it('C-017: Banner tone grounds, icons, and entering states', () => {
    const { container: cautionBox } = render(
      <Banner tone="caution" heading="Caution heading">
        Caution body
      </Banner>,
    );
    const cEl = cautionBox.firstElementChild as HTMLElement;
    expect(classes(cEl)).toContain('bg-bg-banner-warn');
    expect(classes(cEl)).toContain('border-border-warn');
    expect(cEl.querySelector('svg')).not.toBeNull();

    const { container: errBox } = render(
      <Banner
        tone="error"
        heading="Error heading"
        faulty="Faulty detail"
        code="409"
      >
        Error body
      </Banner>,
    );
    const eEl = errBox.firstElementChild as HTMLElement;
    expect(classes(eEl)).toContain('bg-bg-surface');
    expect(classes(eEl)).toContain('border-border-error');
    expect(eEl.querySelector('.faulty')?.textContent).toBe('Faulty detail');
    expect(classes(eEl.querySelector('.faulty'))).toContain(
      'text-fg-status-faulty',
    );
    expect(eEl.querySelector('.banner__code')?.textContent).toBe('409');
    expect(classes(eEl.querySelector('.banner__code'))).toContain('text-data');

    const { container: succBox } = render(
      <Banner tone="success" heading="Success heading" entering>
        Success body
      </Banner>,
    );
    const sEl = succBox.firstElementChild as HTMLElement;
    expect(classes(sEl)).toContain('bg-bg-surface');
    expect(classes(sEl)).toContain('border-border-status-working');
    expect(classes(sEl)).toContain('transition-transform');
    expect(classes(sEl)).toContain('duration-slow');
    expect(classes(sEl)).toContain('ease-standard');
    expect(classes(sEl)).toContain('motion-reduce:transition-none');
  });

  it('C-020: ColdStartPanel waiting vs error vs ready states', () => {
    const { container: waitCont } = render(<ColdStartPanel state="waiting" />);
    expect(waitCont.firstElementChild).not.toBeNull();
    expect(waitCont.textContent).toContain('Building the register.');
    expect(waitCont.textContent).toContain('ELAPSED');

    const { container: readyCont } = render(<ColdStartPanel state="ready" />);
    expect(readyCont.firstElementChild).toBeNull();

    const { container: errCont } = render(<ColdStartPanel state="error" />);
    expect(errCont.firstElementChild).not.toBeNull();
    expect(classes(errCont.firstElementChild)).toContain('border-border-error');
    expect(errCont.textContent).toContain(
      'The register took too long to start.',
    );
    expect(errCont.textContent).toContain('cold-start-timeout');
  });

  it('C-023: Stamp inline and banner variants', () => {
    const { container: inlineCont } = render(
      <Stamp variant="inline">ENGINEERING FACULTY HOOD COLOUR</Stamp>,
    );
    const inlineEl = inlineCont.firstElementChild as HTMLElement;
    expect(classes(inlineEl)).toContain('w-fit');
    expect(classes(inlineEl)).toContain('bg-bg-stamp');
    expect(classes(inlineEl)).toContain('border-border-warn');
    expect(classes(inlineEl)).toContain('text-micro');
    expect(classes(inlineEl)).toContain('tracking-micro');

    const { container: bannerCont } = render(
      <Stamp variant="banner">DRAFT — TO BE CHECKED</Stamp>,
    );
    const bannerEl = bannerCont.firstElementChild as HTMLElement;
    expect(classes(bannerEl)).toContain('w-full');
    expect(classes(bannerEl)).toContain('flex');
    expect(bannerEl.getAttribute('role')).toBeNull();
  });

  it('C-012: RegisterRow default, loading, image-missing, and image-failed states', () => {
    const { container: defCont } = render(
      <RegisterRows>
        <RegisterRow
          href="/item/1"
          name="Digital Multimeter"
          condition="Working"
          image={{ src: '/img.jpg', alt: 'Multimeter' }}
          facts={[{ key: 'RECORD', value: 'SC-001', strong: true }]}
        />
      </RegisterRows>,
    );
    const anchor = defCont.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/item/1');
    expect(classes(anchor)).toContain('bg-bg-surface');
    expect(classes(anchor)).toContain('border-border-rule');
    expect(classes(anchor)).not.toContain('shadow-card');
    expect(defCont.querySelector('.chip')).not.toBeNull();
    expect(defCont.querySelector('.row__facts')).not.toBeNull();

    const { container: loadCont } = render(
      <RegisterRows>
        <RegisterRow href="/item/1" name="Digital Multimeter" loading />
      </RegisterRows>,
    );
    expect(loadCont.querySelector('a')).toBeNull();
    expect(loadCont.querySelector('[aria-busy="true"]')).not.toBeNull();

    const { container: missingCont } = render(
      <RegisterRows>
        <RegisterRow href="/item/1" name="Digital Multimeter" />
      </RegisterRows>,
    );
    expect(missingCont.textContent).toContain('PHOTO');

    const { container: failedCont } = render(
      <RegisterRows>
        <RegisterRow
          href="/item/1"
          name="Digital Multimeter"
          image={{ failed: true }}
        />
      </RegisterRows>,
    );
    expect(failedCont.querySelector('button')).toBeNull();
    expect(failedCont.querySelector('.bg-bg-surface-sunken')).not.toBeNull();
  });

  it('C-013: DataStrip default, embedded, loading, and error states', () => {
    const { container: defCont } = render(
      <DataStrip
        pairs={[
          { key: 'RECORD', value: 'SC-001', strong: true },
          { key: 'CONDITION', chip: 'Working' },
        ]}
      />,
    );
    expect(defCont.querySelector('dl')).not.toBeNull();
    expect(defCont.querySelector('dt')).not.toBeNull();
    expect(defCont.querySelector('dd')).not.toBeNull();
    expect(classes(defCont.firstElementChild)).toContain('border-y');
    expect(classes(defCont.firstElementChild)).toContain('border-border-rule');

    const { container: embCont } = render(
      <DataStrip
        variant="embedded"
        pairs={[{ key: 'RECORD', value: 'SC-001' }]}
      />,
    );
    expect(embCont.querySelector('dl')).toBeNull();
    expect(classes(embCont.firstElementChild)).not.toContain('border-y');

    const { container: loadCont } = render(
      <DataStrip loading pairs={[{ key: 'RECORD', value: 'SC-001' }]} />,
    );
    expect(loadCont.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(loadCont.querySelectorAll('.bg-bg-skeleton').length).toBeGreaterThan(
      0,
    );

    const { container: errCont } = render(
      <DataStrip pairs={[{ key: 'STATUS', error: 'Failed to read sensor' }]} />,
    );
    const errSpan = errCont.querySelector('.text-fg-status-faulty');
    expect(errSpan).not.toBeNull();
    expect(errSpan?.textContent).toBe('Failed to read sensor');
    expect(classes(errSpan)).toContain('text-caption');
  });

  it('C-014: ImagePlaceholder empty, loading, failed, retry, and size geometry', () => {
    const { container: emptyThumb } = render(
      <ImagePlaceholder state="empty" size="thumb" />,
    );
    expect(classes(emptyThumb.firstElementChild)).toContain('w-[96px]');
    expect(classes(emptyThumb.firstElementChild)).toContain('h-[72px]');
    expect(classes(emptyThumb.firstElementChild)).toContain(
      'bg-bg-placeholder',
    );
    expect(emptyThumb.textContent).toContain('PHOTO');

    const { container: emptyFull } = render(
      <ImagePlaceholder state="empty" size="full" />,
    );
    expect(classes(emptyFull.firstElementChild)).toContain('aspect-[4/3]');
    expect(classes(emptyFull.firstElementChild)).toContain('w-full');

    const { container: loadCont } = render(
      <ImagePlaceholder state="loading" />,
    );
    expect(loadCont.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(classes(loadCont.firstElementChild)).toContain('bg-bg-skeleton');

    const onRetry = vi.fn();
    const { container: failedCont } = render(
      <ImagePlaceholder state="failed" showRetry onRetry={onRetry} />,
    );
    expect(classes(failedCont.firstElementChild)).toContain(
      'bg-bg-surface-sunken',
    );
    expect(failedCont.textContent).toContain('The image failed to load.');
    const retryBtn = failedCont.querySelector('button');
    expect(retryBtn).not.toBeNull();
    fireEvent.click(retryBtn!);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const { container: failedNoRetry } = render(
      <ImagePlaceholder state="failed" showRetry={false} />,
    );
    expect(failedNoRetry.querySelector('button')).toBeNull();
  });

  it('C-018: EmptyState heading, body, icon, and action CTA', () => {
    const { container } = render(
      <EmptyState
        heading="No items yet."
        body="Add the first item to start the register."
        action={<Button>Add item</Button>}
      />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('No items yet.');
    expect(classes(container.querySelector('h2'))).toContain('text-h2');
    expect(container.querySelector('p')?.textContent).toBe(
      'Add the first item to start the register.',
    );
    expect(classes(container.querySelector('p'))).toContain('text-body');
    expect(classes(container.querySelector('p'))).toContain('text-fg-muted');
    expect(container.querySelector('button')?.textContent).toBe('Add item');
  });

  it('C-019: LoadingSkeleton card, table-row, data-strip, image and no pulse animation', () => {
    const { container: cardCont } = render(
      <LoadingSkeleton variant="card" count={2} />,
    );
    expect(
      cardCont.querySelectorAll('.bg-bg-skeleton').length,
    ).toBeGreaterThanOrEqual(2);
    expect(cardCont.innerHTML).not.toMatch(/animate-pulse|shimmer/);

    const { container: tblCont } = render(
      <table>
        <tbody>
          <LoadingSkeleton variant="table-row" count={3} />
        </tbody>
      </table>,
    );
    expect(tblCont.querySelectorAll('tr').length).toBe(3);
    expect(
      tblCont.querySelectorAll('.bg-bg-skeleton').length,
    ).toBeGreaterThanOrEqual(3);

    const { container: stripCont } = render(
      <LoadingSkeleton variant="data-strip" count={2} />,
    );
    expect(stripCont.querySelectorAll('.bg-bg-skeleton').length).toBe(4);

    const { container: imgThumb } = render(
      <LoadingSkeleton variant="image" size="thumb" />,
    );
    expect(classes(imgThumb.firstElementChild)).toContain('w-[96px]');
    expect(classes(imgThumb.firstElementChild)).toContain('h-[72px]');
  });

  it('C-022: DataTable default, loading, empty, pending row, and 15-row cap', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `id-${i}`,
      name: `Item ${i}`,
      record: `SC-${100 + i}`,
      quantity: 5,
      condition: 'Working',
      updated: '2026-10-16',
    }));

    const { container: defCont } = render(<DataTable rows={items} />);
    const rows = defCont.querySelectorAll('tbody tr');
    expect(rows.length).toBe(15);

    const { container: loadCont } = render(
      <DataTable rows={items} state="loading" />,
    );
    expect(loadCont.querySelector('tbody')?.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(loadCont.querySelectorAll('.bg-bg-skeleton').length).toBeGreaterThan(
      0,
    );

    const { container: emptyCont } = render(<DataTable rows={[]} />);
    expect(emptyCont.textContent).toContain('No items yet.');
    expect(emptyCont.querySelector('table')).toBeNull();

    const { container: pendingCont } = render(
      <DataTable rows={items.slice(0, 2)} pendingRowId="id-0" />,
    );
    const row0Buttons = pendingCont.querySelectorAll(
      'tbody tr:first-child button',
    );
    const row1Buttons = pendingCont.querySelectorAll(
      'tbody tr:nth-child(2) button',
    );
    expect((row0Buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((row0Buttons[1] as HTMLButtonElement).disabled).toBe(true);
    expect((row1Buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((row1Buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('M2-CHALLENGE Seam 2: twMerge font-size vs colour resolution', () => {
  it('probe Button with size="sm" across default, ghost, and danger variants', () => {
    const { container: defCont } = render(
      <Button variant="default" size="sm">
        Primary
      </Button>,
    );
    const defBtn = defCont.querySelector('button')!;
    const defCls = classes(defBtn);
    expect(defCls).toContain('text-fg-on-action');
    expect(defCls).toContain('text-body-small');
    expect(defCls).toContain('min-h-11');
    expect(defCls).toContain('px-3');
    expect(defCls).toContain('py-2');

    const { container: ghostCont } = render(
      <Button variant="ghost" size="sm">
        Ghost
      </Button>,
    );
    const ghostBtn = ghostCont.querySelector('button')!;
    const ghostCls = classes(ghostBtn);
    expect(ghostCls).toContain('text-fg-default');
    expect(ghostCls).toContain('text-body-small');
    expect(ghostCls).toContain('min-h-11');
    expect(ghostCls).toContain('px-3');
    expect(ghostCls).toContain('py-2');

    const { container: dangerCont } = render(
      <Button variant="danger" size="sm">
        Danger
      </Button>,
    );
    const dangerBtn = dangerCont.querySelector('button')!;
    const dangerCls = classes(dangerBtn);
    expect(dangerCls).toContain('text-fg-on-danger');
    expect(dangerCls).toContain('text-body-small');
    expect(dangerCls).toContain('min-h-11');
    expect(dangerCls).toContain('px-3');
    expect(dangerCls).toContain('py-2');
  });

  it('cn() preserves both token font-size and token text-color regardless of argument order', () => {
    const fontSizes = [
      'text-display',
      'text-h1',
      'text-h2',
      'text-h3',
      'text-h4',
      'text-item-name',
      'text-body-lg',
      'text-body',
      'text-body-small',
      'text-caption',
      'text-label',
      'text-micro',
      'text-data',
      'text-data-strong',
    ];

    const textColors = [
      'text-fg-default',
      'text-fg-muted',
      'text-fg-on-action',
      'text-fg-on-danger',
      'text-fg-on-rail',
      'text-fg-stamp',
      'text-fg-status-working',
      'text-fg-status-faulty',
    ];

    for (const size of fontSizes) {
      for (const color of textColors) {
        const order1 = cn(size, color);
        expect(order1, `order1: size=${size} color=${color}`).toContain(size);
        expect(order1, `order1: size=${size} color=${color}`).toContain(color);

        const order2 = cn(color, size);
        expect(order2, `order2: color=${color} size=${size}`).toContain(size);
        expect(order2, `order2: color=${color} size=${size}`).toContain(color);
      }
    }
  });

  it('cn() correctly deduplicates conflicting font-sizes to the latter', () => {
    const merged = cn('text-body-small', 'text-h1');
    expect(merged).toContain('text-h1');
    expect(merged.split(/\s+/).includes('text-body-small')).toBe(false);
  });

  it('cn() correctly deduplicates conflicting text-colors to the latter', () => {
    const merged = cn('text-fg-default', 'text-fg-on-danger');
    expect(merged).toContain('text-fg-on-danger');
    expect(merged.split(/\s+/).includes('text-fg-default')).toBe(false);
  });
});

describe('M2-CHALLENGE Seam 3: Banner C-017 live regions and non-dismissibility', () => {
  it('caution tone renders role="alert"', () => {
    const { container } = render(
      <Banner tone="caution" heading="Caution title">
        Body text
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('role')).toBe('alert');
  });

  it('error tone renders role="alert"', () => {
    const { container } = render(
      <Banner tone="error" heading="Error title">
        Body text
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('role')).toBe('alert');
  });

  it('success tone renders role="status" and aria-live="polite"', () => {
    const { container } = render(
      <Banner tone="success" heading="Success title">
        Body text
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
  });

  it('dismissible prop is strictly ignored on caution and error tones', () => {
    const onDismiss = vi.fn();
    const { container: cCont } = render(
      <Banner
        tone="caution"
        heading="Caution"
        dismissible
        onDismiss={onDismiss}
      >
        Content
      </Banner>,
    );
    expect(cCont.querySelector('button')).toBeNull();

    const { container: eCont } = render(
      <Banner tone="error" heading="Error" dismissible onDismiss={onDismiss}>
        Content
      </Banner>,
    );
    expect(eCont.querySelector('button')).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismissible prop renders button only on success tone', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Banner
        tone="success"
        heading="Success"
        dismissible
        onDismiss={onDismiss}
      >
        Content
      </Banner>,
    );
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('Dismiss');
    fireEvent.click(btn!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('M2-CHALLENGE Seam 4: Header rail C-001/C-002 banner slot padding & focus rings', () => {
  it('banner slot beneath admin rail has pt-4 padding and not pt-5', () => {
    const { container } = render(
      <HeaderRail variant="admin">
        <div>Child</div>
      </HeaderRail>,
    );
    const slot = container.querySelector('.banner-slot') as HTMLElement;
    expect(slot).not.toBeNull();
    const cls = classes(slot);
    expect(cls).toContain('pt-4');
    expect(cls).not.toContain('pt-5');
  });

  it('mark link, nav links, and Sign out button on dark rail use outline-border-focus-on-rail', () => {
    const { container } = render(
      <HeaderRail variant="admin" current="/admin">
        <div>Content</div>
      </HeaderRail>,
    );
    const interactives = Array.from(
      container.querySelectorAll('header a, header button'),
    );
    expect(interactives.length).toBeGreaterThanOrEqual(4);

    for (const el of interactives) {
      const cls = classes(el);
      expect(cls, `element=${el.tagName} text=${el.textContent}`).toContain(
        'focus-visible:outline-border-focus-on-rail',
      );
      expect(
        cls.some((c) => /^focus-visible:outline-border-focus$/.test(c)),
        `bare border-focus on dark rail: ${cls.join(' ')}`,
      ).toBe(false);
    }
  });
});

describe('M2-CHALLENGE Seam 5: DataTable C-022 caption prop & compact row actions', () => {
  const testRows = [
    {
      id: 'item-1',
      name: 'Oscilloscope',
      record: 'SC-001',
      quantity: 2,
      condition: 'Working',
      updated: '2026-10-16',
    },
  ];

  it('caption is omitted from DOM by default', () => {
    const { container } = render(<DataTable rows={testRows} />);
    expect(container.querySelector('caption')).toBeNull();
  });

  it('caption renders with sr-only when caption prop is provided', () => {
    const { container } = render(
      <DataTable rows={testRows} caption="Smart class instruments table" />,
    );
    const captionEl = container.querySelector('caption');
    expect(captionEl).not.toBeNull();
    expect(captionEl?.textContent).toBe('Smart class instruments table');
    expect(classes(captionEl)).toContain('sr-only');
  });

  it('row actions render compact ghost Edit and compact danger Delete without losing colors or size', () => {
    const { container } = render(<DataTable rows={testRows} />);
    const buttons = Array.from(container.querySelectorAll('tbody tr button'));
    expect(buttons.length).toBe(2);

    const [editBtn, deleteBtn] = buttons;
    expect(editBtn.textContent?.trim()).toBe('Edit');
    const editCls = classes(editBtn);
    expect(editCls).toContain('text-fg-default');
    expect(editCls).toContain('text-body-small');
    expect(editCls).toContain('min-h-11');

    expect(deleteBtn.textContent?.trim()).toBe('Delete');
    const deleteCls = classes(deleteBtn);
    expect(deleteCls).toContain('text-fg-on-danger');
    expect(deleteCls).toContain('text-body-small');
    expect(deleteCls).toContain('min-h-11');
  });
});

describe('M2-CHALLENGE Seam 6: ColdStartPanel C-020 waiting safety & ticker accessibility', () => {
  it('waiting state is never red and wears brown caution tone only', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const banner = container.querySelector('.banner') as HTMLElement;
    expect(banner).not.toBeNull();
    const cls = classes(banner);
    expect(cls).toContain('bg-bg-banner-warn');
    expect(cls).toContain('border-border-warn');
    expect(cls).not.toContain('bg-bg-danger');
    expect(cls).not.toContain('border-border-error');
    expect(cls).not.toContain('banner--error');
    expect(cls).not.toContain('text-fg-status-faulty');
  });

  it('ticker has aria-hidden="true" to prevent screen reader announcement flood', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const tickerBlock = container.querySelector('.banner__elapsed');
    expect(tickerBlock).not.toBeNull();
    expect(tickerBlock?.getAttribute('aria-hidden')).toBe('true');
  });

  it('heading and explanation live in a polite live region', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const liveRegion = container.querySelector('.banner__live');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('role')).toBe('status');
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion?.querySelector('h3')?.textContent).toBe(
      'Building the register.',
    );
  });
});

describe('M2-CHALLENGE Seam 7: Dead utility checks (double-prefix token validation)', () => {
  const FORBIDDEN_SINGLE_PREFIX = [
    /(^|\s)bg-rail(\s|$)/,
    /(^|\s)bg-page(\s|$)/,
    /(^|\s)bg-surface(\s|$)/,
    /(^|\s)bg-surface-sunken(\s|$)/,
    /(^|\s)bg-placeholder(\s|$)/,
    /(^|\s)bg-skeleton(\s|$)/,
    /(^|\s)bg-stamp(\s|$)/,
    /(^|\s)bg-banner-warn(\s|$)/,
    /(^|\s)bg-row-hover(\s|$)/,
    /(^|\s)bg-action-subtle(\s|$)/,
    /(^|\s)border-rule(\s|$)/,
    /(^|\s)border-strong(\s|$)/,
    /(^|\s)border-warn(\s|$)/,
    /(^|\s)border-error(\s|$)/,
    /(^|\s)border-status-working(\s|$)/,
  ];

  it('no composite component renders dead single-prefix utilities in DOM', () => {
    const samples = [
      render(<HeaderRail variant="public" />),
      render(<HeaderRail variant="admin" />),
      render(<Footer variant="public" />),
      render(<Footer variant="admin" />),
      render(
        <Banner tone="caution" heading="H">
          C
        </Banner>,
      ),
      render(
        <Banner tone="error" heading="H">
          E
        </Banner>,
      ),
      render(
        <Banner tone="success" heading="H">
          S
        </Banner>,
      ),
      render(<ColdStartPanel state="waiting" />),
      render(<ColdStartPanel state="error" />),
      render(<Stamp variant="inline">Stamp</Stamp>),
      render(<Stamp variant="banner">Stamp</Stamp>),
      render(
        <RegisterRows>
          <RegisterRow
            href="/item/1"
            name="Item"
            condition="Working"
            image={{ src: '/a.png', alt: 'A' }}
            facts={[{ key: 'RECORD', value: 'SC-1' }]}
          />
        </RegisterRows>,
      ),
      render(<DataStrip pairs={[{ key: 'RECORD', value: 'SC-1' }]} />),
      render(
        <DataStrip
          variant="embedded"
          pairs={[{ key: 'RECORD', value: 'SC-1' }]}
        />,
      ),
      render(<ImagePlaceholder state="empty" size="thumb" />),
      render(<ImagePlaceholder state="failed" showRetry />),
      render(<ImagePlaceholder state="loading" />),
      render(<EmptyState heading="H" body="B" />),
      render(<LoadingSkeleton variant="card" />),
      render(
        <table>
          <tbody>
            <LoadingSkeleton variant="table-row" />
          </tbody>
        </table>,
      ),
      render(
        <DataTable
          rows={[
            {
              id: '1',
              name: 'N',
              record: 'R',
              quantity: 1,
              condition: 'Working',
              updated: '2026-10-16',
            },
          ]}
        />,
      ),
    ];

    for (const { container } of samples) {
      const allElements = Array.from(container.querySelectorAll('*'));
      for (const el of allElements) {
        const cls = el.getAttribute('class') || '';
        for (const pattern of FORBIDDEN_SINGLE_PREFIX) {
          expect(
            pattern.test(cls),
            `Found dead single-prefix token matching ${pattern} on <${el.tagName.toLowerCase()} class="${cls}">`,
          ).toBe(false);
        }
      }
    }
  });
});
