// ハイスコアの永続化（難易度別 Top5・localStorage・オフライン）
// 原作 Snood のローカル難易度別ベスト表を、ブラウザ完結・ゼロコストの制約に合わせて
// localStorage で再現する（オンライン世界ランキングは対象外）。
import { DifficultyId } from "./config";

export interface Score {
  /** プレイヤー名 */
  name: string;
  score: number;
  /** 到達レベル */
  level: number;
  /** 記録日（YYYY-MM-DD） */
  date: string;
}

/** 各難易度で保持する件数 */
export const MAX_ENTRIES = 5;
/** 名前入力の既定値（前回名が無いとき） */
export const DEFAULT_NAME = "ゲスト";

const SCORES_KEY = "snoot.highscores.v1";
const NAME_KEY = "snoot.lastname.v1";

type ScoreTable = Record<DifficultyId, Score[]>;

function emptyTable(): ScoreTable {
  return { easy: [], normal: [], hard: [] };
}

/** localStorage 全体を読み込む。破損・無効化・未対応時は空テーブルを返す（例外は投げない） */
function readTable(): ScoreTable {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return emptyTable();
    const parsed = JSON.parse(raw) as Partial<ScoreTable>;
    const table = emptyTable();
    for (const d of ["easy", "normal", "hard"] as DifficultyId[]) {
      const list = Array.isArray(parsed[d]) ? (parsed[d] as Score[]) : [];
      // 念のため形を検証・正規化してから降順ソート・切り詰め
      table[d] = list
        .filter((s) => s && typeof s.score === "number")
        .map((s) => ({
          name: typeof s.name === "string" && s.name ? s.name : DEFAULT_NAME,
          score: Math.floor(s.score),
          level: typeof s.level === "number" ? s.level : 1,
          date: typeof s.date === "string" ? s.date : "",
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES);
    }
    return table;
  } catch {
    return emptyTable();
  }
}

function writeTable(table: ScoreTable): void {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(table));
  } catch {
    // localStorage が使えない環境では保存をあきらめる（機能の劣化のみ）
  }
}

/** 指定難易度のハイスコア（score 降順、最大 MAX_ENTRIES 件） */
export function loadScores(difficulty: DifficultyId): Score[] {
  return readTable()[difficulty];
}

/** 全難易度のハイスコア */
export function loadAll(): ScoreTable {
  return readTable();
}

/** この得点が指定難易度の Top5 に入るか */
export function qualifies(difficulty: DifficultyId, score: number): boolean {
  if (score <= 0) return false;
  const list = readTable()[difficulty];
  if (list.length < MAX_ENTRIES) return true;
  return score > list[list.length - 1].score;
}

/**
 * 得点を追加して保存し、その難易度内での順位（1 始まり）を返す。
 * Top5 圏外なら何もせず -1 を返す。
 */
export function addScore(difficulty: DifficultyId, entry: Score): number {
  if (entry.score <= 0) return -1;
  const table = readTable();
  const list = table[difficulty];
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(entry) + 1;
  table[difficulty] = list.slice(0, MAX_ENTRIES);
  writeTable(table);
  // 切り詰めで押し出された場合は圏外
  return rank <= MAX_ENTRIES ? rank : -1;
}

/** 前回入力した名前（無ければ既定値） */
export function loadLastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

export function saveLastName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 保存できなくても致命的ではない
  }
}

/** 記録日（YYYY-MM-DD） */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
