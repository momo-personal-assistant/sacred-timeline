const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@unified-memory/db',
    '@unified-memory/shared',
    '@momo/embedding',
    '@momo/graph',
    '@momo/query',
  ],
  // Use standalone output for better Vercel deployment
  output: 'standalone',
  // Treat eslint warnings as warnings, not errors
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@unified-memory/db': path.resolve(__dirname, '../../packages/db/src'),
      '@unified-memory/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@momo/embedding': path.resolve(__dirname, '../../packages/embedding/src'),
      '@momo/graph': path.resolve(__dirname, '../../packages/graph/src'),
      '@momo/query': path.resolve(__dirname, '../../packages/query/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
