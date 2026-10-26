import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Browser-only demo build: the API runs inside the page (client/src/demo), with a fictional
 * patient. One JS and one CSS file, relative paths, so it can be hosted as a static page.
 */
export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_DEMO": JSON.stringify("1") },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/demo"),
    emptyOutDir: true,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
