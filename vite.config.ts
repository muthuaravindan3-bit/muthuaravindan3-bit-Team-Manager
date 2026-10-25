import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ""),
      'process.env.CUSTOM_GEMINI_API_KEY': JSON.stringify(env.CUSTOM_GEMINI_API_KEY || ""),
      'process.env.Gemini_API_Key1': JSON.stringify(env.Gemini_API_Key1 || ""),
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'date-fns',
        'date-fns-tz',
        'lucide-react',
        'leaflet',
        'recharts',
        'react-markdown',
        'remark-gfm',
        'xlsx',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : { port: (Number(process.env.PORT) || 3000) + 1 },
    },
  };
});
