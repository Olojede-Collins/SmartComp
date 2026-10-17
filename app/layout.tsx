import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { SkipLink } from './_components/skip-link';
import './globals.css';

const fontSerif = localFont({
  src: [
    {
      path: './fonts/ebgaramond-500-latin.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/ebgaramond-600-latin.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-eb-garamond',
});

const fontSans = localFont({
  src: [
    {
      path: './fonts/ibm-plex-sans-400-latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ibm-plex-sans-500-latin.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/ibm-plex-sans-600-latin.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-plex-sans',
});

const fontMono = localFont({
  src: [
    {
      path: './fonts/ibm-plex-mono-400-latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ibm-plex-mono-600-latin.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-plex-mono',
});

export const metadata = {
  title: 'ABU Smart Class Inventory',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="bg-bg-page text-fg-default font-sans antialiased min-h-screen flex flex-col">
        <SkipLink href="#main" />
        {children}
      </body>
    </html>
  );
}
