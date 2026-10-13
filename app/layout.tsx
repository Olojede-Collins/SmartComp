import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'ABU Smart Class Inventory',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
