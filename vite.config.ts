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
      includeAssets: ["icon.svg"],
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
            src: `${base}icon.svg`,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
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
