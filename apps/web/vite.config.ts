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
          // Override Vite's default noisy error listener on the proxy instance
          process.nextTick(() => {
            proxy.removeAllListeners('error');
            proxy.on('error', (err: any, _req: any, res: any) => {
              if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
                if (res && typeof res.writeHead === 'function' && !res.headersSent) {
                  res.writeHead(503, {
                    'Content-Type': 'application/json',
                    'Retry-After': '1',
                  });
                  res.end(JSON.stringify({ error: 'API Server is initializing, please retry.' }));
                }
              } else {
                console.error('[vite proxy error]', err);
              }
            });
          });
        },
      },
    },
  },
});
