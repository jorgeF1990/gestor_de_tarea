import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@context': path.resolve(__dirname, './src/context'),
      '@layout': path.resolve(__dirname, './src/layout'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'chart.js', 'react-chartjs-2']
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/tickets': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/calendar': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          calendar: ['react-big-calendar']
        }
      }
    }
  }
}));