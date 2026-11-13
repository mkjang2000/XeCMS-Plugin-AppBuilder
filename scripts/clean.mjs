import { rm } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./process.mjs";

const packages = ["model", "client", "runtime", "server", "admin"]
  .map(name => join(root, "packages", name));

for (const directory of packages) {
  for (const output of ["dist", "dist-types"]) {
    await rm(join(directory, output), { recursive: true, force: true });
  }
}

// Keep release artifacts, prerelease engine packages, dependencies and local data.
for (const directory of [root, ...packages]) {
  for (const output of ["coverage", "playwright-report", "test-results", ".cache", ".vite", ".vitest"]) {
    await rm(join(directory, output), { recursive: true, force: true });
  }
  for (const cache of [".cache", ".vite", ".vitest"]) {
    await rm(join(directory, "node_modules", cache), { recursive: true, force: true });
  }
}
