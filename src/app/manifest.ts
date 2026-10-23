import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eagles Drama Club Register',
    short_name: 'Eagles Register',
    description: 'The members-only register for Eagles Drama Club.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#064e3b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable_icon_x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
