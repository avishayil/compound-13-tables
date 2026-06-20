/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base נדרש כדי שהנתיבים יעבדו תחת GitHub Pages (https://<user>.github.io/compound-13-tables/)
export default defineConfig({
  plugins: [react()],
  base: '/compound-13-tables/',
  test: {
    globals: true,
    environment: 'node',
  },
});
