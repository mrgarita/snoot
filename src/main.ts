// エントリポイント：画面遷移（タイトル⇔ゲーム⇔リザルト）・バージョン表示・ハイスコア
import "./style.css";
import pkg from "../package.json";
import { Game, GameEndInfo } from "./game";
import { DifficultyId, DIFFICULTIES } from "./config";
import { sound } from "./audio";
import { drawSnoot, TYPE_COLORS, TYPE_NAMES } from "./characters";
import {
  Score,
  MAX_ENTRIES,
  DEFAULT_NAME,
  qualifies,
  addScore,
  loadScores,
  loadAll,
  loadLastName,
  saveLastName,
  today,
} from "./scores";

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
const resultBest = document.getElementById("result-best")!;
const btnRetry = document.getElementById("btn-retry")!;
const btnNext = document.getElementById("btn-next")!;
const btnTitle = document.getElementById("btn-title")!;
const btnQuit = document.getElementById("btn-quit")!;
const versionBadge = document.getElementById("version-badge")!;

// ハイスコア関連の要素
const btnHighscore = document.getElementById("btn-highscore")!;
const highscoreOverlay = document.getElementById("highscore-overlay")!;
const highscoreTables = document.getElementById("highscore-tables")!;
const btnHighscoreClose = document.getElementById("btn-highscore-close")!;
const nameEntryOverlay = document.getElementById("name-entry-overlay")!;
const nameEntryMsg = document.getElementById("name-entry-msg")!;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const btnNameOk = document.getElementById("btn-name-ok")!;

// project.txt step4 の要件：今プレイ中のバージョンが常に分かるようにする
versionBadge.textContent = `Snoot v${pkg.version}`;

let currentDifficulty: DifficultyId = "easy";
let lastEnd: GameEndInfo | null = null;
/** 現在の run のスコアをハイスコアへ記録済みか（同一 run の二重記録を防ぐ） */
let runRecorded = false;
/** 直近 finalize で得た順位（1 始まり、圏外/未記録は null）。リザルト表示に使う */
let lastRank: number | null = null;

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const game = new Game(canvas, (info) => {
  lastEnd = info;
  if (info.kind === "gameover") {
    // ゲームオーバーで run は確定。記録（必要なら名前入力）してからリザルト表示
    finalizeRun(() => showResult(info));
  } else {
    // クリアは「次のレベルへ」で続く可能性があるため、ここでは記録しない
    lastRank = null;
    showResult(info);
  }
});

function startGame(difficulty: DifficultyId, level = 1, score = 0): void {
  currentDifficulty = difficulty;
  runRecorded = false;
  lastRank = null;
  titleScreen.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  // ルート背景のフォールバックを盤面色へ（iOS 下端帯を盤面と同色にし横帯を消す）
  document.documentElement.classList.add("in-game");
  // 画面表示後にサイズが確定してから開始する
  requestAnimationFrame(() => game.start(difficulty, level, score));
}

function showTitle(): void {
  game.stop();
  gameScreen.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  titleScreen.classList.remove("hidden");
  // ルート背景のフォールバックをグラデ裾色へ戻す（タイトルの下端帯を均一に保つ）
  document.documentElement.classList.remove("in-game");
}

/**
 * 現在の run のスコアをハイスコアへ確定させる（同一 run につき 1 回だけ）。
 * Top5 に入るなら名前入力ダイアログを挟み、記録後に then() を呼ぶ。
 */
function finalizeRun(then: () => void): void {
  if (runRecorded) {
    then();
    return;
  }
  runRecorded = true;
  const score = game.getScore();
  if (score > 0 && qualifies(currentDifficulty, score)) {
    openNameEntry(score, (name) => {
      lastRank = addScore(currentDifficulty, {
        name,
        score,
        level: game.getLevel(),
        date: today(),
      });
      saveLastName(name);
      then();
    });
  } else {
    lastRank = null;
    then();
  }
}

/** 新記録達成時の名前入力。前回名を既定表示し、登録/Enter で onDone(name) */
function openNameEntry(score: number, onDone: (name: string) => void): void {
  const label = DIFFICULTIES[currentDifficulty].label;
  nameEntryMsg.textContent = `${label}  スコア ${score.toLocaleString()}`;
  nameInput.value = loadLastName();
  nameEntryOverlay.classList.remove("hidden");
  nameInput.focus();
  nameInput.select();

  const submit = () => {
    const name = (nameInput.value.trim() || DEFAULT_NAME).slice(0, 8);
    nameEntryOverlay.classList.add("hidden");
    btnNameOk.removeEventListener("click", submit);
    nameInput.removeEventListener("keydown", onKey);
    onDone(name);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };
  btnNameOk.addEventListener("click", submit);
  nameInput.addEventListener("keydown", onKey);
}

