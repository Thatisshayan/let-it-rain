import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only pure-logic modules are unit tested here — RN component tests
    // would need jest-expo/react-native-testing-library, which is a
    // heavier setup left for a follow-up.
    include: ["src/**/*.test.ts"],
  },
});
