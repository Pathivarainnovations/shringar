import { defineConfig } from "vitest/config";
import path from "node:path";

// UI tests render the real pages in jsdom and talk to a real (temporary) backend - see tests/global-setup.ts.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.tsx"],
    env: { NEXT_PUBLIC_API_URL: "http://localhost:4177" },
    testTimeout: 20000,
    fileParallelism: false,
  },
});
