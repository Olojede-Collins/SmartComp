import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEquipmentById } from '@/lib/equipment';
import { HeaderRail } from '../../_components/header-rail';
import { Footer } from '../../_components/footer';
import { ConditionChip } from '../../_components/condition-chip';
import { ImageGallery } from '../../_components/image-gallery';

export const revalidate = 60;

interface ItemPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    state?: string;
    [key: string]: string | string[] | undefined;
  }>;
}

export default async function ItemPage({
  params,
  searchParams,
}: ItemPageProps) {
  const { id } = await params;
  const search = searchParams ? await searchParams : undefined;
  const item = await getEquipmentById(id);

  if (!item) {
    notFound();
  }

  const isImageFailed =
    search?.state === 'image-failed' || !item.image_keys?.length;
  const dataState = isImageFailed ? 'image-failed' : 'default';

  return (
    <>
      <HeaderRail current="/room" />
      <main
        id="main"
        data-state={dataState}
        className="wrap flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/room"
            className="text-fg-link hover:underline min-h-11 inline-flex items-center px-1"
          >
            The collection
          </Link>
          <span className="text-fg-muted mx-2">/</span>
          <span className="text-fg-muted">Detail</span>
        </nav>
        <div className="spread grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-7 my-5">
          <div className="spread__media min-w-0">
            <ImageGallery
              images={item.image_keys}
              title={item.name}
              state={dataState}
            />
          </div>
          <div className="spread__label min-w-0">
            <div className="label-card apple-card bg-bg-surface border border-border-rule rounded-md overflow-hidden">
              <div className="p-5 md:p-6 border-b border-border-rule">
                <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block mb-2">
                  ITEM
                </span>
                <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 mb-3 break-words">
                  {item.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div>
                    <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block">
                      QUANTITY
                    </span>
                    <span className="text-data font-mono font-semibold">
                      {item.quantity}
                    </span>
                  </div>
                  <ConditionChip condition={item.condition} />
                </div>
              </div>
              <div className="p-5 md:p-6 border-b border-border-rule">
                <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block mb-2">
                  PRIMARY FUNCTIONALITY
                </span>
                <p className="verbatim whitespace-pre-wrap break-words text-body text-fg-default">
                  {item.core_functionality || '—'}
                </p>
              </div>
              <div className="p-5 md:p-6 border-b border-border-rule">
                <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block mb-2">
                  ADDITIONAL SPECIFICATIONS & CAPABILITIES
                </span>
                <p className="verbatim whitespace-pre-wrap break-words text-body text-fg-default">
                  {item.other_functionality ||
                    'No other functionality recorded.'}
                </p>
              </div>
              <div className="p-5 md:p-6">
                <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block mb-2">
                  PHOTOGRAPHS
                </span>
                <p className="text-caption text-fg-muted">
                  {item.image_keys?.length
                    ? `${item.image_keys.length} photograph(s) on file.`
                    : 'No photograph on file yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
