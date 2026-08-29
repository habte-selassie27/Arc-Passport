import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createReadStream, existsSync } from "fs";
import { join } from "path";

/** Serve .wasm files with the correct MIME type (Vite dev server default is wrong). */
function wasmMimeType(): Plugin {
  return {
    name: "wasm-mime-type",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
  };
}

/**
 * @worldcoin/idkit-core loads idkit_wasm_bg.wasm via
 * new URL("idkit_wasm_bg.wasm", import.meta.url). Under dep pre-bundling that
 * resolves into /node_modules/.vite/deps/ where the file doesn't exist, so the
 * SPA fallback returns index.html and WebAssembly init fails ("expected magic
 * word ... found <!DOC"). Intercept that exact request and stream the real
 * binary from node_modules. Dev-only — production builds emit the asset fine.
 */
function serveIdkitWasm(): Plugin {
  const wasmPath = join(
    process.cwd(),
    "node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm"
  );
  return {
    name: "serve-idkit-wasm",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.endsWith("idkit_wasm_bg.wasm") || !existsSync(wasmPath)) {
          return next();
        }
        res.setHeader("Content-Type", "application/wasm");
        createReadStream(wasmPath).pipe(res);
      });
    },
  };
}

/**
 * Serve @mediapipe/tasks-vision WASM assets under a stable URL so
 * FilesetResolver.forVisionTasks("/mediapipe/wasm") works in dev without a CDN.
 */
function serveMediapipeWasm(): Plugin {
  const wasmDir = join(process.cwd(), "node_modules/@mediapipe/tasks-vision/wasm");
  return {
    name: "serve-mediapipe-wasm",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/mediapipe/wasm/")) return next();
        const rel = url.replace("/mediapipe/wasm/", "");
        // Prevent path traversal — only serve files directly inside the dir.
        if (rel.includes("..") || rel.includes("/") || rel.includes("\\")) return next();
        const file = join(wasmDir, rel);
        if (!existsSync(file)) return next();
        res.setHeader("Content-Type", rel.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), wasmMimeType(), serveIdkitWasm(), serveMediapipeWasm()],
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
