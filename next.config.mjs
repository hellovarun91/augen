/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
