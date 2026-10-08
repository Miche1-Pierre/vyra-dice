import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // react-three-fiber: the render loop (useFrame) mutates three.js objects created once with
    // useMemo/useRef — that's the intended R3F model (no React state per frame). The React
    // Compiler immutability rule doesn't know about it.
    files: ["src/components/scene/**/*.{ts,tsx}"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "studio/.next/**",
    "studio/next-env.d.ts",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Club web bundles (generated 3D assets), copied to public/clubs by assets:sync
    "clubs/*/public/**",
    "public/clubs/**",
  ]),
])

export default eslintConfig
