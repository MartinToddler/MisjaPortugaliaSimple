import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Misja Portugalia',
        short_name: 'Misja PT',
        description: 'Rodzinna gra wakacyjna: misje, punkty i wspólny cel wyprawy',
        lang: 'pl',
        start_url: '/',
        display: 'standalone',
        background_color: '#fffbeb',
        theme_color: '#1d4ed8',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // żądania do Supabase nigdy nie mają trafiać w fallback nawigacji SPA
        navigateFallbackDenylist: [/^\/rest\//, /^\/storage\//, /^\/auth\//],
      },
    }),
  ],
})
