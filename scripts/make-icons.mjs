// PWA アプリアイコンを一括生成するスクリプト
// アイコンはゲームキャラ「ネムリ：寝息の浮き沈み」（紫・type=4）を使う。
// 著作権配慮のため Snood 本家画像は使わず、ゲーム本体の drawSnoot() をそのまま流用する。
// 開発サーバー起動中（npm run dev）に `node scripts/make-icons.mjs` で実行する。
// 出力先：public/（Vite が dist/ へコピーするのでビルドに自動同梱される）と docs/site/img/。
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.env.URL ?? "http://localhost:5173";
const publicDir = "public";
const docImgDir = "docs/site/img";
mkdirSync(publicDir, { recursive: true });
mkdirSync(docImgDir, { recursive: true });

// 背景色は本体カラーに馴染む紺（style.css の --bg-top）。ステータスバー／スプラッシュと統一する
const BG = "#1b2a4a";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
// __snoot（drawSnoot を含む DEV 限定フック）が公開されるのを待つ
await page.waitForFunction(() => !!(window).__snoot?.drawSnoot);

/** ネムリ（type=4）を中央に静止顔で描いた size×size の PNG を dataURL で返す */
async function renderIcon(size, radiusFactor) {
  return page.evaluate(
    ({ size, radiusFactor, bg }) => {
      const { drawSnoot } = window.__snoot;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const c = canvas.getContext("2d");
      // 背景を塗ってから中央にネムリを描画（t を渡さず静止顔）
      c.fillStyle = bg;
      c.fillRect(0, 0, size, size);
      drawSnoot(c, 4, size / 2, size / 2, size * radiusFactor);
      return canvas.toDataURL("image/png");
    },
    { size, radiusFactor, bg: BG },
  );
}

/** dataURL を PNG ファイルとして書き出す */
function savePng(dir, file, dataUrl) {
  writeFileSync(`${dir}/${file}`, Buffer.from(dataUrl.split(",")[1], "base64"));
}

// purpose=any（半径やや大きめ・周囲に少し余白）
const any192 = await renderIcon(192, 0.42);
const any512 = await renderIcon(512, 0.42);
// purpose=maskable（Android のマスク安全域に収めるため半径を小さめに）
const maskable512 = await renderIcon(512, 0.34);
// iOS のホーム画面用（角丸は OS 側で付くので塗りつぶし正方形のまま）
const apple180 = await renderIcon(180, 0.42);

savePng(publicDir, "pwa-192x192.png", any192);
savePng(publicDir, "pwa-512x512.png", any512);
savePng(publicDir, "pwa-maskable-512x512.png", maskable512);
savePng(publicDir, "apple-touch-icon.png", apple180);

// 備忘録（docs/site）掲載用に 512px を流用
savePng(docImgDir, "app-icon.png", any512);

await browser.close();
console.log("public/ にアプリアイコン、docs/site/img/app-icon.png を生成しました");
