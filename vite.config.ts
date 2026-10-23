import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Taxi / NCC 考试助手",
        short_name: "Taxi NCC",
        description: "意大利 Taxi / NCC 中文学习助手",
        lang: "zh-CN",
        theme_color: "#123c36",
        background_color: "#f6f7f3",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
