'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

/**
 * Mobile disclosure menu for the marketing nav (hidden at lg and up, where the
 * inline anchor links take over). Small client island: open/close state,
 * Escape to dismiss, links close on tap.
 */
export function MobileMenu({ items }: { items: ReadonlyArray<{ label: string; href: string }> }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="marketing-mobile-menu"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        className="ease-snap inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[var(--landing-border-strong)] text-[var(--landing-text)] transition-all duration-150 hover:bg-[var(--landing-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Menu className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="marketing-mobile-menu"
          className="absolute inset-x-0 top-14 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)] shadow-lg lg:hidden"
        >
          <div className="mx-auto flex w-full max-w-screen-xl flex-col px-4 py-3 sm:px-8">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-[14px] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:bg-[var(--landing-bg-elevated)] hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/auth/signin"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md border-t border-[var(--landing-border)] px-3 pb-2.5 pt-3.5 text-[14px] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:bg-[var(--landing-bg-elevated)] hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] md:hidden"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
