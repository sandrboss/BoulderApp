import type { Metadata, Viewport } from 'next';
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

/**
 * Page / App metadata
 * (title, icons, PWA config)
 */
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  title: 'Claimb',
  description: 'Hidden progress tracker for indoor bouldering',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default', // dark icons on light status bar (Safari A2HS)
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

/**
 * Viewport config
 * (Chrome top bar color, color scheme)
 */
export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${montagu.variable}`}>
      <head>
        {/* iOS PWA helpers (Safari only, Chrome iOS ignores some) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Claimb" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>

      {/* 
        IMPORTANT:
        - html background should be light so Chrome iOS / overscroll areas are white
        - body can stay dark for your app UI
      */}
      <body className="bg-slate-950 text-slate-50">
        <NavBar />
        <div className="pt-2">{children}</div>
      </body>
    </html>
  );
}
