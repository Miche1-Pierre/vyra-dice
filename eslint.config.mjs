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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / binary 3D assets
    "public/models/**",
  ]),
])

export default eslintConfig
