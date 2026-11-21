import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .env / .env.local live in the repository root
  envDir: '../..',
  server: { fs: { allow: ['../..'] } },
  build: { chunkSizeWarningLimit: 2500 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: { VITE_FIREBASE_PROJECT_ID: 'demo-test', VITE_FIREBASE_API_KEY: 'test', VITE_FIREBASE_USE_EMULATOR: 'false' },
  },
});
