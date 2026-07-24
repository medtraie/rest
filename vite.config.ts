import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("node_modules")) return;

          if (normalizedId.includes("jspdf") || normalizedId.includes("html2canvas")) {
            return "vendor_pdf";
          }

          if (normalizedId.includes("leaflet")) {
            return "vendor_map";
          }

          if (normalizedId.includes("@supabase")) {
            return "vendor_supabase";
          }

          const isReactCore =
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-router/") ||
            normalizedId.includes("/node_modules/react-router-dom/") ||
            normalizedId.includes("/node_modules/react-is/") ||
            normalizedId.includes("/node_modules/use-sync-external-store/") ||
            normalizedId.includes("/node_modules/scheduler/") ||
            normalizedId.includes("/node_modules/@remix-run/router/");

          if (isReactCore) {
            return "vendor_react";
          }

          if (
            normalizedId.includes("@radix-ui") ||
            normalizedId.includes("framer-motion") ||
            normalizedId.includes("embla-carousel") ||
            normalizedId.includes("/node_modules/sonner/") ||
            normalizedId.includes("/node_modules/next-themes/")
          ) {
            return "vendor_ui";
          }

          if (normalizedId.includes("@tanstack")) {
            return "vendor_query";
          }
        },
      },
    },
  },
}));
