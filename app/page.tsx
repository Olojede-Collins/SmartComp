import Link from 'next/link';
import { getEquipment, type Equipment } from '@/lib/equipment';
import { HeaderRail } from './_components/header-rail';
import { Footer } from './_components/footer';
import { EmptyState } from './_components/empty-state';
import { Carousel } from './_components/carousel';
import { Banner } from './_components/banner';
import { HeroCarousel } from './_components/hero-carousel';

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<{
    state?: string;
    [key: string]: string | string[] | undefined;
  }>;
}

export default async function Page({ searchParams }: PageProps = {}) {
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

  const state = isError ? 'error' : items.length === 0 ? 'empty' : 'default';

  return (
    <>
      <HeaderRail current="/" />
      <main
        id="main"
        data-state={state}
        className="wrap flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        <HeroCarousel />
        <hr className="border-t border-border-rule my-6" aria-hidden="true" />
        <section aria-labelledby="register-title">
          <div className="section-head flex flex-wrap gap-3 items-baseline justify-between mb-5">
            <h2 id="register-title" className="text-h2 font-serif">
              The register
            </h2>
            <p className="text-data text-fg-muted font-mono">
              {isError
                ? '—'
                : `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`}
            </p>
          </div>
          {isError ? (
            <Banner
              tone="error"
              heading="The register could not be loaded."
              className="my-4"
            >
              <span>
                There was a problem reaching the inventory. Nothing on the
                record was changed.
              </span>
              <span className="block mt-4">
                <Link
                  href="/"
                  className="btn btn--primary inline-flex items-center justify-center min-h-12 px-5 rounded-md bg-bg-action text-fg-on-action font-semibold no-underline hover:bg-bg-action-hover active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  Check again
                </Link>
              </span>
            </Banner>
          ) : items.length === 0 ? (
            <EmptyState
              heading="Nothing on the record yet."
              body="The register has no entries. Everything the lab team records will appear here."
              action={
                <Link
                  href="/"
                  className="btn btn--primary inline-flex items-center justify-center min-h-12 px-5 rounded-md bg-bg-action text-fg-on-action font-semibold no-underline hover:bg-bg-action-hover active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  Check again
                </Link>
              }
            />
          ) : (
            <Carousel
              items={items.map((item) => ({
                href: `/item/${item.id}`,
                name: item.name,
                condition: item.condition,
                image: item.image_keys?.length
                  ? { src: item.image_keys[0], alt: item.name }
                  : undefined,
                facts: [
                  { key: 'RECORD', value: item.id.slice(0, 8) },
                  { key: 'QUANTITY', value: item.quantity, strong: true },
                  { key: 'UPDATED', value: item.updated_at.slice(0, 10) },
                ],
              }))}
            />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
