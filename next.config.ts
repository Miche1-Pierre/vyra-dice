import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // the floating dev badge sat on top of the dock; build and runtime errors still show
  devIndicators: false,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // venue bundles are not content-hashed: cache, but revalidate in the background
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=604800" },
        ],
      },
    ]
  },
}

export default nextConfig
