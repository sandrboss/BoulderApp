

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NavBar } from '@/components/NavBar';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="de">
      <body
        className={`${inter.className} bg-slate-950 text-slate-50`}
      >
        <NavBar />
        <div className="pt-2">{children}</div>
      </body>
    </html>
  );
}
