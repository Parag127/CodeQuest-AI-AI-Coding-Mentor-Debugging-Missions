import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true, // Necessary for file changes inside Docker containers on Windows/WSL2
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || (process.env.DOCKER_ENV ? 'http://backend:5000' : 'http://localhost:5000'),
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
