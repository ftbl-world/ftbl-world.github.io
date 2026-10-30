import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

const OUT_DIR = 'build';

/**
 * GitHub Pages has no SPA rewrite, so opening a shared link such as
 * /match/eng.1/401879254 is a plain miss. Serving the app shell as the 404 page
 * hands the request to the router with the original URL still intact.
 */
const spaFallback = (): Plugin => ({
  name: 'spa-404-fallback',
  closeBundle() {
    copyFileSync(resolve(OUT_DIR, 'index.html'), resolve(OUT_DIR, '404.html'));
  },
});

export default defineConfig({
  plugins: [react(), spaFallback()],
  build: {
    outDir: OUT_DIR,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    css: false,
  },
});
