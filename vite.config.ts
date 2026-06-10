import { defineConfig } from "vite";

export default defineConfig({
  // XServer のサブディレクトリや GitHub Pages にそのまま置けるよう相対パスでビルドする
  base: "./",
});
