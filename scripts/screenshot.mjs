// 動作確認用スクリプト：タイトル画面とゲーム画面のスクリーンショットを撮る
// （システムの Edge をヘッドレス起動して目視検証に使う。本体のビルドには関与しない）
import { chromium } from "playwright-core";

const url = process.env.URL ?? "http://localhost:5173";
const mobile = process.env.MOBILE === "1";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1024, height: 768 } },
);
const page = await ctx.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

const suffix = mobile ? "-mobile" : "";

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("#logo");
await page.screenshot({ path: `scripts/shots/title${suffix}.png` });

// Easy を選んでゲーム画面へ
await page.click('button[data-level="easy"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `scripts/shots/game-easy${suffix}.png` });

// キャンバス上で照準→発射を 3 回行い、盤面が動くことを確認
const canvas = page.locator("#game-canvas");
const box = await canvas.boundingBox();
if (box) {
  const targets = [0.5, 0.3, 0.7];
  for (const fx of targets) {
    const x = box.x + box.width * fx;
    const y = box.y + box.height * 0.35;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
}
await page.screenshot({ path: `scripts/shots/game-after-shots${suffix}.png` });

console.log("console errors:", errors.length === 0 ? "none" : errors);
await browser.close();
