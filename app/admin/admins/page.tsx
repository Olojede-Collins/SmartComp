'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '../_components/admin-nav';
import { Footer } from '@/app/_components/footer';
import { Button } from '@/app/_components/button';
import { DataStrip } from '@/app/_components/data-strip';
import { EmptyState } from '@/app/_components/empty-state';
import { ErrorBanner } from '@/app/_components/error-banner';
import { InviteForm } from '@/app/_components/invite-form';
import {
  getAdmins,
  getPendingInvites,
  createInvite,
  deleteAdmin,
  deleteInvite,
  type AdminUser,
  type PendingInvite,
} from '@/lib/admin-api';
import { getSession, getToken } from '@/lib/admin-auth';

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

export default function AdminAdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = React.useState<AdminUser[]>([]);
  const [pendingInvites, setPendingInvites] = React.useState<PendingInvite[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const bannerRef = React.useRef<HTMLDivElement>(null);
  const [currentUserEmail] = React.useState<string | null>(
    () => getSession()?.user?.email || null,
  );
  const [currentUserId] = React.useState<string | null>(
    () => getSession()?.user?.id || null,
  );

  React.useEffect(() => {
    if (banner && bannerRef.current) {
      const heading = bannerRef.current.querySelector(
        'h3, [role="alert"] h3, h2, h1',
      );
      if (heading instanceof HTMLElement) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }, [banner]);

  React.useEffect(() => {
    let active = true;

    if (!getToken()) {
      router.push('/admin/login');
      return;
    }

    Promise.all([
      getAdmins().catch((e) => {
        if (
          e &&
          typeof e === 'object' &&
          'status' in e &&
          ((e as { status: number }).status === 401 ||
            (e as { status: number }).status === 403)
        ) {
          throw e;
        }
        return [];
      }),
      getPendingInvites().catch(() => []),
    ])
      .then(([adminsData, invitesData]) => {
        if (!active) return;
        if (Array.isArray(adminsData)) {
          setAdmins(adminsData);
        }
        if (Array.isArray(invitesData)) {
          setPendingInvites(invitesData);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoading(false);
        if (
          err &&
          typeof err === 'object' &&
          'status' in err &&
          ((err as { status: number }).status === 401 ||
            (err as { status: number }).status === 403)
        ) {
          router.push('/admin/login');
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleRemove = async (id: string) => {
    const list = Array.isArray(admins) ? admins : [];
    if (list.length <= 1) {
      setBanner('last-admin');
      return;
    }

    setRemovingId(id);
    try {
      await deleteAdmin(id);
      setAdmins((prev) =>
        Array.isArray(prev) ? prev.filter((a) => a.id !== id) : [],
      );
      setBanner(null);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'last-admin'
      ) {
        setBanner('last-admin');
      } else if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status: number }).status === 409
      ) {
        setBanner('last-admin');
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleInviteSubmit = async (email: string) => {
    await createInvite(email);
    try {
      const updated = await getPendingInvites();
      setPendingInvites(updated);
    } catch {
      setPendingInvites((prev) => [
        {
          id: crypto.randomUUID(),
          email,
          invited_by: currentUserEmail || 'Admin',
          created_at: new Date().toISOString(),
          status: 'pending',
        },
        ...prev,
      ]);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    setRevokingId(id);
    try {
      await deleteInvite(id);
      setPendingInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleFocusInvite = () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="email"], input[name="email"]',
    );
    if (input) {
      input.focus();
      input.scrollIntoView?.({ behavior: 'smooth' });
    }
  };

  const adminList = Array.isArray(admins) ? admins : [];

  return (
    <>
      <AdminNav current="/admin/admins" />

      <main
        id="main"
        className="flex-1 max-w-[var(--layout-containerMax)] mx-auto w-full px-[var(--layout-gutter)] py-8 md:py-10"
      >
        {banner === 'last-admin' ? (
          <div ref={bannerRef} className="mb-6">
            <ErrorBanner code="last-admin" />
          </div>
        ) : null}

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-2 max-w-[var(--layout-measure)]">
            <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 m-0">
              The Lab Team
            </h1>
            <p className="text-body text-fg-muted m-0">
              Everyone who can change the record. Any admin can invite another.
            </p>
          </div>

          <DataStrip
            pairs={[
              { key: 'ADMINS', value: adminList.length },
              { key: 'PENDING', value: pendingInvites.length },
            ]}
          />
        </div>

        {!loading && adminList.length === 1 ? (
          <div className="mb-8">
            <EmptyState
              heading="You are the only admin."
              body="No one else can change the record. Invite someone you trust so the register is never left without a keeper."
              action={
                <Button variant="default" onClick={handleFocusInvite}>
                  Invite an Admin
                </Button>
              }
            />
          </div>
        ) : null}

        <div className="overflow-x-auto mb-10 border border-border-rule rounded-md bg-bg-surface">
          <table
            className="w-full text-left border-collapse"
            role="table"
            aria-label="The Lab Team"
          >
            <caption className="sr-only">
              The Lab Team. Admins, in the order they joined.
            </caption>
            <thead>
              <tr className="border-b border-border-rule bg-bg-surface-sunken">
                <th
                  scope="col"
                  className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                >
                  EMAIL
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                >
                  JOINED
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {adminList.map((admin) => {
                const isCurrent =
                  (currentUserId && admin.id === currentUserId) ||
                  (currentUserEmail && admin.email === currentUserEmail);

                return (
                  <tr
                    key={admin.id}
                    className="border-b border-border-rule last:border-b-0 hover:bg-bg-row-hover"
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-data text-fg-default">
                          {admin.email}
                        </span>
                        {isCurrent ? (
                          <span className="inline-flex items-center text-micro font-medium px-1.5 py-0.5 rounded-sm border border-border-rule bg-bg-surface-sunken text-fg-muted">
                            YOU
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-data text-fg-default">
                      {formatDate(admin.created_at)}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {!isCurrent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${admin.email}`}
                          disabled={removingId === admin.id}
                          aria-busy={
                            removingId === admin.id ? 'true' : undefined
                          }
                          pendingLabel={
                            removingId === admin.id ? 'Removing…' : undefined
                          }
                          onClick={() => handleRemove(admin.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pendingInvites.length > 0 ? (
          <section className="mb-10" aria-labelledby="pending-invites-heading">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="pending-invites-heading"
                className="text-h2 tracking-h2 font-sans font-semibold text-neutral-900 m-0"
              >
                Pending Invitations
              </h2>
              <span className="text-micro font-medium tracking-caps px-2.5 py-0.5 rounded-full border border-border-rule bg-bg-surface-sunken text-fg-muted">
                {pendingInvites.length} Pending
              </span>
            </div>

            <div className="overflow-x-auto border border-border-rule rounded-md bg-bg-surface">
              <table
                className="w-full text-left border-collapse"
                role="table"
                aria-label="Pending Invitations"
              >
                <caption className="sr-only">
                  Pending administrator invitations awaiting acceptance.
                </caption>
                <thead>
                  <tr className="border-b border-border-rule bg-bg-surface-sunken">
                    <th
                      scope="col"
                      className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                    >
                      INVITEE EMAIL
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                    >
                      INVITED BY
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                    >
                      SENT
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-micro font-medium tracking-caps text-fg-muted"
                    >
                      STATUS
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-border-rule last:border-b-0 hover:bg-bg-row-hover"
                    >
                      <td className="px-4 py-3 align-middle font-mono text-data text-fg-default">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3 align-middle text-body-small text-fg-muted font-mono">
                        {inv.invited_by || 'Admin'}
                      </td>
                      <td className="px-4 py-3 align-middle font-mono text-data text-fg-default">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-micro font-medium border border-border-rule bg-bg-surface-sunken text-fg-muted">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Revoke invite for ${inv.email}`}
                          disabled={revokingId === inv.id}
                          aria-busy={revokingId === inv.id ? 'true' : undefined}
                          pendingLabel={
                            revokingId === inv.id ? 'Revoking…' : undefined
                          }
                          onClick={() => handleRevokeInvite(inv.id)}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section
          className="max-w-[var(--layout-measure)]"
          aria-labelledby="invite-heading"
        >
          <InviteForm
            heading="Invite Another Admin"
            explanation="They will get an email with a link to set their own password."
            onSubmit={handleInviteSubmit}
          />
        </section>
      </main>

      <Footer variant="admin" />
    </>
  );
}
