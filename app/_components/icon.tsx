import * as React from 'react';
import { cn } from '@/lib/utils';

export type IconName =
  | 'circle-solid'
  | 'triangle-alert'
  | 'spanner'
  | 'minus-circle'
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'image-off'
  | 'download'
  | 'trash'
  | 'alert-banner'
  | 'empty-register';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const PATHS: Record<IconName, React.ReactNode> = {
  'circle-solid': <circle cx="10" cy="10" r="4.25" fill="currentColor" />,
  'triangle-alert': (
    <>
      <path
        d="M10 3.6 2.7 16.2h14.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 8.2v3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M10 13.8h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  spanner: (
    <>
      <path
        d="M13.9 4.6a3.6 3.6 0 0 0-4.5 4.5L4.2 14.3a1.7 1.7 0 0 0 2.4 2.4l5.2-5.2a3.6 3.6 0 0 0 4.5-4.5l-2.3 2.3-2.1-.5-.5-2.1 2.5-2.1Z"
        {...STROKE}
      />
    </>
  ),
  'minus-circle': (
    <>
      <circle
        cx="10"
        cy="10"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M7 10h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  plus: (
    <path
      d="M10 4.2v11.6M4.2 10h11.6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  ),
  'chevron-left': (
    <path
      d="M12.2 4.4 6.6 10l5.6 5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'chevron-right': (
    <path
      d="M7.8 4.4 13.4 10l-5.6 5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'image-off': (
    <>
      <rect
        x="2.8"
        y="4.2"
        width="14.4"
        height="11.6"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M2.8 13.4 7.2 9.6l3.2 2.6 2.4-1.8 4.4 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.2 2.8 16.8 17.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  download: (
    <>
      <path
        d="M10 3.2v9.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M6.4 9.2 10 12.8 13.6 9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.6 14.4v1.2c0 .6.5 1.2 1.2 1.2h10.4c.7 0 1.2-.6 1.2-1.2v-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  trash: (
    <>
      <path d="M4.2 5.8h11.6" {...STROKE} />
      <path d="M8.2 5.8V4.4c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v1.4" {...STROKE} />
      <path
        d="M5.8 5.8l.7 10.2c0 .6.5 1.1 1.1 1.1h4.8c.6 0 1.1-.5 1.1-1.1l.7-10.2"
        {...STROKE}
      />
      <path d="M8.6 8.8v5M11.4 8.8v5" {...STROKE} />
    </>
  ),
  'alert-banner': (
    <>
      <circle
        cx="10"
        cy="10"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M10 6.6v4.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M10 13.6h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  'empty-register': (
    <>
      <path
        d="M5 3.2h10v13.6l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 7h5.2M7.4 10h5.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
};

export interface IconProps extends Omit<
  React.SVGProps<SVGSVGElement>,
  'name' | 'children'
> {
  name: IconName;
  size?: 20 | 16;
}

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  const sizeClass = size === 16 ? 'size-4' : 'size-5';
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={cn(sizeClass, className)}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
