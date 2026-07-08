import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'hls':          ['hls.js'],
          'dompurify':    ['dompurify'],
          'capacitor':    ['@capacitor/core', '@capacitor/app', '@capacitor/haptics', '@capacitor/status-bar'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  },
})
