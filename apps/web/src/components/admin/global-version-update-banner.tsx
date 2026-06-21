'use client';

import { usePathname } from 'next/navigation';
import { VersionUpdateBanner } from '@/components/admin/version-update-banner';

export function GlobalVersionUpdateBanner() {
  const pathname = usePathname();
  const normalizedPathname = pathname?.replace(/\/$/, '') ?? '';
  const isAdminDashboard = normalizedPathname === '/admin' || normalizedPathname.endsWith('/admin');

  // The admin dashboard owns its in-page banner so it can switch tabs without a
  // full navigation and hide the banner while the Updates panel is already open.
  if (isAdminDashboard) return null;

  return <VersionUpdateBanner className="mx-3 mt-3 md:mx-6" />;
}
