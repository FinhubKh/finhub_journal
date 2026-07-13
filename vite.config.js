import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { marketDevApiPlugin } from './vite-market-api.mjs'
import { aiDevApiPlugin } from './vite-ai-api.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), marketDevApiPlugin(), aiDevApiPlugin()],
})
