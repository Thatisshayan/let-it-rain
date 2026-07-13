import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Only the web app's tests. The mobile package has its own vitest config and
    // CI job; globbing into mobile/ from the root fails in CI because mobile's
    // deps (and its tsconfig's `expo` base) aren't installed for the web job.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "mobile/**"],
  },
});
