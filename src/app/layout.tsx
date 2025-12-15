import type { Metadata } from 'next';
import { Sora, Montagu_Slab } from 'next/font/google';

import './globals.css';
import { NavBar } from '@/components/NavBar';

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

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  title: 'Claimb',
  description: 'Hidden progress tracker for indoor bouldering',
  themeColor: '#ffffff',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default', // dark icons/text on light bar
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${montagu.variable}`}>
      <head>
        {/* iOS PWA icon + status bar style (most reliable) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#ffffff" />
      </head>

      <body className="bg-white text-slate-50">
        <NavBar />
        <div className="pt-2">{children}</div>
      </body>
    </html>
  );
}
