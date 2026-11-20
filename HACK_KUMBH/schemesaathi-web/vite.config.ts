import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "SchemeSaathi - Sarkari Sahayak",
        short_name: "SchemeSaathi",
        description: "Multilingual government welfare-scheme assistant for Maharashtra & Central India",
        theme_color: "#C4714A",
        background_color: "#FAF7F2",
        display: "standalone",
        icons: [
          {
            src: "/logo.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/(schemes|profile\/sections|districts|documents)/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-reference-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/voice": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  // @ts-expect-error vitest config extension
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/test/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
