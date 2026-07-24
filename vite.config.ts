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
          if (!id.includes("node_modules")) return;

          if (id.includes("jspdf") || id.includes("html2canvas")) {
            return "vendor_pdf";
          }

          if (id.includes("leaflet")) {
            return "vendor_map";
          }

          if (id.includes("@supabase")) {
            return "vendor_supabase";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor_react";
          }

          if (id.includes("@radix-ui") || id.includes("framer-motion") || id.includes("embla-carousel")) {
            return "vendor_ui";
          }

          if (id.includes("@tanstack")) {
            return "vendor_query";
          }
        },
      },
    },
  },
}));
