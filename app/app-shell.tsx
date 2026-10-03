'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import SocialNav from './social-nav';
import DesktopHeader from './desktop-header';

const routes = [
  '/fil',
  '/messages',
  '/amis',
  '/communities',
  '/parametres',
  '/apparence',
  '/mes-donnees',
  '/appel',
  '/salle',
];

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (!routes.some((route) => path === route || path.startsWith(route + '/'))) {
    return children;
  }
  return (
    <div className="luma-shell">
      <DesktopHeader />
      <SocialNav />
      <div className="luma-page">{children}</div>
    </div>
  );
}
