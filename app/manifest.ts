import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LexiForge',
    short_name: 'LexiForge',
    description: 'Scrabble français en ligne.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b100e',
    theme_color: '#101714',
    icons: [],
  };
}
