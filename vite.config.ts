import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seoContent } from './seo-plugin.ts';

// Relative base so the same build works on jglobo.github.io and in preview hosts.
export default defineConfig({
  base: './',
  plugins: [react(), seoContent()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // three.js + R3F in one cacheable vendor chunk, loaded only on "Enter portfolio".
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [{ name: 'three-vendor', test: /node_modules[\\/](three|@react-three|three-stdlib)/ }],
        },
      },
    },
  },
});
