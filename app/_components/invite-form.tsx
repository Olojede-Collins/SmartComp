'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Field } from './field';
import { Input } from './input';
import { Button } from './button';
import { Banner } from './banner';

export type InviteFormState =
  'default' | 'sending' | 'invited' | 'invite-failed';

export interface InviteFormProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'onSubmit'
> {
  heading?: string;
  explanation?: string;
  state?: InviteFormState;
  defaultEmail?: string;
  invitedEmail?: string;
  onSubmit?: (email: string) => Promise<void> | void;
}

export function InviteForm({
  heading = 'Invite an administrator',
  explanation = 'They will get an email with a link to set their own password.',
  state: propState,
  defaultEmail = '',
  invitedEmail: propInvitedEmail,
  onSubmit,
  className,
  ...rest
}: InviteFormProps) {
  const [internalState, setInternalState] =
    React.useState<InviteFormState>('default');
  const [email, setEmail] = React.useState<string>(defaultEmail);
  const [recordedInvitedEmail, setRecordedInvitedEmail] =
    React.useState<string>(propInvitedEmail ?? '');
  const [deliveryError, setDeliveryError] = React.useState<string | null>(null);

  const effectiveState = propState ?? internalState;
  const isSending = effectiveState === 'sending';
  const effectiveInvitedEmail = propInvitedEmail ?? recordedInvitedEmail;
  const currentEmail =
    effectiveState === 'invited'
      ? ''
      : email || (effectiveState === 'invite-failed' ? defaultEmail : '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSending) return;

    if (onSubmit) {
      setInternalState('sending');
      setDeliveryError(null);
      try {
        await onSubmit(email);
        setRecordedInvitedEmail(email);
        setEmail('');
        setInternalState('invited');
      } catch (err: unknown) {
        console.error('Invite delivery error:', err);
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : null;
        setDeliveryError(msg);
        setInternalState('invite-failed');
      }
    }
  };

  return (
    <div className={cn('form-wrapper flex flex-col', className)}>
      {effectiveState === 'invited' ? (
        <div className="banner-slot mb-5">
          <Banner
            tone="success"
            role="status"
            heading="Invitation sent."
            dismissible
            onDismiss={() => setInternalState('default')}
          >
            A link is on its way to{' '}
            <span className="font-mono text-data text-fg-default">
              {effectiveInvitedEmail || 'the recipient'}
            </span>
            . It works once, and expires if unused.
          </Banner>
        </div>
      ) : null}

      {effectiveState === 'invite-failed' ? (
        <div className="banner-slot mb-5">
          <Banner
            tone="caution"
            role="alert"
            heading="The invitation did not send."
            faulty="Mail delivery failed."
            code="gmail-send-failed"
          >
            Nothing was recorded as sent. Try again in a moment.
            {deliveryError &&
            deliveryError !== 'Mail delivery failed.' &&
            deliveryError !== 'Failed to send invite email' ? (
              <span className="block mt-2 font-mono text-xs text-caution-fg break-all">
                {deliveryError}
              </span>
            ) : null}
          </Banner>
        </div>
      ) : null}

      <form
        id="invite"
        action="#"
        method="post"
        noValidate
        aria-busy={isSending ? 'true' : undefined}
        data-state={effectiveState}
        onSubmit={handleSubmit}
        className="form flex flex-col gap-5 border border-border-rule rounded-md bg-bg-surface p-5"
        {...rest}
      >
        <div aria-live="polite" className="sr-only">
          {isSending ? 'Sending invitation…' : ''}
        </div>
        <div className="form__block form__head pb-4 border-b border-border-rule flex flex-col gap-1">
          <h2 className="text-h2 font-sans font-medium text-fg-default m-0">
            {heading}
          </h2>
          <p className="text-body-small text-fg-muted m-0">{explanation}</p>
        </div>

        <div className="form__block">
          <Field label="EMAIL" required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="colleague@example.edu.ng"
                value={currentEmail}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={isSending}
                disabled={isSending}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              />
            )}
          </Field>
        </div>

        <div className="form__block pt-2">
          <Button
            type="submit"
            variant="default"
            pendingLabel={isSending ? 'Sending…' : undefined}
            disabled={isSending}
          >
            Send invite
          </Button>
        </div>
      </form>
    </div>
  );
}
