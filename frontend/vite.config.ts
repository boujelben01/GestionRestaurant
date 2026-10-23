/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'motion',
              test: /node_modules[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/,
            },
            {
              name: 'i18n',
              test: /node_modules[\/](i18next|react-i18next|i18next-browser-languagedetector)[\/]/,
            },
            { name: 'data', test: /node_modules[\/](@tanstack|axios)[\/]/ },
            {
              name: 'react',
              test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|react-helmet-async)[\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
