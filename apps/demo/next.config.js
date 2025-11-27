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
    };
    return config;
  },
};

module.exports = nextConfig;
