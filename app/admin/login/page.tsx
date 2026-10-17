'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field } from '@/app/_components/field';
import { Input } from '@/app/_components/input';
import { Button } from '@/app/_components/button';
import { ErrorBanner } from '@/app/_components/error-banner';
import { FieldKey } from '@/app/_components/field-key';
import { signInWithPassword, AuthError } from '@/lib/admin-auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(() => {
    if (searchParams?.get('error') === 'invite-expired') {
      return 'invite-expired';
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

    setSubmitting(true);
    setErrorCode(null);

    try {
      await signInWithPassword(email, password);
      router.push('/admin');
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setErrorCode(err.code || 'invalid-credentials');
      } else {
        setErrorCode('invalid-credentials');
      }
    } finally {
      setSubmitting(false);
    }
  };

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

          <div className="flex flex-col gap-2">
            <div>
              <FieldKey>ADMIN</FieldKey>
            </div>
            <h1 className="text-h1 tracking-h1 font-sans font-bold text-neutral-900 m-0">
              Sign in
            </h1>
            <p className="text-body text-fg-muted m-0">
              For lab team admins. The public collection needs no account.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-busy={submitting ? 'true' : undefined}
            className="flex flex-col gap-5"
          >
            <div aria-live="polite" className="sr-only">
              {submitting ? 'Signing in…' : ''}
            </div>
            <Field
              label="EMAIL"
              required
              help="The address a lab team admin invited."
              disabled={submitting}
            >
              {({ id, describedBy, invalid, disabled }) => (
                <Input
                  id={id}
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={disabled}
                  readOnly={submitting}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field label="PASSWORD" required disabled={submitting}>
              {({ id, describedBy, invalid, disabled }) => (
                <Input
                  id={id}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  disabled={disabled}
                  readOnly={submitting}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Button
                type="submit"
                variant="default"
                disabled={submitting}
                pendingLabel={submitting ? 'Signing in…' : undefined}
              >
                Sign in
              </Button>
              <Link
                href="/room"
                className="text-body-small text-fg-link hover:underline min-h-11 inline-flex items-center px-1"
              >
                Back to the collection
              </Link>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
