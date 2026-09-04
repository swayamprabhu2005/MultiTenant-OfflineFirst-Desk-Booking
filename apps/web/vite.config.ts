import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if ((err as any).code === 'ECONNREFUSED') {
              if (res && typeof (res as any).writeHead === 'function' && !(res as any).headersSent) {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API Server is initializing, please retry.' }));
              }
            }
          });
        },
      },
    },
  },
});
