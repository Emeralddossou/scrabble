import type { Metadata, Viewport } from 'next';

import { ServiceWorker } from '@/components/service-worker';

import './globals.css';
import './multiplayer.css';
import './account.css';

export const metadata: Metadata = {
  title: 'LexiForge — Scrabble français',
  description: 'Arène de Scrabble français moderne, rapide et résiliente.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101714' };

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="fr">
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
