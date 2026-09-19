import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["@stellar/stellar-sdk", "react", "react-dom"] },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [
        "**/.env*",
        "**/.git/**",
        "**/.duly-*",
        "**/.aidat-*",
        "**/*.pem",
        "**/*.key",
      ],
    },
  },
  build: { target: "es2022" },
});
