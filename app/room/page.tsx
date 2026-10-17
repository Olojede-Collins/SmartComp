import Link from 'next/link';
import { getEquipment, type Equipment } from '@/lib/equipment';
import { HeaderRail } from '../_components/header-rail';
import { Footer } from '../_components/footer';
import { EmptyState } from '../_components/empty-state';
import { RegisterRow } from '../_components/register-row';
import { Banner } from '../_components/banner';

export const revalidate = 60;

interface RoomPageProps {
  searchParams?: Promise<{
    state?: string;
    [key: string]: string | string[] | undefined;
  }>;
}

export default async function RoomPage({ searchParams }: RoomPageProps = {}) {
  const search = searchParams ? await searchParams : undefined;
  let items: Equipment[] = [];
  let isError = search?.state === 'error';

  if (!isError) {
    try {
      items = await getEquipment();
    } catch {
      isError = true;
    }
  }

  const sortedItems = items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const state = isError
    ? 'error'
    : sortedItems.length === 0
      ? 'empty'
      : 'default';

  return (
    <>
      <HeaderRail current="/room" />
      <main
        id="main"
        data-state={state}
        className="wrap flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        <div className="page-head mb-8">
          <h1 className="text-h1 tracking-h1 mb-2 font-sans font-bold text-neutral-900">
            The Collection
          </h1>
          <p className="text-body-lg text-fg-muted max-w-[var(--layout-measure)]">
            Every item in the smart class, in name order.
          </p>
        </div>
        {isError ? (
          <Banner
            tone="error"
            heading="The collection could not be loaded."
            className="my-4"
          >
            <span>
              There was a problem reaching the inventory. Nothing on the record
              was changed.
            </span>
            <span className="block mt-4">
              <Link
                href="/room"
                className="btn btn--primary inline-flex items-center justify-center min-h-12 px-5 rounded-md bg-bg-action text-fg-on-action font-semibold no-underline hover:bg-bg-action-hover active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Check again
              </Link>
            </span>
          </Banner>
        ) : sortedItems.length === 0 ? (
          <EmptyState
            heading="Nothing on the record yet."
            body="The register has no entries. Everything the lab team records will appear here."
            action={
              <Link
                href="/room"
                className="btn btn--primary inline-flex items-center justify-center min-h-12 px-5 rounded-md bg-bg-action text-fg-on-action font-semibold no-underline hover:bg-bg-action-hover active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Check again
              </Link>
            }
          />
        ) : (
          <ul className="rows grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
            {sortedItems.map((item) => (
              <RegisterRow
                key={item.id}
                href={`/item/${item.id}`}
                name={item.name}
                condition={item.condition}
                variant="card"
                image={
                  item.image_keys?.length
                    ? { src: item.image_keys[0], alt: item.name }
                    : undefined
                }
                facts={[
                  { key: 'QUANTITY', value: item.quantity, strong: true },
                ]}
              />
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
