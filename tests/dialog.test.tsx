// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  ConfirmDestructiveDialog,
  ExportDialog,
} from '@/app/_components/dialog';

describe('C-021 Dialog', () => {
  it('renders open dialog with overlay and panel token classes', () => {
    render(
      <Dialog open>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description body text.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Dialog Title')).toBeTruthy();

    const panelClasses = (dialog.getAttribute('class') ?? '').split(/\s+/);
    expect(panelClasses).toContain('w-full');
    expect(panelClasses).toContain('max-w-[560px]');
    expect(panelClasses).toContain('bg-bg-surface');
    expect(panelClasses).not.toContain('border-border-strong');
    expect(panelClasses).toContain('rounded-md');
    expect(panelClasses).toContain('shadow-modal');
    expect(panelClasses).toContain('p-5');

    expect(panelClasses).toContain('transition-transform');
    expect(panelClasses).not.toContain('duration-slow');
    expect(panelClasses).toContain('ease-standard');
    expect(panelClasses).toContain('motion-reduce:transition-none');

    const overlay = document.querySelector('[data-dialog-overlay]');
    expect(overlay).toBeTruthy();
    const overlayClasses = (overlay?.getAttribute('class') ?? '').split(/\s+/);
    expect(overlayClasses).toContain('fixed');
    expect(overlayClasses).toContain('inset-0');
    expect(overlayClasses).toContain('z-modal');
    expect(overlayClasses).toContain('bg-neutral-900/45');
  });

  it('allows Esc key to close dialog when pending is false', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent pending={false}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('prevents Esc key from closing dialog when pending is true', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent pending={true}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('S-009 ConfirmDestructiveDialog', () => {
  it('renders record quote, autofocuses Cancel (primary), and leaves Delete (danger) unfocused', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDestructiveDialog
        open
        itemName="Monitors"
        recordCode="SC-002"
        quantity={50}
        condition="Working"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Delete this item?')).toBeTruthy();
    expect(
      screen.getByText(
        'This removes the item and its photographs from the register, straight away. It cannot be undone.',
      ),
    ).toBeTruthy();

    expect(screen.getByText('Monitors')).toBeTruthy();
    expect(screen.getByText('SC-002')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete item' });

    expect(cancelBtn.hasAttribute('data-autofocus')).toBe(true);
    expect(deleteBtn.hasAttribute('data-autofocus')).toBe(false);

    expect(cancelBtn.className).toContain('bg-bg-action');
    expect(deleteBtn.className).toContain('bg-bg-danger');

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders pending state with Deleting… label swap and disables actions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDestructiveDialog
        open
        itemName="Monitors"
        recordCode="SC-002"
        quantity={50}
        condition="Working"
        pending
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const deletingBtn = screen.getByRole('button', { name: 'Deleting…' });
    expect(deletingBtn).toBeTruthy();
    expect(deletingBtn.hasAttribute('disabled')).toBe(true);
    expect(deletingBtn.getAttribute('aria-busy')).toBe('true');

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.hasAttribute('disabled')).toBe(true);
  });
});

describe('S-010 ExportDialog', () => {
  it('renders format radios, column list, Withheld record ID note, and actions', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();

    render(<ExportDialog open onExport={onExport} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Export the register')).toBeTruthy();
    expect(
      screen.getByText(
        'Two formats, for COREN accreditation evidence. Every item in the inventory is included.',
      ),
    ).toBeTruthy();

    const csvRadio = screen.getByRole('radio', { name: /CSV/i });
    const pdfRadio = screen.getByRole('radio', { name: /PDF/i });
    expect(csvRadio).toBeTruthy();
    expect(pdfRadio).toBeTruthy();

    expect(screen.getByText('Item name')).toBeTruthy();
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();
    expect(screen.getByText('Updated by')).toBeTruthy();
    expect(screen.getByText(/Withheld/i)).toBeTruthy();
    expect(
      screen.getByText(
        /Record IDs stay inside the admin app and are not written to the file/i,
      ),
    ).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn.className).toContain('border-border-strong');

    const downloadBtn = screen.getByRole('button', {
      name: /Download the file|Create the file/i,
    });
    expect(downloadBtn.className).toContain('bg-bg-action');

    fireEvent.click(pdfRadio);
    expect((pdfRadio as HTMLInputElement).checked).toBe(true);

    fireEvent.click(downloadBtn);
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('renders generating pending state with Preparing… label swap', () => {
    render(<ExportDialog open pending onExport={vi.fn()} onClose={vi.fn()} />);

    const preparingBtn = screen.getByRole('button', { name: 'Preparing…' });
    expect(preparingBtn).toBeTruthy();
    expect(preparingBtn.hasAttribute('disabled')).toBe(true);
  });
});
