import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
      },
      server: {
        proxy: {
          // 1. ClinGen Synthesizer Backend (running on Port 8001 to avoid clash)
          '/api/patients': 'http://localhost:8001',
          '/api/metadata': 'http://localhost:8001',
          '/api/patient': 'http://localhost:8001',

          // 2. Questionnaire Tailoring Suite Backend (running on Port 8000)
          '/api': 'http://localhost:8000',
          '/api-proxy': 'http://localhost:8000',
          '/ws-proxy': {target: 'ws://localhost:8000', ws: true},
        },
      },
      plugins: react(),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
