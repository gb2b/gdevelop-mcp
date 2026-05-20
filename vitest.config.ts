import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/index.ts",
        "src/tools/**",
        "src/prompts.ts",
        // catalog-actions + project-introspect require a real GDevelop
        // install / cache; they're exercised by the opt-in integration
        // test, not by unit tests.
        "src/core/catalog-actions.ts",
        "src/core/project-introspect.ts",
        "src/core/install.ts",
        "src/core/cache.ts",
        "src/core/github.ts",
        "src/core/runtime-info.ts",
        "src/core/overview.ts",
        "src/core/extension-describe.ts",
        "src/core/asset-store.ts",
        "src/core/asset-import.ts",
        "src/core/examples.ts",
        "src/core/extensions.ts",
        "src/core/preview-runtime.ts",
        "src/core/render-static.ts",
        "src/core/logger.ts",
        "src/core/path-safety.ts",
        "src/core/catalog-features.ts",
        "src/core/catalog-static.ts",
        "src/core/templates.ts",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 75,
      },
    },
  },
});
