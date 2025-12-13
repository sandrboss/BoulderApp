

import type { Metadata } from 'next';
import { Sora, Montagu_Slab } from 'next/font/google';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const montagu = Montagu_Slab({
  subsets: ['latin'],
  variable: '--font-montagu',
  display: 'swap',
});



import './globals.css';
import { NavBar } from '@/components/NavBar';


export const metadata: Metadata = {
  title: 'Boulder Log',
  description: 'Hidden progress tracker for indoor bouldering',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${montagu.variable}`}>
      <body
        className={`bg-slate-950 text-slate-50`}
      >
        <NavBar />
        <div className="pt-2">{children}</div>
      </body>
    </html>
  );
}
