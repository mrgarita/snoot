// 着弾セルの決定（純粋ロジック・DOM 非依存でテスト可能）
// 原作 Snood の「弾の幅を通り道では考慮しない」挙動を最近傍セル（ボロノイ）方式で再現する。
// 弾の中心がいま最も近いセルが空きなら通過し、埋まったセルの領域に入った瞬間に、
// その直前まで居た空きセルへ着地する。弾の幅は着地先セルでだけ効き、入口の「肩」には
// 引っかからないので、ねらった射線どおりに奥のくぼみへ滑り込める（HIT_DIST_RATIO や
// SETTLE_* のような調整パラメータは不要）。
import { Board } from "./grid";
import { ROW_H } from "./config";

/** ピクセル座標 (x,y) に最も近い空きセル（支持の有無は問わない）。近傍 ±2 視覚行を走査 */
export function nearestEmptyCell(
  board: Board,
  cellPos: (r: number, c: number) => { x: number; y: number },
  cell: number,
  x: number,
  y: number,
): { r: number; c: number } | null {
  const vApprox = Math.round((y - cell / 2) / (ROW_H * cell));
  let best: { r: number; c: number; d: number } | null = null;
  for (let v = vApprox - 2; v <= vApprox + 2; v++) {
    const r = v - board.rowShift;
    if (r < 0) continue;
    for (let c = 0; c < board.colsInRow(r); c++) {
      if (board.get(r, c)) continue;
      const pos = cellPos(r, c);
      const d = Math.hypot(x - pos.x, y - pos.y);
      if (!best || d < best.d) best = { r, c, d };
    }
  }
  return best ? { r: best.r, c: best.c } : null;
}

/** ピクセル座標 (x,y) に最も近い「埋まっているセル」中心までの距離。盤面が空なら Infinity */
export function nearestOccupiedDist(
  board: Board,
  cellPos: (r: number, c: number) => { x: number; y: number },
  x: number,
  y: number,
): number {
  let best = Infinity;
  for (const cell of board.all()) {
    const pos = cellPos(cell.r, cell.c);
    const d = Math.hypot(x - pos.x, y - pos.y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 弾の現在中心 (x,y) で着地すべきかを判定し、着地セルを返す（まだ飛行を続けるなら null）。
 * 最近接の埋まりセルが最近接の空きセルより近い＝弾の中心がボロノイ境界を越えて埋まりセルの
 * 領域に入った瞬間に、その（直前まで居た）空きセルへ着地する。
 *  - 着地セルは衝突した埋まりセルに隣接するため、必ず支持されている（落下しない）。
 *  - 隣り合う 2 つの埋まりセルの境界は両側とも occupied なので、間をすり抜けない（壁抜け防止）。
 *  - 実在する空きセルの領域を中心が通る場合だけ奥へ進める＝原作の配置許容を再現する。
 * 天井への着地は呼び出し側（ピクセル比較）で扱う。置き場が無ければ null（着地させない）。
 */
export function resolveLanding(
  board: Board,
  cellPos: (r: number, c: number) => { x: number; y: number },
  cell: number,
  x: number,
  y: number,
): { r: number; c: number } | null {
  const empty = nearestEmptyCell(board, cellPos, cell, x, y);
  if (!empty) return null; // 極端に密で近傍に空きが無い：着地させず飛行を続ける安全側
  const pos = cellPos(empty.r, empty.c);
  const dEmpty = Math.hypot(x - pos.x, y - pos.y);
  const dOcc = nearestOccupiedDist(board, cellPos, x, y);
  // まだ空きセルの領域内なら飛行継続。埋まりセルの方が近くなったら着地。
  return dOcc < dEmpty ? empty : null;
}
