import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5401,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BFF_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
