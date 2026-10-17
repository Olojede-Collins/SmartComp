// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteForm } from '@/app/_components/invite-form';

describe('C-025 InviteForm', () => {
  it('renders default state with heading, email field, and primary Send invite button', () => {
    render(<InviteForm />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Invite an administrator|Invite another admin/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'They will get an email with a link to set their own password.',
      ),
    ).toBeTruthy();

    const input = screen.getByLabelText(/EMAIL/i);
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('email');
    expect(input.getAttribute('placeholder')).toBe('colleague@example.edu.ng');

    const submitBtn = screen.getByRole('button', { name: 'Send invite' });
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.className).toContain('bg-bg-action');
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders sending state with Sending… label, disabled button, and read-only input', () => {
    render(
      <InviteForm state="sending" defaultEmail="colleague@example.invalid" />,
    );

    const button = screen.getByRole('button', { name: 'Sending…' });
    expect(button).toBeTruthy();
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    const input = screen.getByLabelText(/EMAIL/i);
    expect(
      input.hasAttribute('readonly') || input.hasAttribute('disabled'),
    ).toBe(true);
  });

  it('renders invited state with success banner and clears the form input', () => {
    render(
      <InviteForm state="invited" invitedEmail="new.admin@example.invalid" />,
    );

    const banner = screen.getByRole('status');
    expect(banner).toBeTruthy();
    expect(screen.getByText(/Invitation sent\./i)).toBeTruthy();
    expect(screen.getByText(/new\.admin@example\.invalid/i)).toBeTruthy();

    const input = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('renders invite-failed state with caution banner and preserves typed email', () => {
    render(
      <InviteForm
        state="invite-failed"
        defaultEmail="failed.admin@example.invalid"
      />,
    );

    const banner = screen.getByRole('alert');
    expect(banner).toBeTruthy();
    expect(banner.className).toContain('bg-bg-banner-warn');
    expect(screen.getByText('The invitation did not send.')).toBeTruthy();
    expect(screen.getByText('Mail delivery failed.')).toBeTruthy();
    expect(screen.getByText('gmail-send-failed')).toBeTruthy();

    const input = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
    expect(input.value).toBe('failed.admin@example.invalid');
  });

  it('submits typed email and switches states interactively', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<InviteForm onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice@example.edu.ng' } });

    const submitBtn = screen.getByRole('button', { name: 'Send invite' });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith('alice@example.edu.ng');

    expect(screen.getByRole('button', { name: 'Sending…' })).toBeTruthy();

    resolveSubmit();

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText(/Invitation sent\./i)).toBeTruthy();
      expect(input.value).toBe('');
    });
  });
});
