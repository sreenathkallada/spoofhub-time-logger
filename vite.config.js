import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path of the deployed site.
//  - On GitHub Actions the repository name is used automatically, so the Pages URL
//    https://<user>.github.io/<repo>/ works without editing anything.
//  - Anywhere else (Netlify, Vercel, your own server, local dev) it is '/'.
//  - Set BASE_PATH to override either case, e.g. BASE_PATH=/ for a custom domain
//    or a <user>.github.io repository.
const repo = (process.env.GITHUB_REPOSITORY || '').split('/')[1];
const base = process.env.BASE_PATH || (process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/');

export default defineConfig({
  plugins: [react()],
  base,
  test: { environment: 'node' },
});
