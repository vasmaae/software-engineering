import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
  build: { outDir: "../dist/web", emptyOutDir: true },
  test: {
    environment: "jsdom",
    coverage: {
      include: ["src/App.jsx"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "../artifacts/web-coverage",
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
