import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // XServer のサブディレクトリや GitHub Pages にそのまま置けるよう相対パスでビルドする
  base: "./",
  plugins: [
    VitePWA({
      // ビルドのたびに Service Worker を更新し、次回起動時に自動で最新版へ入れ替える
      registerType: "autoUpdate",
      // 登録スクリプトを自動注入する（src/main.ts の変更は不要）
      injectRegister: "auto",
      // manifest に載らない iOS 用アイコンもプリキャッシュ対象に含める
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Snoot",
        short_name: "Snoot",
        description: "Snood 風バブルシューター「Snoot」",
        lang: "ja",
        // サブディレクトリ配信（play/<tag>/ や XServer 配下）でも動くよう相対指定にする
        start_url: ".",
        scope: "./",
        display: "standalone",
        // スタンドアロン時のステータスバー／スプラッシュを本体背景の紺に馴染ませる
        background_color: "#1b2a4a",
        theme_color: "#1b2a4a",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
      },
    }),
  ],
});
