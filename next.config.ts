import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: ["@mozilla/readability", "ollama"],
  },
};

export default nextConfig;
