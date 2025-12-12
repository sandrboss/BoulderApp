'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';


const links = [
  { href: '/', label: 'Today' },
  { href: '/session', label: 'Sessions' },
  { href: '/progress', label: 'Progress' },
  { href: '/profile', label: 'Gym' },
];


export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <div className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Boulder App Sander
        </div>
        <div className="flex gap-3 text-sm">
          {links.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'rounded-full px-3 py-1 transition',
                  isActive
                    ? 'bg-emerald-900 text-emerald-100'
                    : 'text-slate-400 hover:text-emerald-200 hover:bg-slate-900',
                ].join(' ')}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
