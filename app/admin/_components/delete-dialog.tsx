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
import { ConditionChip } from '@/app/_components/condition-chip';
import { deleteItem, ApiError } from '@/lib/admin-api';

export interface DeleteDialogItem {
  id: string;
  name: string;
  recordCode?: string;
  quantity: number;
  condition: string;
}

export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DeleteDialogItem | null;
  onDeleted?: (id: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function DeleteDialog({
  open,
  onOpenChange,
  item,
  onDeleted,
  triggerRef,
}: DeleteDialogProps) {
  const [state, setState] = React.useState<
    'default' | 'confirming' | 'deleted' | 'not-found'
  >('default');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const inFlightRef = React.useRef(false);
  const deletedHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const notFoundHeadingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (state === 'deleted' && deletedHeadingRef.current) {
      deletedHeadingRef.current.focus();
    } else if (state === 'not-found' && notFoundHeadingRef.current) {
      notFoundHeadingRef.current.focus();
    }
  }, [state]);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState('default');
      setErrorMessage(null);
    }
  }

  if (!item) return null;

  const code =
    item.recordCode ||
    (item.id.startsWith('SC-')
      ? item.id
      : item.id.length > 8
        ? item.id.slice(0, 8)
        : item.id);

  const handleDelete = async () => {
    if (inFlightRef.current || state === 'confirming') return;
    inFlightRef.current = true;
    setState('confirming');
    setErrorMessage(null);
    try {
      await deleteItem(item.id);
      setState('deleted');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setState('not-found');
      } else {
        setState('default');
        setErrorMessage(err instanceof Error ? err.message : 'Deletion failed');
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    onDeleted?.(item.id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={state === 'confirming' ? () => {} : onOpenChange}
    >
      <DialogContent
        pending={state === 'confirming'}
        onCloseAutoFocus={(e) => {
          if (triggerRef?.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        {state === 'deleted' ? (
          <>
            <DialogHeader>
              <DialogTitle
                id="dlg-title-deleted"
                ref={deletedHeadingRef}
                tabIndex={-1}
              >
                Deleted.
              </DialogTitle>
              <DialogDescription>
                {item.name} ({code}) is no longer on the register, and its
                photographs are no longer shown in the collection.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="default" onClick={handleFinish}>
                Back to the inventory
              </Button>
            </DialogFooter>
          </>
        ) : state === 'not-found' ? (
          <>
            <DialogHeader>
              <DialogTitle
                id="dlg-title-notfound"
                ref={notFoundHeadingRef}
                tabIndex={-1}
              >
                That item is already gone.
              </DialogTitle>
              <div className="font-mono text-data text-fg-muted mb-2">
                item-not-found
              </div>
              <DialogDescription>
                Someone else deleted {code}, or it was removed earlier. Nothing
                was changed just now. The register below is up to date.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="default" onClick={handleFinish}>
                Back to the inventory
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete this item?</DialogTitle>
              <DialogDescription>
                This removes the item and its photographs from the register,
                straight away. It cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {errorMessage ? (
              <p className="text-body-small text-fg-status-faulty m-0 mb-3">
                {errorMessage}
              </p>
            ) : null}

            <div className="dlg__record bg-bg-surface-sunken border border-border-rule rounded-md p-4 mb-5 flex flex-col gap-3">
              <p className="dlg__record-name text-item-name text-fg-default font-serif m-0 break-words">
                {item.name}
              </p>
              <div className="dlg__facts flex flex-wrap gap-5">
                <div className="flex flex-col gap-1 min-w-0">
                  <FieldKey>RECORD</FieldKey>
                  <span className="text-data font-mono text-fg-default">
                    {code}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <FieldKey>QUANTITY</FieldKey>
                  <span className="text-data-strong font-mono text-fg-default">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <FieldKey>CONDITION</FieldKey>
                  <ConditionChip condition={item.condition} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="default"
                autoFocus
                disabled={state === 'confirming'}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={state === 'confirming'}
                pendingLabel={state === 'confirming' ? 'Deleting…' : undefined}
                onClick={handleDelete}
              >
                Delete item
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
