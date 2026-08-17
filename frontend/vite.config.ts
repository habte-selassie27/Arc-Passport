import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    target: "esnext",
    // @metamask/sdk (a dependency of the wagmi metaMask connector) ships as a
    // pre-bundled monolith ~550 kB and cannot be split further; the app shell
    // itself is split via manualChunks below. Silence the warning for that one lib.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into separate chunks so the app shell stays small
        // and caching improves (wagmi/viem rarely change together with app code).
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          wagmi: ["wagmi", "@tanstack/react-query"],
          viem: ["viem"],
        },
      },
    },
  },
});
