import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('exceljs') || id.includes('xlsx') || id.includes('fast-csv')) {
              return 'vendor-excel';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            return 'vendor-core'; // other third-party dependencies
          }
        }
      }
    }
  }
})