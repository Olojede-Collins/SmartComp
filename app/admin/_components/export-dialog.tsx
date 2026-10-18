'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/_components/dialog';
import { Button } from '@/app/_components/button';
import { FieldKey } from '@/app/_components/field-key';
import { Icon } from '@/app/_components/icon';
import { exportInventory } from '@/lib/admin-api';

export interface ExportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  format?: 'pdf' | 'csv';
  itemCount?: number;
  onClose?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

type DialogState = 'default' | 'generating' | 'success' | 'failure';

function getItemCountText(count?: number): string {
  if (count === undefined) return 'Seven items';
  const numberWords: Record<number, string> = {
    0: 'No',
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
    11: 'Eleven',
    12: 'Twelve',
    13: 'Thirteen',
    14: 'Fourteen',
    15: 'Fifteen',
  };
  const word = numberWords[count] ?? String(count);
  return `${word} item${count === 1 ? '' : 's'}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = globalThis.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  globalThis.URL.revokeObjectURL(url);
}

export function ExportDialog({
  open = false,
  onOpenChange,
  title = 'Export the Register',
  description = 'Two formats for inventory record keeping and reporting. Every item in the inventory is included.',
  format: initialFormat = 'csv',
  itemCount,
  onClose,
  triggerRef,
}: ExportDialogProps) {
  const [format, setFormat] = React.useState<'pdf' | 'csv'>(initialFormat);
  const [state, setState] = React.useState<DialogState>('default');
  const [downloadedBlob, setDownloadedBlob] = React.useState<Blob | null>(null);
  const [generatedFilename, setGeneratedFilename] = React.useState('');
  const [selectedCols, setSelectedCols] = React.useState<string[]>([
    'name',
    'condition',
    'quantity',
    'updated_at',
    'updated_by',
  ]);

  const toggleCol = (key: string) => {
    if (key === 'name') return;
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  };

  const successHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const failureHeadingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (state === 'success' && successHeadingRef.current) {
      successHeadingRef.current.focus();
    } else if (state === 'failure' && failureHeadingRef.current) {
      failureHeadingRef.current.focus();
    }
  }, [state]);

  const handleClose = () => {
    if (state === 'generating') return;
    setState('default');
    setFormat(initialFormat);
    setSelectedCols([
      'name',
      'condition',
      'quantity',
      'updated_at',
      'updated_by',
    ]);
    onClose?.();
    onOpenChange?.(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (state === 'generating') return;
    if (!nextOpen) {
      setState('default');
      setFormat(initialFormat);
      setSelectedCols([
        'name',
        'condition',
        'quantity',
        'updated_at',
        'updated_by',
      ]);
    }
    onOpenChange?.(nextOpen);
  };

  const handleGenerate = async () => {
    if (state === 'generating') return;

    setState('generating');

    try {
      const blob = await exportInventory(format, selectedCols);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `abu-smart-class-inventory-${dateStr}.${format}`;

      downloadBlob(blob, filename);

      setDownloadedBlob(blob);
      setGeneratedFilename(filename);
      setState('success');
    } catch {
      setState('failure');
    }
  };

  const handleRedownload = () => {
    if (downloadedBlob && generatedFilename) {
      downloadBlob(downloadedBlob, generatedFilename);
    }
    handleClose();
  };

  const isPending = state === 'generating';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        pending={isPending}
        onCloseAutoFocus={(e) => {
          if (triggerRef?.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        {state === 'default' || state === 'generating' ? (
          <div>
            <DialogHeader>
              <DialogTitle asChild>
                <h3 className="text-h3 font-sans font-medium text-fg-default m-0">
                  {title}
                </h3>
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <fieldset className="dlg__fieldset border-0 p-0 m-0 mb-5 flex flex-col gap-2 min-w-0">
              <legend className="p-0 mb-3">
                <FieldKey>FORMAT</FieldKey>
              </legend>
              <label className="flex gap-3 items-start border border-border-rule rounded-md p-3 md:p-4 bg-bg-surface cursor-pointer min-h-11 hover:border-border-strong hover:bg-bg-row-hover has-[:checked]:border-border-focus has-[:checked]:bg-bg-status-working">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  disabled={isPending}
                  onChange={() => setFormat('pdf')}
                  autoFocus
                  className="mt-1 size-5 accent-bg-action cursor-pointer"
                />
                <span className="flex flex-col gap-1 min-w-0 min-h-11 justify-center">
                  <span className="text-body font-semibold text-fg-default">
                    PDF
                  </span>
                  <span className="text-body-small text-fg-muted">
                    One file, laid out for printing and signing.
                  </span>
                </span>
              </label>

              <label className="flex gap-3 items-start border border-border-rule rounded-md p-3 md:p-4 bg-bg-surface cursor-pointer min-h-11 hover:border-border-strong hover:bg-bg-row-hover has-[:checked]:border-border-focus has-[:checked]:bg-bg-status-working">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  disabled={isPending}
                  onChange={() => setFormat('csv')}
                  className="mt-1 size-5 accent-bg-action cursor-pointer"
                />
                <span className="flex flex-col gap-1 min-w-0 min-h-11 justify-center">
                  <span className="text-body font-semibold text-fg-default">
                    CSV
                  </span>
                  <span className="text-body-small text-fg-muted">
                    A spreadsheet, one row per item.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="dlg__fieldset border-0 p-0 m-0 mb-5 flex flex-col gap-2 min-w-0">
              <legend className="p-0 mb-3">
                <FieldKey>COLUMNS INCLUDED IN EXPORT</FieldKey>
              </legend>
              <ul className="border border-border-rule rounded-md overflow-hidden list-none p-0 m-0">
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 border-b border-border-rule bg-bg-surface">
                  <input
                    type="checkbox"
                    id="col-name"
                    checked
                    disabled
                    className="size-5 accent-bg-action cursor-default rounded"
                  />
                  <label
                    htmlFor="col-name"
                    className="flex items-center gap-2 min-w-0 min-h-11 cursor-default text-body text-fg-default"
                  >
                    <span className="font-medium">Item name</span>
                    <span className="text-micro text-fg-muted font-normal">
                      (Required)
                    </span>
                  </label>
                </li>
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 border-b border-border-rule bg-bg-surface hover:bg-bg-row-hover">
                  <input
                    type="checkbox"
                    id="col-cond"
                    checked={selectedCols.includes('condition')}
                    disabled={isPending}
                    onChange={() => toggleCol('condition')}
                    className="size-5 accent-bg-action cursor-pointer rounded"
                  />
                  <label
                    htmlFor="col-cond"
                    className="flex items-center min-w-0 min-h-11 cursor-pointer text-body text-fg-default font-medium flex-1"
                  >
                    Condition
                  </label>
                </li>
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 border-b border-border-rule bg-bg-surface hover:bg-bg-row-hover">
                  <input
                    type="checkbox"
                    id="col-qty"
                    checked={selectedCols.includes('quantity')}
                    disabled={isPending}
                    onChange={() => toggleCol('quantity')}
                    className="size-5 accent-bg-action cursor-pointer rounded"
                  />
                  <label
                    htmlFor="col-qty"
                    className="flex items-center min-w-0 min-h-11 cursor-pointer text-body text-fg-default font-medium flex-1"
                  >
                    Quantity
                  </label>
                </li>
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 border-b border-border-rule bg-bg-surface hover:bg-bg-row-hover">
                  <input
                    type="checkbox"
                    id="col-upd"
                    checked={selectedCols.includes('updated_at')}
                    disabled={isPending}
                    onChange={() => toggleCol('updated_at')}
                    className="size-5 accent-bg-action cursor-pointer rounded"
                  />
                  <label
                    htmlFor="col-upd"
                    className="flex items-center min-w-0 min-h-11 cursor-pointer text-body text-fg-default font-medium flex-1"
                  >
                    Updated
                  </label>
                </li>
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 border-b border-border-rule bg-bg-surface hover:bg-bg-row-hover">
                  <input
                    type="checkbox"
                    id="col-by"
                    checked={selectedCols.includes('updated_by')}
                    disabled={isPending}
                    onChange={() => toggleCol('updated_by')}
                    className="size-5 accent-bg-action cursor-pointer rounded"
                  />
                  <label
                    htmlFor="col-by"
                    className="flex items-center min-w-0 min-h-11 cursor-pointer text-body text-fg-default font-medium flex-1"
                  >
                    Updated by
                  </label>
                </li>
                <li className="flex gap-3 items-center p-3 md:px-4 min-h-11 bg-bg-disabled">
                  <input
                    type="checkbox"
                    id="col-id"
                    disabled
                    aria-describedby="col-id-note"
                    className="size-5 accent-fg-disabled cursor-not-allowed rounded"
                  />
                  <label
                    htmlFor="col-id"
                    className="flex items-center min-w-0 min-h-11 cursor-not-allowed text-body text-fg-disabled font-medium"
                  >
                    Record ID
                  </label>
                  <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-micro font-medium tracking-micro text-fg-muted">
                    <svg
                      className="size-4 shrink-0"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <rect
                        x="4.6"
                        y="8.8"
                        width="10.8"
                        height="7.4"
                        rx="1.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      />
                      <path
                        d="M7.2 8.8V6.9a2.8 2.8 0 0 1 5.6 0v1.9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Withheld</span>
                  </span>
                </li>
              </ul>
              <p
                id="col-id-note"
                className="text-caption text-fg-muted m-0 mt-3"
              >
                Selected columns are included in the export. Record IDs stay
                inside the admin app and are not written to the file.
              </p>
            </fieldset>

            <DialogFooter>
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                disabled={isPending}
                pendingLabel={isPending ? 'Preparing…' : undefined}
                onClick={handleGenerate}
              >
                Create the File
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {state === 'success' ? (
          <div>
            <div
              className="border border-border-status-working bg-bg-surface rounded-md p-4 flex gap-3 items-start mb-5"
              role="status"
            >
              <svg
                className="size-5 shrink-0 text-fg-status-working mt-0.5"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="7.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M6.6 10.2 9 12.6l4.4-4.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <h3
                  id="dlg-title-success"
                  ref={successHeadingRef}
                  tabIndex={-1}
                  className="text-h3 font-medium text-fg-status-working m-0 outline-none"
                >
                  Your file is ready.
                </h3>
                <p
                  id="dlg-body-success"
                  className="text-body-small text-fg-default m-0"
                >
                  {selectedCols.length === 5
                    ? `${getItemCountText(itemCount)}, with the five columns listed above.`
                    : `${getItemCountText(itemCount)}, with the selected columns.`}
                </p>
                <p
                  id="file-name"
                  className="font-mono text-body text-fg-default bg-bg-surface-sunken border border-border-rule rounded-sm p-3 break-all m-0"
                >
                  {generatedFilename}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Close
              </Button>
              <Button variant="default" onClick={handleRedownload}>
                <Icon name="download" size={16} />
                <span>Download the File</span>
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {state === 'failure' ? (
          <div>
            <div
              className="border border-border-error bg-bg-surface rounded-md p-4 flex gap-3 items-start mb-5"
              role="alert"
            >
              <Icon
                name="triangle-alert"
                size={20}
                className="shrink-0 text-fg-status-faulty mt-0.5"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <h3
                  id="dlg-title-failure"
                  ref={failureHeadingRef}
                  tabIndex={-1}
                  className="text-h3 font-medium text-fg-status-faulty m-0 outline-none"
                >
                  The file could not be created.
                </h3>
                <p
                  id="dlg-body-failure"
                  className="text-body-small text-fg-default m-0"
                >
                  Nothing was downloaded and nothing on the register was
                  changed. If you were signed out, sign in again and try once
                  more. Otherwise try again in a moment, and tell the lab team
                  if it keeps happening.
                </p>
                <p className="font-mono text-body text-fg-muted m-0">
                  export-generation-failed
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Close
              </Button>
              <Button variant="default" onClick={() => setState('default')}>
                Try again
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
