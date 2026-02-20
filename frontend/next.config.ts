import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // Django backend URL
      },
    ];
  },
  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Set the workspace root to silence multiple lockfiles warning
    root: process.cwd(),
  },
  // Font optimization is handled by default in Next.js 13+
  // Configure headers for better caching and preloading
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
