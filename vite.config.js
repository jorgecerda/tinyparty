import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
