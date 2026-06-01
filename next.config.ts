import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray ~/package-lock.json otherwise confuses
  // Turbopack's multi-lockfile root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
