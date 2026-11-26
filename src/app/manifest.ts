import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eagles Drama Club Management System',
    short_name: 'Eagles Management',
    description: 'The management system for Eagles Drama Club.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F4EC',
    theme_color: '#0B1F4B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable_icon_x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
