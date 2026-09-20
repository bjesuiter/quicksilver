import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { join } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import packageJson from "./package.json" with { type: "json" };

const base = process.env.BASE_PATH ?? "/quicksilver/";
const commit = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

function githubPagesFallback(): Plugin {
  return {
    name: "github-pages-fallback",
    writeBundle(options) {
      if (options.dir) copyFileSync(join(options.dir, "index.html"), join(options.dir, "404.html"));
    }
  };
}

export default defineConfig({
  base,
  define: {
    __QUICKSILVER_VERSION__: JSON.stringify(packageJson.version),
    __QUICKSILVER_COMMIT__: JSON.stringify(commit)
  },
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
        description: "Convert media locally in your browser.",
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
    }),
    githubPagesFallback()
  ]
});
