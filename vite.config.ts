import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
  },
  resolve: {
    alias: [
      { find: '@', replacement: '/src' }
    ]
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure service worker is in the root
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});