// エントリポイント：画面遷移（タイトル⇔ゲーム⇔リザルト）とバージョン表示
import "./style.css";
import pkg from "../package.json";
import { Game, GameEndInfo } from "./game";
import { DifficultyId } from "./config";
import { sound } from "./audio";
import { drawSnoot, TYPE_COLORS, TYPE_NAMES } from "./characters";

// 備忘録用の画像生成スクリプト（scripts/make-doc-images.mjs）から参照する。開発時のみ。
// startGame は任意のレベルから開始してレベル比較スクショを撮るために公開する
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__snoot = {
    drawSnoot,
    TYPE_COLORS,
    TYPE_NAMES,
    startGame: (difficulty: DifficultyId, level = 1) => startGame(difficulty, level),
  };
}

const titleScreen = document.getElementById("title-screen")!;
const gameScreen = document.getElementById("game-screen")!;
const resultOverlay = document.getElementById("result-overlay")!;
const resultTitle = document.getElementById("result-title")!;
const resultScore = document.getElementById("result-score")!;
const btnRetry = document.getElementById("btn-retry")!;
const btnNext = document.getElementById("btn-next")!;
const btnTitle = document.getElementById("btn-title")!;
const btnQuit = document.getElementById("btn-quit")!;
const versionBadge = document.getElementById("version-badge")!;

// project.txt step4 の要件：今プレイ中のバージョンが常に分かるようにする
versionBadge.textContent = `Snoot v${pkg.version}`;

let currentDifficulty: DifficultyId = "easy";
let lastEnd: GameEndInfo | null = null;

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const game = new Game(canvas, (info) => {
  lastEnd = info;
  showResult(info);
});

function startGame(difficulty: DifficultyId, level = 1, score = 0): void {
  currentDifficulty = difficulty;
  titleScreen.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  // 画面表示後にサイズが確定してから開始する
  requestAnimationFrame(() => game.start(difficulty, level, score));
}

function showTitle(): void {
  game.stop();
  gameScreen.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  titleScreen.classList.remove("hidden");
}

function showResult(info: GameEndInfo): void {
  // レベルが意味を持つようになったので、到達レベルを見出しに明示する
  resultTitle.textContent =
    info.kind === "clear" ? `Lv.${info.level} クリア！` : `Lv.${info.level} でゲームオーバー`;
  resultScore.textContent = `スコア：${info.score}`;
  btnNext.classList.toggle("hidden", info.kind !== "clear");
  // 次に挑む難易度（レベル）を明示して進行が分かるようにする
  btnNext.textContent = `次のレベルへ（Lv.${info.level + 1}）`;
  btnRetry.textContent = info.kind === "clear" ? "同じレベルをもう一度" : "もう一度";
  resultOverlay.classList.remove("hidden");
}

for (const btn of document.querySelectorAll<HTMLButtonElement>(".level-btn")) {
  btn.addEventListener("click", () => {
    sound.unlock(); // ユーザー操作を起点に音声を有効化
    startGame(btn.dataset.level as DifficultyId);
  });
}

btnRetry.addEventListener("click", () => {
  // クリア後の「同じレベルをもう一度」は到達レベルを維持、ゲームオーバー後の
  // 「もう一度」は最初（Lv.1）からやり直す。いずれもスコアは 0 にリセット
  const level = lastEnd && lastEnd.kind === "clear" ? lastEnd.level : 1;
  startGame(currentDifficulty, level);
});
btnNext.addEventListener("click", () => {
  const next = lastEnd ? lastEnd.level + 1 : 1;
  const score = lastEnd ? lastEnd.score : 0;
  startGame(currentDifficulty, next, score);
});
btnTitle.addEventListener("click", showTitle);
btnQuit.addEventListener("click", showTitle);
