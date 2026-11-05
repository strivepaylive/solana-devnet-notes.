import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/launchlab/',
  plugins: [nodePolyfills({ globals: { Buffer: true, process: true } })],
  build: {
    target: 'es2022',
    outDir: '../public/launchlab',
    emptyOutDir: true
  }
});
