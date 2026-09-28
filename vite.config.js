import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (ex.: GitHub Pages).
  base: './',
  server: { host: true },
  build: {
    target: 'es2022',
    // o Rapier embute o WASM (~2 MB) no próprio módulo JS
    chunkSizeWarningLimit: 4800,
    rolldownOptions: {
      output: {
        // bibliotecas em arquivos separados: melhor cache entre versões do jogo
        codeSplitting: {
          groups: [
            { name: 'rapier', test: /node_modules[\\/]@dimforge/ },
            { name: 'three', test: /node_modules[\\/]three/ },
          ],
        },
      },
    },
  },
});
