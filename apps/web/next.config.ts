import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@alurichat/shared'],
  reactStrictMode: true,
};

export default nextConfig;
