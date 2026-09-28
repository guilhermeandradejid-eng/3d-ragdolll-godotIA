import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (ex.: GitHub Pages).
  base: './',
  server: { host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
  },
});
