import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: '/' works for Netlify, Vercel, Cloudflare Pages and a server web root.
// For GitHub Pages set base to '/<repo-name>/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  test: { environment: 'node' },
});
