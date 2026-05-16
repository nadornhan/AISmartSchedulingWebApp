import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@todo-list/shared', '@todo-list/supabase'],
};

export default nextConfig;
