import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/offline.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/(rest|storage|functions)\/v1\/.*$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/(.*)\.tile\.openstreetmap\.org\/.*$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com\/.*$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "web-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "maskable-512x512.png"
      ],
      manifest: {
        name: "SFT GAZ — نظام توزيع الغاز",
        short_name: "SFTGAZ",
        description: "SFT GAZ — Système de distribution de gaz | نظام توزيع الغاز",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "fullscreen"],
        theme_color: "#0f172a",
        background_color: "#ffffff",
        orientation: "any",
        categories: ["business", "productivity"],
        screenshots: [
          { src: "/pwa-screenshot-1.png", sizes: "1280x720", type: "image/png" },
          { src: "/pwa-screenshot-2.png", sizes: "1280x720", type: "image/png" }
        ],
        shortcuts: [
          { name: "Dashboard", url: "/", description: "Accueil", icons: [{ src: "/favicon-32x32.png", sizes: "32x32" }] },
          { name: "Inventaire", url: "/inventory", description: "Stocks", icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192" }] },
          { name: "مصنع", url: "/factory", description: "إدارة المصنع", icons: [{ src: "/maskable-512x512.png", sizes: "512x512" }] },
          { name: "Live Map", url: "/live-map", description: "Carte en direct", icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192" }] },
          { name: "Rapports", url: "/reports", description: "Analyses", icons: [{ src: "/favicon-32x32.png", sizes: "32x32" }] },
        ],
        icons: [
          { src: "/android-chrome-192x192.png?v=20260322sft10", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/android-chrome-512x512.png?v=20260322sft10", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-512x512.png?v=20260322sft10", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png?v=20260322sft10", sizes: "180x180", type: "image/png", purpose: "any" },
          { src: "/favicon-32x32.png?v=20260322sft10", sizes: "32x32", type: "image/png", purpose: "any" },
          { src: "/favicon-16x16.png?v=20260322sft10", sizes: "16x16", type: "image/png", purpose: "any" }
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
