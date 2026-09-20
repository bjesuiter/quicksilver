import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.BASE_PATH ?? "/quicksilver/";

export default defineConfig({
  base,
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      devOptions: {
        enabled: true,
        suppressWarnings: true,
        type: "module"
      },
      includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Quicksilver",
        short_name: "Quicksilver",
        description: "Compress iPhone video locally in your browser.",
        theme_color: "#f5f7fa",
        background_color: "#f5f7fa",
        display: "standalone",
        orientation: "any",
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}pwa-64x64.png`,
            sizes: "64x64",
            type: "image/png"
          },
          {
            src: `${base}pwa-192x192.png`,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: `${base}pwa-512x512.png`,
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: `${base}maskable-icon-512x512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: `${base}index.html`
      }
    })
  ]
});
