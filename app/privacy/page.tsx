import { HeaderRail } from '../_components/header-rail';
import { Footer } from '../_components/footer';
import { Stamp } from '../_components/stamp';

export const metadata = {
  title: 'Privacy — ABU Smart Class',
};

export default function PrivacyPage() {
  return (
    <>
      <HeaderRail />
      <main
        id="main"
        className="wrap flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        <div className="max-w-[var(--layout-measure)]">
          <h1 className="text-h1 tracking-h1 font-serif mb-2">Privacy</h1>
          <p className="text-body-lg text-fg-muted mb-4">
            Plain words about what this site keeps, and what it does not.
          </p>
          <div className="my-4">
            <Stamp>
              DRAFT — TO BE CHECKED BY THE LEGAL OFFICE BEFORE LAUNCH
            </Stamp>
          </div>
          <p className="text-body mb-6">
            This site is a public catalogue of the equipment in the Smart Class.
            You do not need an account to use it, and we do not keep a record of
            your visit.
          </p>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">What the site holds</h2>
            <p className="text-body mb-3">
              Item records: the name of each piece of equipment, what it does,
              its current condition, how many there are, and the date it was
              last updated. Wording is kept exactly as the lab team typed it.
            </p>
            <p className="text-body mb-3">Photographs of that equipment.</p>
            <p className="text-body mb-3">
              And a short list of lab team admin names and email addresses, so
              that the team can sign in and so that every change to a record can
              be credited to the person who made it.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">The photographs</h2>
            <p className="text-body mb-3">
              The first photographs came from the lab team&apos;s own shared
              folder on Google Drive. Before any of them appear here they are
              resized and re-saved for the web, and only the web version is
              published — the originals stay in the Drive folder and are not
              served from this site.
            </p>
            <p className="text-body mb-3">
              After launch, lab team admins can add photographs the same way,
              from a record&apos;s edit page. Every upload is checked and
              re-processed before it is stored.
            </p>
            <p className="text-body mb-3">
              The photographs show equipment in a room. They are not meant to
              show people, and nothing on this site identifies a visitor.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">What we do not do</h2>
            <ul className="list-disc pl-5 space-y-1 text-body mb-3">
              <li>No visitor accounts, so no visitor names or passwords.</li>
              <li>No tracking, no analytics, no advertising.</li>
              <li>
                No cookies of our own. The only cookie in the whole system is
                the sign-in session, and only while a lab team admin is signed
                in. Browsing this site needs none of it.
              </li>
              <li>No sharing of anything with other organisations.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">How long we keep it</h2>
            <p className="text-body mb-3">
              Item records and their photographs stay here for as long as the
              equipment is in the Smart Class. If the lab team removes an item,
              its record and its photographs disappear from this site straight
              away. Old copies in backups fade out on their own schedule after
              that.
            </p>
            <p className="text-body mb-3">
              Admin names and email addresses stay while someone is on the lab
              team, and are removed when they leave it.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">Who to ask</h2>
            <p className="text-body mb-3">
              Ahmadu Bello University, through the Department of Electrical
              Engineering, is responsible for this information. If you have a
              question about it, or you think something about you here is wrong,
              write to the lab team:
            </p>
            <div className="bg-bg-surface border border-border-rule rounded-sm p-4 mb-3">
              <span className="text-micro font-medium text-fg-muted uppercase tracking-caps block mb-1">
                ABU Smart Class lab team
              </span>
              <code className="text-data font-mono text-fg-default block">
                smartclass@example.invalid
              </code>
              <span className="text-caption text-fg-muted block mt-1">
                Placeholder address — the department replaces it with the real
                contact before launch.
              </span>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-h2 font-serif mb-2">Your rights</h2>
            <p className="text-body mb-3">
              Under Nigeria&apos;s data protection law you can ask what we hold
              about you, ask for it to be corrected, or ask for it to be
              deleted. For this site that would mean an admin&apos;s name and
              email address — there is nothing here about visitors to ask about.
              Write to the address above and the lab team will pass it on.
            </p>
          </section>

          <p className="text-caption text-fg-muted mt-8 pt-4 border-t border-border-rule">
            Written by the design team in plain words. Last drafted 13 October
            2026.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
