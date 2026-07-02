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
        // Google Fonts をオフラインでも表示できるよう実行時キャッシュする
        // （workbox 公式の Google Fonts レシピ準拠）
        runtimeCaching: [
          {
            // フォント定義 CSS（unicode-range の分割定義）。更新に追従できるよう SWR
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // フォント本体（woff2）。内容不変の配信なので CacheFirst＋1 年保持。
            // 日本語フォントは unicode-range で多数のサブセットに分割されるため
            // maxEntries は多めに取る
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
