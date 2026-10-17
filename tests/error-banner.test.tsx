// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBanner } from '@/app/_components/error-banner';

describe('C-026 ErrorBanner', () => {
  it('renders condition-enum-invalid as error tone with verbatim code and heading', () => {
    render(<ErrorBanner code="condition-enum-invalid" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('banner--error');
    expect(screen.getByText('That condition is not on the list.')).toBeTruthy();
    const codeEl = screen.getByText('condition-enum-invalid');
    expect(codeEl.className).toContain('font-mono');
    expect(codeEl.className).toContain('text-data');
  });

  it('renders inventory-ceiling with error tone and verbatim message', () => {
    render(<ErrorBanner code="inventory-ceiling" />);
    expect(screen.getByRole('alert').className).toContain('banner--error');
    expect(
      screen.getByText('The register cannot hold more than 15 items.'),
    ).toBeTruthy();
    expect(screen.getByText('inventory-ceiling').className).toContain(
      'font-mono',
    );
  });

  it('renders file-too-large as caution tone', () => {
    render(<ErrorBanner code="file-too-large" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-bg-banner-warn');
    expect(alert.className).toContain('border-border-warn');
    expect(screen.getByText('That photograph is too large.')).toBeTruthy();
    expect(screen.getByText('file-too-large').className).toContain('font-mono');
  });

  it('renders unsupported-media-type as caution tone', () => {
    render(<ErrorBanner code="unsupported-media-type" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-bg-banner-warn');
    expect(screen.getByText('That file type is not accepted.')).toBeTruthy();
  });

  it('renders email-delivery-failed with caution tone and faulty line', () => {
    render(<ErrorBanner code="email-delivery-failed" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-bg-banner-warn');
    expect(screen.getByText('The invitation did not send.')).toBeTruthy();
    expect(screen.getByText('Mail delivery failed.').className).toContain(
      'text-fg-status-faulty',
    );
    expect(screen.getByText('email-delivery-failed').className).toContain(
      'font-mono',
    );
  });

  it('renders gmail-send-failed alias with caution tone and faulty line', () => {
    render(<ErrorBanner code="gmail-send-failed" />);
    expect(screen.getByText('The invitation did not send.')).toBeTruthy();
    expect(screen.getByText('Mail delivery failed.')).toBeTruthy();
    expect(screen.getByText('gmail-send-failed')).toBeTruthy();
  });

  it('renders last-admin as inline error banner', () => {
    render(<ErrorBanner code="last-admin" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('banner--error');
    expect(screen.getByText('That admin cannot be removed.')).toBeTruthy();
    expect(screen.getByText('last-admin').className).toContain('font-mono');
  });

  it('renders item-not-found with 404 error tone', () => {
    render(<ErrorBanner code="item-not-found" />);
    expect(screen.getByRole('alert').className).toContain('banner--error');
    expect(screen.getByText('That item is already gone.')).toBeTruthy();
    expect(screen.getByText('item-not-found')).toBeTruthy();
  });

  it('renders admin-unauthorized with 403 error tone', () => {
    render(<ErrorBanner code="admin-unauthorized" />);
    expect(screen.getByRole('alert').className).toContain('banner--error');
    expect(
      screen.getByText('You do not have administrator permissions.'),
    ).toBeTruthy();
    expect(screen.getByText('admin-unauthorized')).toBeTruthy();
  });

  it('renders export-generation-failed with 500 error tone', () => {
    render(<ErrorBanner code="export-generation-failed" />);
    expect(screen.getByRole('alert').className).toContain('banner--error');
    expect(screen.getByText('The file could not be created.')).toBeTruthy();
    expect(screen.getByText('export-generation-failed')).toBeTruthy();
  });

  it('renders cold-start-timeout with error tone', () => {
    render(<ErrorBanner code="cold-start-timeout" />);
    expect(screen.getByRole('alert').className).toContain('banner--error');
    expect(
      screen.getByText('The register took too long to start.'),
    ).toBeTruthy();
    expect(screen.getByText('cold-start-timeout')).toBeTruthy();
  });

  it('renders verbatim machine code before friendly prose in DOM order', () => {
    render(
      <ErrorBanner
        code="condition-enum-invalid"
        body="Nothing was saved. Choose one of the four recorded states and save again."
      />,
    );
    const codeEl = screen.getByText('condition-enum-invalid');
    const proseEl = screen.getByText(
      'Nothing was saved. Choose one of the four recorded states and save again.',
    );
    expect(
      codeEl.compareDocumentPosition(proseEl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
