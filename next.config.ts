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
        // unversioned club files (clubs/<slug>/public): cache briefly, revalidate in the background
        source: "/clubs/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=604800" },
        ],
      },
      {
        // ?v=<content hash> (assets:optimize): a new bake gets a new URL, so cache forever
        source: "/clubs/:path*",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]
  },
}

export default nextConfig
