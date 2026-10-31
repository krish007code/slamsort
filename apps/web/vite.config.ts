import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep Vite away from private root/application environment files.
  envDir: fileURLToPath(new URL('./env-public', import.meta.url)),
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.SLAMSORT_API_ORIGIN ?? 'http://127.0.0.1:8080',
    },
  },
});
