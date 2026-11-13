import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { enabled: false },
    include: ["packages/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-types/**"],
    // Compile CSS imports from the installed engine UI packages through Vite.
    server: { deps: { inline: ["@xecms/ui", "@xecms/admin"] } },
  },
});
