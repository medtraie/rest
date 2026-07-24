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

          if (normalizedId.includes("@supabase")) {
            return "vendor_supabase";
          }

          if (normalizedId.includes("@tanstack")) {
            return "vendor_query";
          }

          return "vendor_app";
        },
      },
    },
  },
}));
