import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Plain CommonJS Node scripts, not part of the TS/ESM app build.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Tests routinely cast vi.fn() mocks (e.g. `(prisma.user.findUnique as any).mockResolvedValue(...)`)
    // to bypass Prisma's generated overload signatures — not worth hand-typing per call site.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated preview/build outputs are separate artifacts, not app source.
    "artifacts/**/dist/**",
    "artifacts/**/standalone.html",
  ]),
]);

export default eslintConfig;
