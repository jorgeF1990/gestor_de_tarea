import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'chart.js', 'react-chartjs-2']
  },
  ssr: {
    noExternal: ['react-chartjs-2']
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:5001'
    }
  }
});

