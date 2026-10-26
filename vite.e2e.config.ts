import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// This configuration is exclusively for disposable tests. Production does not import these adapters.
export default defineConfig({
  cacheDir: 'node_modules/.vite-e2e',
  plugins: [react(), tailwindcss()],
  resolve: { alias: {
    'firebase/firestore': fileURLToPath(new URL('./tests/fixtures/firestore.ts', import.meta.url)),
    'firebase/auth': fileURLToPath(new URL('./tests/fixtures/auth.ts', import.meta.url)),
  } },
  define: { 'process.env.GEMINI_API_KEY': '""', 'process.env.CUSTOM_GEMINI_API_KEY': '""', 'process.env.Gemini_API_Key1': '""' },
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
});
