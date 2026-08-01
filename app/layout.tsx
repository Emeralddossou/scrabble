import type { Metadata, Viewport } from 'next';

import { PwaExperience } from '@/components/pwa-experience';

import './globals.css';
import './multiplayer.css';
import './account.css';

export const metadata: Metadata = {
  title: 'LexiForge — Scrabble français',
  description: 'Arène de Scrabble français moderne, rapide et résiliente.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'LexiForge', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101714',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="fr">
      <body>
        <PwaExperience />
        {children}
      </body>
    </html>
  );
}
