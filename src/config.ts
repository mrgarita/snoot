// 難易度設定とゲーム定数
// 値の根拠は docs/site/step1-research.html（Snood 調査）を参照。
// 原作の列数（14〜17）はスマホでは 1 個が小さくなりすぎるため抑えめにしている。

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
