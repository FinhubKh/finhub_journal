import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { marketDevApiPlugin } from './vite-market-api.mjs'
import { aiDevApiPlugin } from './vite-ai-api.mjs'
import { bridgeDevApiPlugin } from './vite-bridge-api.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), marketDevApiPlugin(), aiDevApiPlugin(), bridgeDevApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/chart.js')) return 'chart';
          if (id.includes('node_modules/react-router')) return 'router';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react';
          if (id.includes('node_modules/react-toastify')) return 'toast';
        },
      },
    },
  },
})
