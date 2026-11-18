import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Vercel restores `.next/cache` between deployments and a restored Turbopack
    // cache served a stale `globals.css` (Tailwind loader output) in production:
    // new pages with old theme tokens. Builds stay correct and only a few seconds
    // slower without it.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
