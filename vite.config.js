import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset URLs, so a build runs from any subdirectory or static host
  base: './',
  server: {
    port: 5188,
    host: '127.0.0.1',
    open: false,
  },
  preview: {
    port: 5189,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    // three.js is one big chunk on purpose
    chunkSizeWarningLimit: 1600,
  },
});
