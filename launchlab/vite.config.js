import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Vercel preview serves this app at /. Cloudflare serves it at /launchlab/.
const onVercel = process.env.VERCEL === '1';
export default defineConfig({
  base: onVercel ? '/' : '/launchlab/',
  plugins: [nodePolyfills({ globals: { Buffer: true, process: true } })],
  build: {
    target: 'es2022',
    outDir: onVercel ? 'dist' : '../public/launchlab',
    emptyOutDir: true
  }
});
