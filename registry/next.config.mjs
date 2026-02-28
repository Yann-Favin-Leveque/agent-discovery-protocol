/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — exclude from webpack bundling
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
