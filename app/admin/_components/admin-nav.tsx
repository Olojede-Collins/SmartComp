'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HeaderRail } from '@/app/_components/header-rail';
import { signOut } from '@/lib/admin-auth';

export interface AdminNavProps {
  current?: string;
  children?: React.ReactNode;
  className?: string;
}

export function AdminNav({ current, children, className }: AdminNavProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button');
    if (button?.textContent?.trim() === 'Sign out') {
      e.preventDefault();
      signOut();
      router.push('/admin/login');
    }
  };

  return (
    <div onClick={handleClick}>
      <HeaderRail variant="admin" current={current} className={className}>
        {children}
      </HeaderRail>
    </div>
  );
}
