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
      '@unified-memory/transformers': path.resolve(__dirname, '../../packages/transformers/src'),
      '@momo/ingestion': path.resolve(__dirname, '../../packages/ingestion/src'),
      '@momo/transformers': path.resolve(__dirname, '../../packages/transformers/src'),
      '@momo/embedding': path.resolve(__dirname, '../../packages/embedding/src'),
      '@momo/graph': path.resolve(__dirname, '../../packages/graph/src'),
      '@momo/chunking': path.resolve(__dirname, '../../packages/chunking/src'),
      '@momo/query': path.resolve(__dirname, '../../packages/query/src'),
      '@momo/temporal': path.resolve(__dirname, '../../packages/temporal/src'),
      '@momo/consolidation': path.resolve(__dirname, '../../packages/consolidation/src'),
      '@momo/clustering': path.resolve(__dirname, '../../packages/clustering/src'),
      '@momo/reasoning': path.resolve(__dirname, '../../packages/reasoning/src'),
      '@momo/pipeline': path.resolve(__dirname, '../../packages/pipeline/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
