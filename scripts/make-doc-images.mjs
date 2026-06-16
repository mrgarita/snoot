// 備忘録（docs/site）掲載用の画像を一括生成するスクリプト
// 開発サーバー起動中に `node scripts/make-doc-images.mjs` で実行する。
// 出力先：docs/site/img/
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.env.URL ?? "http://localhost:5173";
const outDir = "docs/site/img";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });

/** 指定ビューポートでタイトル → 指定難易度のゲーム画面を撮影する */
async function shoot(viewport, mobile, level, names) {
  const ctx = await browser.newContext(
    mobile ? { viewport, hasTouch: true, isMobile: true } : { viewport },
  );
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#logo");
  if (names.title) {
    await page.screenshot({ path: `${outDir}/${names.title}.png` });
  }
  await page.click(`button[data-level="${level}"]`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${names.game}.png` });
  await ctx.close();
}

// PC（横長）とスマホ（縦長）で難易度比較を撮影
await shoot({ width: 900, height: 675 }, false, "easy", { title: "title-pc", game: "game-easy-pc" });
await shoot({ width: 900, height: 675 }, false, "hard", { game: "game-hard-pc" });
await shoot({ width: 390, height: 844 }, true, "easy", { title: "title-mobile", game: "game-easy-mobile" });
await shoot({ width: 390, height: 844 }, true, "hard", { game: "game-hard-mobile" });

/** 指定難易度・レベルでゲームを開始して撮影する（レベルアップ比較用。DEV フックを使用） */
async function shootLevel(viewport, difficulty, level, name) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#logo");
  await page.evaluate(([d, lv]) => window.__snoot.startGame(d, lv), [difficulty, level]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await ctx.close();
}

// レベルアップによる段階的難化の比較（同じ Easy の Lv.1 と Lv.5）
await shootLevel({ width: 420, height: 760 }, "easy", 1, "game-level-1");
await shootLevel({ width: 420, height: 760 }, "easy", 5, "game-level-5");

// キャラクター 7 種の名前付き一覧（ゲーム本体の描画コードをそのまま使う）
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 220 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const dataUrl = await page.evaluate(() => {
    const { drawSnoot, TYPE_NAMES } = window.__snoot;
    const n = TYPE_NAMES.length;
    const cell = 90;
    const pad = 24;
    const labelH = 34;
    const canvas = document.createElement("canvas");
    canvas.width = n * (cell + pad) + pad;
    canvas.height = cell + pad * 2 + labelH;
    const c = canvas.getContext("2d");
    c.fillStyle = "#22365a";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) {
      const x = pad + i * (cell + pad) + cell / 2;
      const y = pad + cell / 2;
      drawSnoot(c, i, x, y, cell / 2);
      c.fillStyle = "#fff";
      c.font = "bold 18px sans-serif";
      c.textAlign = "center";
      c.fillText(TYPE_NAMES[i], x, pad + cell + 26);
    }
    return canvas.toDataURL("image/png");
  });
  writeFileSync(`${outDir}/characters.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
  await ctx.close();
}

await browser.close();
console.log("docs/site/img/ に画像を生成しました");
