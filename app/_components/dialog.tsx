'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { FieldKey } from './field-key';
import { ConditionChip } from './condition-chip';
import { CONDITION_ENUM, type Condition } from './condition-enum';
import { Icon } from './icon';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-dialog-overlay=""
    className={cn(
      'fixed inset-0 z-modal overflow-auto flex justify-center items-start px-4 pt-12 pb-16 bg-neutral-900/45 backdrop-blur-sm',
      className,
    )}
    {...props}
  >
    {children}
  </DialogPrimitive.Overlay>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  pending?: boolean;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      pending = false,
      onEscapeKeyDown,
      onPointerDownOutside,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay>
        <DialogPrimitive.Content
          ref={ref}
          aria-modal="true"
          onEscapeKeyDown={(e) => {
            if (pending) {
              e.preventDefault();
              return;
            }
            onEscapeKeyDown?.(e);
          }}
          onPointerDownOutside={(e) => {
            if (pending) {
              e.preventDefault();
              return;
            }
            onPointerDownOutside?.(e);
          }}
          className={cn(
            'w-full max-w-[560px] bg-bg-surface rounded-md shadow-modal p-5',
            'transition-opacity transition-transform ease-standard motion-reduce:transition-none',
            'focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
            className,
          )}
          {...props}
          aria-busy={
            pending
              ? 'true'
              : ((props as Record<string, unknown>)['aria-busy'] as
                  boolean | 'true' | 'false' | undefined)
          }
          data-state={
            ((props as Record<string, unknown>)['data-state'] as
              string | undefined) ?? (pending ? 'confirming' : undefined)
          }
        >
          {children}
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('dlg__head flex flex-col gap-2 mb-3', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'dlg__actions flex flex-wrap gap-3 justify-end max-[47.99rem]:flex-col-reverse max-[47.99rem]:[&>*]:w-full',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-h3 font-sans font-medium text-fg-default m-0',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('dlg__body text-body text-fg-default m-0 mb-5', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export interface ConfirmDestructiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  itemName: string;
  recordCode: string;
  quantity: number;
  condition: Condition | string;
  onConfirm?: () => void;
  onCancel?: () => void;
  pending?: boolean;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title = 'Delete this item?',
  description = 'This removes the item and its photographs from the register, straight away. It cannot be undone.',
  itemName,
  recordCode,
  quantity,
  condition,
  onConfirm,
  onCancel,
  pending = false,
  confirmLabel = 'Delete item',
  pendingLabel = 'Deleting…',
  cancelLabel = 'Cancel',
}: ConfirmDestructiveDialogProps) {
  const isConditionValid =
    typeof condition === 'string' &&
    CONDITION_ENUM.includes(condition as Condition);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent pending={pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="dlg__record bg-bg-surface-sunken border border-border-rule rounded-md p-4 mb-5 flex flex-col gap-3">
          <p className="dlg__record-name text-item-name text-fg-default font-sans font-semibold m-0 break-words">
            {itemName}
          </p>
          <div className="dlg__facts flex flex-wrap gap-5">
            <div className="flex flex-col gap-1 min-w-0">
              <FieldKey>RECORD</FieldKey>
              <span className="text-data font-mono text-fg-default">
                {recordCode}
              </span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <FieldKey>QUANTITY</FieldKey>
              <span className="text-data-strong font-mono text-fg-default">
                {quantity}
              </span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <FieldKey>CONDITION</FieldKey>
              {isConditionValid ? (
                <ConditionChip condition={condition as Condition} />
              ) : (
                <span className="text-body-small text-fg-default">
                  {condition}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            autoFocus
            data-autofocus=""
            data-cancel=""
            id="btn-cancel"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            data-confirm=""
            pendingLabel={pending ? pendingLabel : undefined}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ExportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  format?: 'pdf' | 'csv';
  onExport?: (format: 'pdf' | 'csv') => void;
  onClose?: () => void;
  pending?: boolean;
}

export function ExportDialog({
  open,
  onOpenChange,
  title = 'Export the Register',
  description = 'Two formats for inventory record keeping and reporting. Every item in the inventory is included.',
  format: propFormat = 'csv',
  onExport,
  onClose,
  pending = false,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = React.useState<'pdf' | 'csv'>(
    propFormat,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent pending={pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <fieldset className="dlg__fieldset border-0 p-0 m-0 mb-5 flex flex-col gap-2">
          <legend className="text-micro font-medium tracking-caps text-fg-muted mb-2">
            FORMAT
          </legend>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="pdf"
              checked={selectedFormat === 'pdf'}
              disabled={pending}
              onChange={() => setSelectedFormat('pdf')}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-body font-medium text-fg-default">PDF</span>
              <span className="text-caption text-fg-muted">
                One file, laid out for printing and signing.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="csv"
              checked={selectedFormat === 'csv'}
              disabled={pending}
              onChange={() => setSelectedFormat('csv')}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-body font-medium text-fg-default">CSV</span>
              <span className="text-caption text-fg-muted">
                A spreadsheet, one row per item.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="dlg__fieldset border-0 p-0 m-0 mb-5 flex flex-col gap-2">
          <legend className="text-micro font-medium tracking-caps text-fg-muted mb-2">
            WHAT IS WRITTEN TO THE FILE
          </legend>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            <li className="flex items-start gap-3 text-body-small text-fg-default">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                Item name{' '}
                <span className="text-caption text-fg-muted">
                  — Kept exactly as submitted.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 text-body-small text-fg-default">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                Condition{' '}
                <span className="text-caption text-fg-muted">
                  — Working, Faulty, Under Maintenance or Decommissioned.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 text-body-small text-fg-default">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>Quantity</span>
            </li>
            <li className="flex items-start gap-3 text-body-small text-fg-default">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                Updated{' '}
                <span className="text-caption text-fg-muted">
                  — The date the record last changed.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 text-body-small text-fg-default">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                Updated by{' '}
                <span className="text-caption text-fg-muted">
                  — The admin who last changed it.
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 text-body-small text-fg-muted">
              <input type="checkbox" disabled className="mt-1" />
              <span>
                Record ID <span className="font-mono text-data">SC-001…</span>{' '}
                <span className="text-micro font-medium text-fg-muted border border-border-rule rounded-sm px-1.5 py-0.5">
                  Withheld
                </span>
              </span>
            </li>
          </ul>
          <p className="dlg__note text-caption text-fg-muted m-0 mt-3">
            These five columns are always included. Record IDs stay inside the
            admin app and are not written to the file.
          </p>
        </fieldset>

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Close
          </Button>
          <Button
            variant="default"
            pendingLabel={pending ? 'Preparing…' : undefined}
            disabled={pending}
            onClick={() => onExport?.(selectedFormat)}
          >
            <Icon name="download" size={16} />
            <span>Download the File</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
