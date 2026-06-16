// 難易度設定とゲーム定数
// 値の根拠は docs/site/step1-research.html（Snood 調査）を参照。
// 原作の列数（14〜17）はスマホでは 1 個が小さくなりすぎるため抑えめにしている。
import { TYPE_COUNT_MAX } from "./characters";

export type DifficultyId = "easy" | "normal" | "hard";

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  /** 偶数行の列数（奇数行は 1 列少ない） */
  cols: number;
  /** 開始時に並ぶ行数 */
  initialRows: number;
  /** 登場するキャラクターの種類数 */
  typeCount: number;
  /** 危険ゲージの容量（実質の許容発射数） */
  dangerCap: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy:   { id: "easy",   label: "Easy",   cols: 9,  initialRows: 5, typeCount: 4, dangerCap: 10 },
  normal: { id: "normal", label: "Normal", cols: 11, initialRows: 7, typeCount: 6, dangerCap: 8 },
  hard:   { id: "hard",   label: "Hard",   cols: 13, initialRows: 8, typeCount: 7, dangerCap: 6 },
};

/** 全難易度の最小列数（盤面幅を難易度間で揃える基準。セルが最大になる難易度） */
export const MIN_COLS = Math.min(...Object.values(DIFFICULTIES).map((d) => d.cols));

/** この行（視覚上の行番号）にピースが達したらゲームオーバー */
export const ROWS_LIMIT = 12;

/** 六角格子の行の高さ係数（√3/2） */
export const ROW_H = 0.866;

/** 発射速度（セル直径/秒） */
export const SHOT_SPEED = 28;

/** 得点：マッチ消去 1 個あたり */
export const SCORE_POP = 10;
/** 得点：落下除去 1 個あたり（落下の方が高得点 = 原作準拠） */
export const SCORE_DROP = 30;
/** クリア時の追加ボーナス（レベルが上がるほど増える） */
export const SCORE_LEVEL_BONUS = 100;

// ---- レベルアップによる段階的難化（Snoot 独自仕様） ----
// 原作 Snood の Classic は面を進めても難易度が固定（難化するのは Journey モード）だが、
// Snoot では「選んだ難易度を起点に、レベルが上がるほど少しずつ難しくする」現代的な
// 方式を採用する。経緯は docs/site/step3-feedback.html を参照。

/** 初期行数の上限（デッドライン ROWS_LIMIT より十分上に保つ） */
export const LEVEL_ROWS_MAX = ROWS_LIMIT - 2;
/** 危険ゲージ容量の下限（これ以下にはしない＝天井降下が速くなりすぎないように） */
export const LEVEL_DANGER_MIN = 3;

/**
 * 選んだ難易度（base）を起点に、レベルに応じて段階的に難化させた実効設定を返す。
 * level = 1 が起点で base と同値。レベルが 1 上がるごとに：
 *  - 初期行数 +1（LEVEL_ROWS_MAX で頭打ち）＝開始時に盤面がより埋まる
 *  - 危険ゲージ容量 -1（LEVEL_DANGER_MIN で底打ち）＝天井がより速く降りてくる
 *  - キャラ種類数 +1/2レベル（TYPE_COUNT_MAX で頭打ち）＝マッチが揃いにくくなる
 * 盤面の列数（cols）は見た目を難易度間で揃えるため、レベルでは変えない。
 * label・id は base のまま引き継ぐ（HUD には選んだ難易度名を表示する）。
 */
export function effectiveConfig(base: DifficultyConfig, level: number): DifficultyConfig {
  const extra = Math.max(0, level - 1);
  return {
    ...base,
    initialRows: Math.min(LEVEL_ROWS_MAX, base.initialRows + extra),
    dangerCap: Math.max(LEVEL_DANGER_MIN, base.dangerCap - extra),
    typeCount: Math.min(TYPE_COUNT_MAX, base.typeCount + Math.floor(extra / 2)),
  };
}
