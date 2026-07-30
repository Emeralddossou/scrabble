import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'LexiForge',
    short_name: 'LexiForge',
    description: 'Le Scrabble français tactique, pour une partie rapide où que vous soyez.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    background_color: '#0b100e',
    theme_color: '#101714',
    categories: ['games', 'word', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Partie rapide',
        short_name: 'Partie rapide',
        description: 'Lancer une partie contre l’IA',
        url: '/dashboard?quick=solo',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Mon profil',
        short_name: 'Profil',
        description: 'Ouvrir les réglages de votre compte',
        url: '/profile',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
