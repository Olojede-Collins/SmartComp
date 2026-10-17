'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field } from '@/app/_components/field';
import { Input } from '@/app/_components/input';
import { Button } from '@/app/_components/button';
import { ErrorBanner } from '@/app/_components/error-banner';
import { FieldKey } from '@/app/_components/field-key';
import { acceptInvite, ApiError } from '@/lib/admin-api';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const email = searchParams?.get('email') || 'new.admin@example.invalid';

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<
    string | undefined
  >();
  const [confirmError, setConfirmError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(() => {
    if (!token) {
      return 'unknown-token';
    }
    return null;
  });

  const bannerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (errorCode && bannerRef.current) {
      const heading = bannerRef.current.querySelector(
        'h3, [role="alert"] h3, h2, h1',
      );
      if (heading instanceof HTMLElement) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }, [errorCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setPasswordError(undefined);
    setConfirmError(undefined);

    if (!token) {
      setErrorCode('unknown-token');
      return;
    }

    if (password.length < 8) {
      setErrorCode('weak-password');
      setPasswordError('Use at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError('Type the same password again.');
      return;
    }

    setSubmitting(true);
    setErrorCode(null);

    try {
      await acceptInvite(token);
      router.push('/admin/login?invite=accepted');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.code === 'unknown-token') {
          setErrorCode('unknown-token');
        } else if (err.status === 409 || err.code === 'already-accepted') {
          setErrorCode('already-accepted');
        } else if (err.code === 'weak-password') {
          setErrorCode('weak-password');
          setPasswordError('Use at least 8 characters.');
        } else {
          setErrorCode(err.code || 'unknown-token');
        }
      } else {
        setErrorCode('unknown-token');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = Boolean(
    errorCode &&
    (errorCode === 'already-accepted' || errorCode === 'unknown-token'),
  );

  return (
    <>
      <main
        id="main"
        className="min-h-screen bg-bg-page flex flex-col justify-center items-center px-[var(--layout-gutter)] py-8 md:py-12"
      >
        <div className="w-full max-w-[var(--layout-measure)] flex flex-col gap-6">
          <p className="text-caption text-fg-muted m-0">ABU Smart Class</p>

          {errorCode ? (
            <div ref={bannerRef} className="banner-slot">
              <ErrorBanner code={errorCode} />
            </div>
          ) : null}

          <div className="apple-card bg-bg-surface border border-border-rule rounded-md overflow-hidden">
            <div className="border-b border-border-rule px-6 py-5 flex flex-col gap-2">
              <FieldKey>INVITATION</FieldKey>
              <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 m-0">
                Accept your invitation
              </h1>
              <p className="text-body text-fg-muted m-0">
                You were invited to help keep the lab team&rsquo;s record.
                Choose a password to finish.
              </p>
            </div>

            <div className="border-b border-border-rule px-6 py-5">
              <div className="flex flex-col gap-2 min-w-0">
                <FieldKey>INVITED EMAIL</FieldKey>
                <span className="font-mono text-data text-fg-default break-all">
                  {email}
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-busy={submitting ? 'true' : undefined}
            >
              <div aria-live="polite" className="sr-only">
                {submitting ? 'Accepting invitation…' : ''}
              </div>
              <div className="border-b border-border-rule px-6 py-5 flex flex-col gap-5">
                <Field
                  label="PASSWORD"
                  required
                  help={
                    passwordError
                      ? undefined
                      : 'At least 8 characters. Longer is better.'
                  }
                  error={passwordError}
                  disabled={submitting}
                >
                  {({ id, describedBy, invalid, disabled }) => (
                    <Input
                      id={id}
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      disabled={disabled}
                      readOnly={submitting}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(undefined);
                      }}
                    />
                  )}
                </Field>

                <Field
                  label="CONFIRM PASSWORD"
                  required
                  help={
                    confirmError ? undefined : 'Type the same password again.'
                  }
                  error={confirmError}
                  disabled={submitting}
                >
                  {({ id, describedBy, invalid, disabled }) => (
                    <Input
                      id={id}
                      type="password"
                      name="confirm_password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      disabled={disabled}
                      readOnly={submitting}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setConfirmError(undefined);
                      }}
                    />
                  )}
                </Field>
              </div>

              <div className="px-6 py-5 flex flex-wrap items-center gap-4">
                <Button
                  type="submit"
                  variant="default"
                  disabled={submitting || isLocked}
                  pendingLabel={submitting ? 'Accepting…' : undefined}
                >
                  Accept invitation
                </Button>
                <Link
                  href="/room"
                  className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-md border border-border-strong text-body text-fg-default hover:bg-bg-action-subtle hover:text-fg-link-hover active:scale-[0.98]"
                >
                  Back to the collection
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <React.Suspense fallback={null}>
      <AcceptInviteForm />
    </React.Suspense>
  );
}
