import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(thisDir, "../..");

export default defineConfig({
  envDir: rootDirectory,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(thisDir, "./src"),
    },
  },
  server: { port: 5173 },
});
