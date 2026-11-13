import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "serve" ? "/" : "/extensions/app-builder/",
  resolve: {
    alias: [
      { find: /^@xecms\/admin-runtime\/geometry$/, replacement: source("../runtime/src/composed-geometry.ts") },
      { find: /^@xecms\/admin-runtime$/, replacement: source("../runtime/src/index.tsx") },
      { find: /^@xecms\/admin-apps$/, replacement: source("../model/src/index.ts") },
      { find: /^@xecms\/app-builder-client$/, replacement: source("../client/src/index.ts") },
    ],
  },
  server: {
    host: process.env.XECMS_BUILDER_HOST ?? "127.0.0.1",
    port: Number(process.env.XECMS_BUILDER_PORT ?? "5174"),
    strictPort: true,
    proxy: { "/api": { target: process.env.XECMS_SERVER_URL ?? "http://127.0.0.1:3100", changeOrigin: true } },
  },
  build: { outDir: "dist", emptyOutDir: true },
}));
