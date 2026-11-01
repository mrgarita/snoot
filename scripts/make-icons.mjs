// PWA アプリアイコンを一括生成するスクリプト
// アイコンはゲームキャラ「ネムリ：寝息の浮き沈み」（紫・type=4）を使う。
// 著作権配慮のため Snood 本家画像は使わず、ゲーム本体の drawSnoot() をそのまま流用する。
// 開発サーバー起動中（npm run dev）に `node scripts/make-icons.mjs` で実行する。
// 出力先：public/（Vite が dist/ へコピーするのでビルドに自動同梱される）と docs/site/img/。
//
// 地（背景）の扱い（v1.0.1・ユーザー指摘で変更）：
// - スマホ（iOS の apple-touch-icon／Android の maskable）は OS が必ずタイル状に切り抜き、
//   透明部分は iOS で黒、Android で白い台座になる。そのため地は塗りつぶしたまま、
//   「キャラの色」と「各デザインの地色（--bg-top）」を半々に混ぜた色にして、顔の周りが
//   白や黒の余白に見えないようにする
// - PC 用（purpose: any）は透明が効くので地を塗らず、顔だけを描く
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.env.URL ?? "http://localhost:5173";
const publicDir = "public";
const docImgDir = "docs/site/img";
mkdirSync(publicDir, { recursive: true });
mkdirSync(docImgDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
// __snoot（drawSnoot を含む DEV 限定フック）が公開されるのを待つ
await page.waitForFunction(() => !!(window).__snoot?.drawSnoot);

// 値を固定せず実ページから読むので、見た目の違うブランチ（design/*）で実行すれば
// その案の地色・キャラ色が自動で使われる
const { bgTop, tile } = await page.evaluate(() => {
  const { TYPE_COLORS } = window.__snoot;
  const bgTop = getComputedStyle(document.documentElement).getPropertyValue("--bg-top").trim();
  // 色文字列を [r, g, b] に正規化する（canvas に一度通すと #rrggbb で返る）
  const toRgb = (s) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = s;
    const h = c.fillStyle;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [a, b] = [toRgb(TYPE_COLORS[4]), toRgb(bgTop)];
  const tile = `rgb(${a.map((v, i) => Math.round((v + b[i]) / 2)).join(",")})`;
  return { bgTop, tile };
});
console.log(`地色（--bg-top）: ${bgTop} → スマホ用アイコンの地: ${tile}`);

/**
 * ネムリ（type=4）を静止顔で描いた size×size の PNG を dataURL で返す。
 * 影や z を含む描画範囲が「一辺 fill×size の正方形」に収まるよう大きさと位置を決め、
 * 余白を上下左右で均等にする（デザインごとに影の有無や z の位置が違うため）。
 * bg を省くと地を塗らない（透明）。
 */
async function renderIcon(size, fill, bg) {
  return page.evaluate(
    ({ size, fill, bg }) => {
      const { drawSnoot } = window.__snoot;
      // 透明キャンバスに基準半径 R0 で描き、不透明ピクセルの外接矩形を R0 単位で測る
      const R0 = 200;
      const S = R0 * 4;
      const m = document.createElement("canvas");
      m.width = m.height = S;
      const mc = m.getContext("2d", { willReadFrequently: true });
      drawSnoot(mc, 4, S / 2, S / 2, R0);
      const { data } = mc.getImageData(0, 0, S, S);
      let x0 = S, y0 = S, x1 = 0, y1 = 0;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          if (data[(y * S + x) * 4 + 3] > 8) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      }
      const boxSize = Math.max(x1 + 1 - x0, y1 + 1 - y0) / R0;
      const boxCx = ((x0 + x1 + 1) / 2 - S / 2) / R0;
      const boxCy = ((y0 + y1 + 1) / 2 - S / 2) / R0;

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const c = canvas.getContext("2d");
      if (bg) {
        c.fillStyle = bg;
        c.fillRect(0, 0, size, size);
      }
      // 描画範囲の中心がキャンバス中央に来るよう、本体の中心をずらして描く（t を渡さず静止顔）
      const r = (fill * size) / boxSize;
      drawSnoot(c, 4, size / 2 - boxCx * r, size / 2 - boxCy * r, r);
      return canvas.toDataURL("image/png");
    },
    { size, fill, bg },
  );
}

/** dataURL を PNG ファイルとして書き出す */
function savePng(dir, file, dataUrl) {
  writeFileSync(`${dir}/${file}`, Buffer.from(dataUrl.split(",")[1], "base64"));
}

// purpose=any（PC のインストール用など）：地は透明、絵はほぼいっぱいに描く
const any192 = await renderIcon(192, 0.9);
const any512 = await renderIcon(512, 0.9);
// purpose=maskable（Android）：機種ごとの形で切り抜かれても欠けないよう、
// 仕様の安全域（中心から半径 40%＝直径 80%）に収める
const maskable512 = await renderIcon(512, 0.8, tile);
// iOS のホーム画面用：角丸は OS 側で付くので塗りつぶし正方形のまま（透明は黒になる）
const apple180 = await renderIcon(180, 0.86, tile);

savePng(publicDir, "pwa-192x192.png", any192);
savePng(publicDir, "pwa-512x512.png", any512);
savePng(publicDir, "pwa-maskable-512x512.png", maskable512);
savePng(publicDir, "apple-touch-icon.png", apple180);

// 備忘録（docs/site）掲載用に 512px を流用。備忘録サイトは main の docs/site だけが
// 公開されるので、design/* のブランチで実行するときは SKIP_DOC_ICON=1 で抑止する
if (!process.env.SKIP_DOC_ICON) savePng(docImgDir, "app-icon.png", any512);

await browser.close();
console.log("public/ にアプリアイコン、docs/site/img/app-icon.png を生成しました");
