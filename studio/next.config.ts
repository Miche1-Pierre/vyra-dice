import type { NextConfig } from "next"

/**
 * VYRA Studio — the private, local app that generates club experiences (VYR-62).
 * Runs next to the product app (`pnpm studio`, port 3300) and reuses its design system (../src).
 * Turbopack resolves ../src and ../clubs because the repo root (pnpm-lock.yaml) is its root.
 */
const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
