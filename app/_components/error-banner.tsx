import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

export type ErrorTone = 'error' | 'caution';

export interface ErrorPreset {
  tone: ErrorTone;
  heading: string;
  body?: string;
  faulty?: string;
}

export const ERROR_PRESETS: Record<string, ErrorPreset> = {
  'condition-enum-invalid': {
    tone: 'error',
    heading: 'That condition is not on the list.',
    body: 'Nothing was saved. Choose one of the four recorded states and save again.',
  },
  'invalid-condition': {
    tone: 'error',
    heading: 'That condition is not on the list.',
    body: 'Nothing was saved. Choose one of the four recorded states and save again.',
  },
  'inventory-ceiling': {
    tone: 'error',
    heading: 'The register cannot hold more than 15 items.',
    body: 'The register is full. Remove an item before adding another.',
  },
  'file-too-large': {
    tone: 'caution',
    heading: 'That photograph is too large.',
    body: 'Photographs must be 8 MB or smaller. Nothing was saved.',
  },
  'image-too-large': {
    tone: 'caution',
    heading: 'That photograph is too large.',
    body: 'Photographs must be 8 MB or smaller. Nothing was saved.',
  },
  'image-oversize': {
    tone: 'caution',
    heading: 'That photograph is too large.',
    body: 'Photographs must be 8 MB or smaller. Nothing was saved.',
  },
  'unsupported-media-type': {
    tone: 'caution',
    heading: 'That file type is not accepted.',
    body: 'Photographs must be JPEG, PNG, WebP or AVIF. Nothing was saved.',
  },
  'mime-rejected': {
    tone: 'caution',
    heading: 'That file type is not accepted.',
    body: 'Photographs must be JPEG, PNG, WebP or AVIF. Nothing was saved.',
  },
  'image-type': {
    tone: 'caution',
    heading: 'That file type is not accepted.',
    body: 'Photographs must be JPEG, PNG, WebP or AVIF. Nothing was saved.',
  },
  'email-delivery-failed': {
    tone: 'caution',
    heading: 'The invitation did not send.',
    body: 'Nothing was recorded as sent. Try again in a moment.',
    faulty: 'Mail delivery failed.',
  },
  'gmail-send-failed': {
    tone: 'caution',
    heading: 'The invitation did not send.',
    body: 'Nothing was recorded as sent. Try again in a moment.',
    faulty: 'Mail delivery failed.',
  },
  'email-failed': {
    tone: 'caution',
    heading: 'The invitation did not send.',
    body: 'Nothing was recorded as sent. Try again in a moment.',
    faulty: 'Mail delivery failed.',
  },
  'last-admin': {
    tone: 'error',
    heading: 'That admin cannot be removed.',
    body: 'You are the last admin on the record. Invite someone else first, then remove.',
  },
  'last-admin-blocked': {
    tone: 'error',
    heading: 'That admin cannot be removed.',
    body: 'You are the last admin on the record. Invite someone else first, then remove.',
  },
  'item-not-found': {
    tone: 'error',
    heading: 'That item is already gone.',
    body: 'Someone else deleted this item, or it was removed earlier. Nothing was changed just now. The register below is up to date.',
  },
  'not-found': {
    tone: 'error',
    heading: 'That item is already gone.',
    body: 'Someone else deleted this item, or it was removed earlier. Nothing was changed just now. The register below is up to date.',
  },
  'admin-unauthorized': {
    tone: 'error',
    heading: 'You do not have administrator permissions.',
    body: 'You must be signed in as an administrator to change the record.',
  },
  forbidden: {
    tone: 'error',
    heading: 'You do not have administrator permissions.',
    body: 'You must be signed in as an administrator to change the record.',
  },
  'export-generation-failed': {
    tone: 'error',
    heading: 'The file could not be created.',
    body: 'Nothing was downloaded and nothing on the register was changed. If you were signed out, sign in again and try once more. Otherwise try again in a moment, and tell the lab team if it keeps happening.',
  },
  'export-failed': {
    tone: 'error',
    heading: 'The file could not be created.',
    body: 'Nothing was downloaded and nothing on the register was changed. If you were signed out, sign in again and try once more. Otherwise try again in a moment, and tell the lab team if it keeps happening.',
  },
  'cold-start-timeout': {
    tone: 'error',
    heading: 'The register took too long to start.',
    body: 'The first run did not finish. Try again in a moment, and tell the lab team if it keeps happening.',
  },
  'invalid-credentials': {
    tone: 'error',
    heading: 'That email and password do not match.',
    body: 'Check both and try again. Five failed tries lock sign-in for a short while.',
  },
  'invite-expired': {
    tone: 'error',
    heading: 'That invitation has expired.',
    body: 'Ask a lab team admin to send a new one. Nothing on the record has changed.',
  },
  'already-accepted': {
    tone: 'error',
    heading: 'That invitation has already been used.',
    body: 'This link was accepted before. Sign in instead, or ask a lab team admin for a new invitation.',
  },
  'unknown-token': {
    tone: 'error',
    heading: 'That invitation link is not valid.',
    body: 'Copy the link from the email again, or ask a lab team admin to send a new one.',
  },
  'weak-password': {
    tone: 'error',
    heading: 'That password is too weak.',
    body: 'Nothing was saved. Use at least 8 characters, with a mix of letters and numbers.',
  },
};

export interface ErrorBannerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  code: string;
  tone?: ErrorTone;
  heading?: React.ReactNode;
  body?: React.ReactNode;
  faulty?: React.ReactNode;
  children?: React.ReactNode;
}

export function ErrorBanner({
  code,
  tone: propTone,
  heading: propHeading,
  body: propBody,
  faulty: propFaulty,
  children,
  className,
  ...rest
}: ErrorBannerProps) {
  const preset = Object.hasOwn(ERROR_PRESETS, code)
    ? ERROR_PRESETS[code]
    : undefined;
  const tone = propTone ?? preset?.tone ?? 'error';
  const heading = propHeading ?? preset?.heading ?? code;
  const body = propBody ?? children ?? preset?.body;
  const faulty = propFaulty ?? preset?.faulty;

  const isCaution = tone === 'caution';

  return (
    <div
      role="alert"
      className={cn(
        'banner flex items-start gap-3 px-5 py-4 rounded-md border',
        isCaution
          ? 'bg-bg-banner-warn border-border-warn'
          : 'banner--error bg-bg-surface border-border-error',
        className,
      )}
      {...rest}
    >
      <Icon
        name={isCaution ? 'alert-banner' : 'triangle-alert'}
        size={20}
        className={cn(
          'shrink-0 mt-0.5',
          isCaution ? 'text-fg-stamp' : 'text-fg-status-faulty',
        )}
      />
      <div className="banner__body flex flex-1 min-w-0 flex-col gap-2">
        <h3
          className={cn(
            'text-h3',
            isCaution ? 'text-fg-stamp' : 'text-fg-status-faulty',
          )}
        >
          {heading}
        </h3>
        <div className="banner__code font-mono text-data text-fg-muted">
          {code}
        </div>
        {body ? (
          <p className="text-body-small text-fg-default">{body}</p>
        ) : null}
        {faulty ? (
          <p className="faulty text-body-small text-fg-status-faulty">
            {faulty}
          </p>
        ) : null}
      </div>
    </div>
  );
}
