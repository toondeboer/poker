import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the shared TypeScript package (@poker/core) from source.
  transpilePackages: ["@poker/core"],
};

export default nextConfig;
