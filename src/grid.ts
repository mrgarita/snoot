// 六角格子（odd-r オフセット）の盤面ロジック
// 行 r が偶数のとき列数 cols、奇数のとき cols-1 で右に半セルずれる。
// 天井降下は rowShift（視覚上のずれ）で表現し、格子の座標自体は変えない。
// 視覚上の行番号 = r + rowShift。r === 0 の行が常に天井に接している。

export interface Cell {
  r: number;
  c: number;
  type: number;
}

export class Board {
  readonly cols: number;
  /** 天井が降下した段数 */
  rowShift = 0;
  private cells = new Map<string, Cell>();

  constructor(cols: number) {
    this.cols = cols;
  }

  private key(r: number, c: number): string {
    return `${r},${c}`;
  }

  /** その行の列数（奇数行は 1 列少ない） */
  colsInRow(r: number): number {
    return r % 2 === 0 ? this.cols : this.cols - 1;
  }

  isValid(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && c < this.colsInRow(r);
  }

  get(r: number, c: number): Cell | undefined {
    return this.cells.get(this.key(r, c));
  }

  set(r: number, c: number, type: number): Cell {
    const cell: Cell = { r, c, type };
    this.cells.set(this.key(r, c), cell);
    return cell;
  }

  remove(r: number, c: number): void {
    this.cells.delete(this.key(r, c));
  }

  all(): Cell[] {
    return [...this.cells.values()];
  }

  get count(): number {
    return this.cells.size;
  }

  /** 盤面に現存するキャラ種類の一覧（次弾の抽選に使う） */
  presentTypes(): number[] {
    const s = new Set<number>();
    for (const cell of this.cells.values()) s.add(cell.type);
    return [...s];
  }

  /** odd-r オフセットでの隣接 6 マス */
  neighbors(r: number, c: number): Array<[number, number]> {
    const even = r % 2 === 0;
    const deltas: Array<[number, number]> = even
      ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
      : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
    return deltas
      .map(([dr, dc]) => [r + dr, c + dc] as [number, number])
      .filter(([nr, nc]) => this.isValid(nr, nc));
  }

  /** (r,c) と同種でつながるグループを返す */
  matchGroup(r: number, c: number): Cell[] {
    const start = this.get(r, c);
    if (!start) return [];
    const seen = new Set<string>([this.key(r, c)]);
    const group: Cell[] = [start];
    const queue: Cell[] = [start];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const [nr, nc] of this.neighbors(cur.r, cur.c)) {
        const k = this.key(nr, nc);
        if (seen.has(k)) continue;
        const n = this.get(nr, nc);
        if (n && n.type === start.type) {
          seen.add(k);
          group.push(n);
          queue.push(n);
        }
      }
    }
    return group;
  }

  /** 天井（r === 0 の行）につながっていない＝宙に浮いたセルを返す */
  floating(): Cell[] {
    const anchored = new Set<string>();
    const queue: Cell[] = [];
    for (const cell of this.cells.values()) {
      if (cell.r === 0) {
        anchored.add(this.key(cell.r, cell.c));
        queue.push(cell);
      }
    }
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const [nr, nc] of this.neighbors(cur.r, cur.c)) {
        const k = this.key(nr, nc);
        if (anchored.has(k)) continue;
        const n = this.get(nr, nc);
        if (n) {
          anchored.add(k);
          queue.push(n);
        }
      }
    }
    return this.all().filter((cell) => !anchored.has(this.key(cell.r, cell.c)));
  }

  /** 最下端のセルの視覚上の行番号（空なら -1） */
  maxVisualRow(): number {
    let max = -1;
    for (const cell of this.cells.values()) {
      max = Math.max(max, cell.r + this.rowShift);
    }
    return max;
  }
}
