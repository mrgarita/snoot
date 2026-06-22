// 着弾セルの決定（純粋ロジック・DOM 非依存でテスト可能）
// 衝突相手の手前で止まった弾を、ねらった線（進行方向 dir）が通る奥（天井側）の
// 空きセルまで前進させ、行き止まり手前の支持された空きセルに着地させる。
// 空きセルだけを辿るのでキャラ群を貫通しない。原作 Snood の配置許容範囲を再現する。
import { Board } from "./grid";
import { ROW_H } from "./config";

export interface PlacementParams {
  /** 奥へ前進する内積しきい値（dir と隣セル方向の cosθ の最小値。大=奥に入りにくい） */
  forwardMinDot: number;
  /** 前進先が射線（接触点を通る dir 直線）から離れてよい上限（cell 比の垂直距離） */
  maxPerp: number;
  /** 前進ループの安全上限 */
  maxSteps: number;
}

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

/**
 * (r,c) の空き隣接セルのうち、進行方向 (dirx,diry) に最も沿う 1 つを返す。
 * 条件：内積が forwardMinDot 以上（奥向きに十分沿う）かつ、隣セル中心が射線
 * （接触点 (ox,oy) を通る dir 直線）から maxPerp 以内（横滑り防止）。dir は単位ベクトル。
 */
export function forwardEmptyNeighbor(
  board: Board,
  cellPos: (r: number, c: number) => { x: number; y: number },
  r: number,
  c: number,
  ox: number,
  oy: number,
  dirx: number,
  diry: number,
  forwardMinDot: number,
  maxPerp: number,
): { r: number; c: number } | null {
  const from = cellPos(r, c);
  let best: { r: number; c: number; dot: number } | null = null;
  for (const [nr, nc] of board.neighbors(r, c)) {
    if (board.get(nr, nc)) continue; // 占有セルには入らない（貫通防止）
    const to = cellPos(nr, nc);
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const dot = ((to.x - from.x) * dirx + (to.y - from.y) * diry) / len;
    if (dot < forwardMinDot) continue;
    // 接触点を通る射線からの垂直距離（横滑り＝大きく逸れる前進を弾く）
    const perp = Math.abs(dirx * (to.y - oy) - diry * (to.x - ox));
    if (perp > maxPerp) continue;
    if (!best || dot > best.dot) best = { r: nr, c: nc, dot };
  }
  return best ? { r: best.r, c: best.c } : null;
}

/** (r,c) が支持されている（天井行 or 占有隣接あり）か */
function isSupported(board: Board, r: number, c: number): boolean {
  return (
    r === 0 || board.neighbors(r, c).some(([nr, nc]) => board.get(nr, nc))
  );
}

/**
 * 着弾セルを決める。
 * @returns 着地する空き＋支持セル。置き場が無ければ null。
 */
export function chooseLandingCell(
  board: Board,
  cellPos: (r: number, c: number) => { x: number; y: number },
  cell: number,
  contactX: number,
  contactY: number,
  dirx: number,
  diry: number,
  params: PlacementParams,
): { r: number; c: number } | null {
  // 起点＝着弾点に最も近い空きセル（衝突相手の手前側＝図の赤〇）
  const start = nearestEmptyCell(board, cellPos, cell, contactX, contactY);
  if (!start) return null;

  // 進行方向に沿って空きセルを前進し、通った空きセルを記録
  const path: Array<{ r: number; c: number }> = [start];
  let cur = start;
  for (let step = 0; step < params.maxSteps; step++) {
    const next = forwardEmptyNeighbor(
      board,
      cellPos,
      cur.r,
      cur.c,
      contactX,
      contactY,
      dirx,
      diry,
      params.forwardMinDot,
      params.maxPerp,
    );
    if (!next) break;
    cur = next;
    path.push(cur);
  }

  // 最も奥から手前へ見て、支持されている最初のセルに着地
  for (let i = path.length - 1; i >= 0; i--) {
    if (isSupported(board, path[i].r, path[i].c)) return path[i];
  }
  return null;
}
