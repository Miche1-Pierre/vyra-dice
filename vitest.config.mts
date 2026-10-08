import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@clubs": fileURLToPath(new URL("./clubs", import.meta.url)),
      "@studio": fileURLToPath(new URL("./studio", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "clubs/**/*.test.ts", "studio/**/*.test.ts"],
    passWithNoTests: true,
  },
})
