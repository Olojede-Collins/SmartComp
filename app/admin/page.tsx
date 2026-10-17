'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from './_components/admin-nav';
import { Footer } from '@/app/_components/footer';
import { Button } from '@/app/_components/button';
import { Icon } from '@/app/_components/icon';
import { DataStrip } from '@/app/_components/data-strip';
import { DataTable, type DataTableRow } from '@/app/_components/data-table';
import { EmptyState } from '@/app/_components/empty-state';
import {
  ColdStartPanel,
  type ColdStartState,
} from '@/app/_components/cold-start-panel';
import { ExportDialog } from './_components/export-dialog';
import {
  DeleteDialog,
  type DeleteDialogItem,
} from './_components/delete-dialog';
import { getItems, type Equipment } from '@/lib/admin-api';
import { getToken } from '@/lib/admin-auth';

function formatRecordCode(id: string): string {
  if (id.startsWith('SC-')) return id;
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

export default function AdminInventoryPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<Equipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [coldStartState, setColdStartState] =
    React.useState<ColdStartState>('ready');
  const [deleteItemData, setDeleteItemData] =
    React.useState<DeleteDialogItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const exportBtnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let active = true;

    if (!getToken()) {
      router.push('/admin/login');
      return;
    }

    getItems({
      onSlow: () => {
        if (active) {
          setColdStartState('waiting');
        }
      },
    })
      .then((data) => {
        if (!active) return;
        setItems(data);
        setColdStartState('ready');
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (
          err &&
          typeof err === 'object' &&
          'status' in err &&
          ((err as { status: number }).status === 401 ||
            (err as { status: number }).status === 403)
        ) {
          router.push('/admin/login');
          return;
        }
        setColdStartState('error');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const latestUpdated = React.useMemo(() => {
    if (items.length === 0) return '-';
    const dates = items
      .map((i) => i.updated_at || i.created_at)
      .filter(Boolean)
      .sort()
      .reverse();
    return dates[0] ? formatDate(dates[0]) : '-';
  }, [items]);

  const tableRows: DataTableRow[] = React.useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      record: formatRecordCode(item.id),
      quantity: item.quantity,
      condition: item.condition,
      updated: formatDate(item.updated_at || item.created_at),
    }));
  }, [items]);

  const handleOpenDelete = (id: string) => {
    const found = items.find((i) => i.id === id);
    if (found) {
      setDeleteItemData({
        id: found.id,
        name: found.name,
        recordCode: formatRecordCode(found.id),
        quantity: found.quantity,
        condition: found.condition,
      });
      setIsDeleteOpen(true);
    }
  };

  const handleDeleted = (deletedId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== deletedId));
  };

  return (
    <>
      <AdminNav current="/admin" />

      <main
        id="main"
        className="flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        {coldStartState !== 'ready' ? (
          <div className="mb-6">
            <ColdStartPanel state={coldStartState} />
          </div>
        ) : null}

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex flex-col gap-2 max-w-[var(--layout-measure)]">
              <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 m-0">
                The Inventory
              </h1>
              <p className="text-body text-fg-muted m-0">
                Everything the lab team has recorded, kept as submitted. Only
                lab team admins can change it.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="default"
                onClick={() => router.push('/admin/items/new')}
              >
                <Icon name="plus" size={16} />
                <span>Add item</span>
              </Button>
              <Button
                ref={exportBtnRef}
                variant="ghost"
                onClick={() => setIsExportOpen(true)}
              >
                <Icon name="download" size={16} />
                <span>Export</span>
              </Button>
            </div>
          </div>

          <DataStrip
            pairs={[
              { key: 'ENTRIES', value: items.length },
              { key: 'UPDATED', value: latestUpdated },
            ]}
          />
        </div>

        {loading && items.length === 0 ? (
          <DataTable rows={[]} state="loading" />
        ) : items.length === 0 ? (
          <EmptyState
            heading="No items yet."
            body="Add the first item to start the register."
            action={
              <Button
                variant="default"
                onClick={() => router.push('/admin/items/new')}
              >
                <Icon name="plus" size={16} />
                <span>Add item</span>
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={tableRows}
            onEdit={(id) => router.push(`/admin/items/${id}`)}
            onDelete={handleOpenDelete}
          />
        )}
      </main>

      <Footer variant="admin" />

      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        item={deleteItemData}
        onDeleted={handleDeleted}
      />

      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        onClose={() => setIsExportOpen(false)}
        itemCount={items.length}
        triggerRef={exportBtnRef}
      />
    </>
  );
}
