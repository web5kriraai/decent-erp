import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: ["next-auth", "@auth/core", "oauth4webapi"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
});