function showResult(info: GameEndInfo): void {
  // レベルが意味を持つようになったので、到達レベルを見出しに明示する
  resultTitle.textContent =
    info.kind === "clear" ? `Lv.${info.level} クリア！` : `Lv.${info.level} でゲームオーバー`;
  resultScore.textContent = `スコア：${info.score.toLocaleString()}`;

  // ベスト／新記録の表示
  const label = DIFFICULTIES[currentDifficulty].label;
  if (lastRank && lastRank > 0) {
    resultBest.textContent = `新記録！ ${label} ${lastRank}位`;
    resultBest.classList.add("new-record");
  } else {
    const best = loadScores(currentDifficulty)[0];
    resultBest.textContent = best
      ? `${label} ベスト：${best.score.toLocaleString()}（${best.name}）`
      : `${label} 初プレイ`;
    resultBest.classList.remove("new-record");
  }

  btnNext.classList.toggle("hidden", info.kind !== "clear");
  // 次に挑む難易度（レベル）を明示して進行が分かるようにする
  btnNext.textContent = `次のレベルへ（Lv.${info.level + 1}）`;
  btnRetry.textContent = info.kind === "clear" ? "同じレベルをもう一度" : "もう一度";
  resultOverlay.classList.remove("hidden");
}

/** 難易度別 Top5 の表を描画する。highlight 指定時は該当行を強調 */
function renderHighscores(highlight?: { difficulty: DifficultyId; rank: number }): void {
  const all = loadAll();
  const groups: string[] = [];
  for (const d of ["easy", "normal", "hard"] as DifficultyId[]) {
    const list = all[d];
    const rows: string[] = [];
    for (let i = 0; i < MAX_ENTRIES; i++) {
      const s: Score | undefined = list[i];
      if (s) {
        const hl =
          highlight && highlight.difficulty === d && highlight.rank === i + 1
            ? " class=\"hs-highlight\""
            : "";
        rows.push(
          `<tr${hl}><td class="hs-rank">${i + 1}</td>` +
            `<td class="hs-name">${escapeHtml(s.name)}</td>` +
            `<td class="hs-score">${s.score.toLocaleString()}</td>` +
            `<td class="hs-level">Lv.${s.level}</td></tr>`,
        );
      } else {
        rows.push(
          `<tr class="hs-empty"><td class="hs-rank">${i + 1}</td>` +
            `<td class="hs-name">—</td><td class="hs-score">—</td><td class="hs-level"></td></tr>`,
        );
      }
    }
    groups.push(
      `<div class="hs-group"><h3>${DIFFICULTIES[d].label}</h3>` +
        `<table class="hs-table">${rows.join("")}</table></div>`,
    );
  }
  highscoreTables.innerHTML = groups.join("");
}

/** ユーザー入力の名前を innerHTML に差し込むため HTML エスケープする */
function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

for (const btn of document.querySelectorAll<HTMLButtonElement>(".level-btn")) {
  btn.addEventListener("click", () => {
    sound.unlock(); // ユーザー操作を起点に音声を有効化
    startGame(btn.dataset.level as DifficultyId);
  });
}

btnRetry.addEventListener("click", () => {
  // クリア後の「同じレベルをもう一度」は到達レベルを維持、ゲームオーバー後の
  // 「もう一度」は最初（Lv.1）からやり直す。いずれもスコアは 0 にリセット。
  // クリア後に止める場合の得点を取りこぼさないよう、遷移前に記録を確定する。
  const level = lastEnd && lastEnd.kind === "clear" ? lastEnd.level : 1;
  finalizeRun(() => startGame(currentDifficulty, level));
});
btnNext.addEventListener("click", () => {
  // run を継続するのでここでは記録しない（最終的なゲームオーバーで 1 回だけ記録）
  const next = lastEnd ? lastEnd.level + 1 : 1;
  const score = lastEnd ? lastEnd.score : 0;
  startGame(currentDifficulty, next, score);
});
btnTitle.addEventListener("click", () => finalizeRun(showTitle));
btnQuit.addEventListener("click", () => finalizeRun(showTitle));

// タイトルからハイスコア一覧を開く
function closeHighscore(): void {
  highscoreOverlay.classList.add("hidden");
}
btnHighscore.addEventListener("click", () => {
  renderHighscores();
  highscoreOverlay.classList.remove("hidden");
});
btnHighscoreClose.addEventListener("click", closeHighscore);
// 枠外（オーバーレイ背景）をタップ／クリックしても閉じる。
// ボックス内側のタップでは閉じないよう、対象がオーバーレイ自身のときだけ閉じる
highscoreOverlay.addEventListener("click", (e) => {
  if (e.target === highscoreOverlay) closeHighscore();
});
