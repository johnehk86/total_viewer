import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // hwp.js imports Node's `fs`, which doesn't exist in the browser.
      fs: fileURLToPath(new URL('./src/empty.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
