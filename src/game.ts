// ゲーム本体：盤面描画・発射・マッチ判定・危険ゲージ・スコア・入力
import {
  DIFFICULTIES,
  DifficultyConfig,
  DifficultyId,
  MIN_COLS,
  ROWS_LIMIT,
  ROW_H,
  SHOT_SPEED,
  SCORE_POP,
  SCORE_DROP,
} from "./config";
import { Board, Cell } from "./grid";
import { drawSnoot } from "./characters";
import { sound } from "./audio";

type GameState = "aim" | "flying" | "over" | "clear";

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: number;
}

/** 消滅アニメーション */
interface PopAnim {
  x: number;
  y: number;
  type: number;
  t: number;
}

/** 落下アニメーション */
interface FallAnim {
  x: number;
  y: number;
  vy: number;
  vx: number;
  type: number;
}

export interface GameEndInfo {
  kind: "clear" | "gameover";
  score: number;
  level: number;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onEnd: (info: GameEndInfo) => void;

  private cfg: DifficultyConfig = DIFFICULTIES.easy;
  private board: Board = new Board(DIFFICULTIES.easy.cols);
  private state: GameState = "aim";
  private score = 0;
  private level = 1;
  private danger = 0;

  // 描画メトリクス（論理 px）
  private W = 0;
  private H = 0;
  private cell = 0; // セル直径
  private offsetX = 0; // 盤面左端
  private cannonX = 0;
  private cannonY = 0;

  private aimAngle = 0; // 真上 0、右が正（ラジアン）
  private projectile: Projectile | null = null;
  private currentType = 0;
  private nextType = 0;
  private pops: PopAnim[] = [];
  private falls: FallAnim[] = [];
  /** 表情アニメーション用の経過時間（秒） */
  private animTime = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  // HUD 要素
  private elScore = document.getElementById("hud-score")!;
  private elDangerFill = document.getElementById("danger-fill")!;
  private elLevel = document.getElementById("hud-level")!;
  private elDifficulty = document.getElementById("hud-difficulty")!;

  constructor(canvas: HTMLCanvasElement, onEnd: (info: GameEndInfo) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onEnd = onEnd;

    canvas.addEventListener("pointerdown", (e) => this.onPointer(e, false));
    canvas.addEventListener("pointermove", (e) => this.onPointer(e, false));
    canvas.addEventListener("pointerup", (e) => this.onPointer(e, true));
    window.addEventListener("resize", () => this.resize());
  }

  start(difficulty: DifficultyId, level = 1, carriedScore = 0): void {
    this.cfg = DIFFICULTIES[difficulty];
    this.level = level;
    this.score = carriedScore;
    this.danger = 0;
    this.board = new Board(this.cfg.cols);
    this.projectile = null;
    this.pops = [];
    this.falls = [];
    this.state = "aim";
    this.aimAngle = 0;

    // 初期配置：上から initialRows 行をランダムに埋める
    for (let r = 0; r < this.cfg.initialRows; r++) {
      for (let c = 0; c < this.board.colsInRow(r); c++) {
        this.board.set(r, c, this.randomType());
      }
    }
    this.currentType = this.pickShotType();
    this.nextType = this.pickShotType();

    this.elDifficulty.textContent = this.cfg.label;
    this.updateHud();
    this.resize();

    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  // ---------- 内部ロジック ----------

  private randomType(): number {
    return Math.floor(Math.random() * this.cfg.typeCount);
  }

  /** 発射弾の抽選：盤面に現存する種類のみから選ぶ（無駄弾を減らす＝原作後期版の仕様） */
  private pickShotType(): number {
    const types = this.board.presentTypes();
    if (types.length === 0) return this.randomType();
    return types[Math.floor(Math.random() * types.length)];
  }

  private resize(): void {
    const wrap = this.canvas.parentElement!;
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    if (availW === 0 || availH === 0) return;

    // 縦方向の行数換算（盤面 + 操作エリアの最小 3 セル分）
    const rowFactor = 1 + (ROWS_LIMIT - 1) * ROW_H + 3;

    // 盤面の横幅は難易度によらず一定にする（列数が増えるほどキャラが小さくなり、
    // 縦長・横長どちらの画面でも同じ見た目になる）。
    // 上限は「最小列数＝セルが最大になる難易度」でも縦が収まる幅。
    const maxBoardW = availH * ((MIN_COLS + 0.5) / rowFactor);
    const boardW = Math.min(availW, maxBoardW);
    this.cell = boardW / (this.cfg.cols + 0.5);

    this.W = boardW;
    // 縦は使える高さを全部使う。デッドラインから下の余白がすべて操作エリアになり、
    // 砲台を画面下端近くに置くことで、指がキャラや砲台にかぶらず照準できる
    this.H = availH;
    this.offsetX = 0;
    this.cannonX = this.W / 2;
    this.cannonY = this.H - this.cell * 1.6;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** セル (r,c) の描画中心座標 */
  private cellPos(r: number, c: number): { x: number; y: number } {
    const v = r + this.board.rowShift; // 視覚上の行
    const x =
      this.offsetX + this.cell / 2 + c * this.cell + (r % 2 === 1 ? this.cell / 2 : 0);
    const y = this.cell / 2 + v * ROW_H * this.cell;
    return { x, y };
  }

  /** 天井バンドの下端 y 座標 */
  private ceilingY(): number {
    return this.board.rowShift * ROW_H * this.cell;
  }

  private deadlineY(): number {
    return this.cell / 2 + ROWS_LIMIT * ROW_H * this.cell;
  }

  private onPointer(e: PointerEvent, isUp: boolean): void {
    sound.unlock();
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // 発射台から見た角度（真上 0、±80° に制限）。
    // 砲台より下に指がある間は角度を更新しない（画面下端での誤照準を防ぐ）
    const dx = px - this.cannonX;
    const dy = this.cannonY - py;
    if (dy > this.cell * 0.3) {
      const limit = (80 * Math.PI) / 180;
      this.aimAngle = Math.max(-limit, Math.min(limit, Math.atan2(dx, dy)));
    }

    if (isUp && this.state === "aim") {
      this.fire();
    }
  }

  private fire(): void {
    const speed = SHOT_SPEED * this.cell;
    this.projectile = {
      x: this.cannonX,
      y: this.cannonY,
      vx: Math.sin(this.aimAngle) * speed,
      vy: -Math.cos(this.aimAngle) * speed,
      type: this.currentType,
    };
    this.state = "flying";
    sound.play("shoot");
  }

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.animTime += dt;

    // 発射弾の移動（トンネリング防止のため小刻みに進める）
    if (this.projectile) {
      const p = this.projectile;
      const stepLen = this.cell * 0.25;
      const dist = Math.hypot(p.vx, p.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / stepLen));
      for (let i = 0; i < steps && this.projectile; i++) {
        p.x += (p.vx * dt) / steps;
        p.y += (p.vy * dt) / steps;

        // 壁で反射
        const left = this.offsetX + this.cell / 2;
        const right = this.offsetX + this.W - this.cell / 2;
        if (p.x < left) {
          p.x = left + (left - p.x);
          p.vx = -p.vx;
        } else if (p.x > right) {
          p.x = right - (p.x - right);
          p.vx = -p.vx;
        }

        if (this.hitsSomething(p)) {
          this.land(p);
        }
      }
    }

    // 消滅アニメーション
    for (const pop of this.pops) pop.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.3);

    // 落下アニメーション
    for (const f of this.falls) {
      f.vy += this.cell * 60 * dt; // 重力
      f.y += f.vy * dt;
      f.x += f.vx * dt;
    }
    this.falls = this.falls.filter((f) => f.y < this.H + this.cell);
  }

  /** 天井または既存ピースに接触したか */
  private hitsSomething(p: Projectile): boolean {
    if (p.y - this.cell / 2 <= this.ceilingY()) return true;
    const hitDist = this.cell * 0.85;
    for (const cell of this.board.all()) {
      const pos = this.cellPos(cell.r, cell.c);
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < hitDist) return true;
    }
    return false;
  }

  /** 着弾：最寄りの空きセルに吸着して消去判定へ */
  private land(p: Projectile): void {
    this.projectile = null;

    // 着弾点近傍の空きセルから、占有セル隣接または天井接触のものを距離順に選ぶ
    const vApprox = Math.round((p.y - this.cell / 2) / (ROW_H * this.cell));
    let best: { r: number; c: number; d: number } | null = null;
    for (let v = vApprox - 2; v <= vApprox + 2; v++) {
      const r = v - this.board.rowShift;
      if (r < 0) continue;
      for (let c = 0; c < this.board.colsInRow(r); c++) {
        if (this.board.get(r, c)) continue;
        const anchoredOk =
          r === 0 ||
          this.board.neighbors(r, c).some(([nr, nc]) => this.board.get(nr, nc));
        if (!anchoredOk) continue;
        const pos = this.cellPos(r, c);
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (!best || d < best.d) best = { r, c, d };
      }
    }

    if (!best) {
      // 置き場がない（理論上ほぼ起きない）：そのままターンを返す
      this.state = "aim";
      return;
    }

    this.board.set(best.r, best.c, p.type);
    sound.play("stick");
    this.resolve(best.r, best.c);
  }

  /** 着弾後の消去・落下・危険ゲージ・終了判定 */
  private resolve(r: number, c: number): void {
    let removed = 0;

    const group = this.board.matchGroup(r, c);
    if (group.length >= 3) {
      for (const cell of group) {
        const pos = this.cellPos(cell.r, cell.c);
        this.pops.push({ x: pos.x, y: pos.y, type: cell.type, t: 0 });
        this.board.remove(cell.r, cell.c);
      }
      removed += group.length;
      this.score += group.length * SCORE_POP;
      sound.play("pop", group.length);

      // 天井から切り離されたピースは落下
      const floats = this.board.floating();
      if (floats.length > 0) {
        for (const cell of floats) {
          const pos = this.cellPos(cell.r, cell.c);
          this.falls.push({
            x: pos.x,
            y: pos.y,
            vy: -this.cell * 2,
            vx: (Math.random() - 0.5) * this.cell * 4,
            type: cell.type,
          });
          this.board.remove(cell.r, cell.c);
        }
        removed += floats.length;
        // 落下除去は高得点（まとめて落とすほどボーナス）
        this.score += floats.length * SCORE_DROP + (floats.length >= 4 ? floats.length * 10 : 0);
        sound.play("drop", floats.length);
      }
    }

    // 危険ゲージ：1 発につき +1、消した数だけ減る（原作の仕組みを簡略化）
    this.danger = Math.max(0, this.danger + 1 - removed);
    if (this.danger >= this.cfg.dangerCap) {
      this.danger = 0;
      this.board.rowShift += 1;
      sound.play("alarm");
    }

    this.updateHud();

    // 終了判定
    if (this.board.count === 0) {
      this.state = "clear";
      this.score += 500 + this.cfg.dangerCap * 20;
      this.updateHud();
      sound.play("clear");
      this.onEnd({ kind: "clear", score: this.score, level: this.level });
      return;
    }
    if (this.board.maxVisualRow() >= ROWS_LIMIT) {
      this.state = "over";
      sound.play("gameover");
      this.onEnd({ kind: "gameover", score: this.score, level: this.level });
      return;
    }

    // 次弾を装填
    this.currentType = this.nextType;
    // 盤面から消えた種類なら抽選し直す
    if (!this.board.presentTypes().includes(this.currentType)) {
      this.currentType = this.pickShotType();
    }
    this.nextType = this.pickShotType();
    this.state = "aim";
  }

  private updateHud(): void {
    this.elScore.textContent = String(this.score);
    this.elLevel.textContent = `Lv.${this.level}`;
    const pct = Math.min(100, (this.danger / this.cfg.dangerCap) * 100);
    this.elDangerFill.style.width = `${pct}%`;
  }

  // ---------- 描画 ----------

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // 盤面背景
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, this.W, this.H);

    // 天井バンド
    const cy = this.ceilingY();
    if (cy > 0) {
      ctx.fillStyle = "#55432c";
      ctx.fillRect(0, 0, this.W, cy);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(this.W, cy);
      ctx.stroke();
    }

    // デッドライン
    const dy = this.deadlineY();
    ctx.strokeStyle = "rgba(231,76,60,0.7)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, dy);
    ctx.lineTo(this.W, dy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 盤面のピース（セルごとに位相をずらし、一斉まばたきを防ぐ）
    for (const cell of this.board.all()) {
      const pos = this.cellPos(cell.r, cell.c);
      const phase = ((cell.r * 7 + cell.c * 13) % 17) * 0.37;
      drawSnoot(ctx, cell.type, pos.x, pos.y, this.cell / 2, this.animTime + phase);
    }

    // 消滅アニメーション（膨らみつつフェードアウト）
    for (const pop of this.pops) {
      const k = pop.t / 0.3;
      ctx.globalAlpha = 1 - k;
      // 驚き顔で膨らみながら消えていく（コミカル演出）
      drawSnoot(ctx, pop.type, pop.x, pop.y, (this.cell / 2) * (1 + k * 0.5), this.animTime, true);
      ctx.globalAlpha = 1;
    }

    // 落下アニメーション（驚き顔のまま飛び散らせて迫力を出す）
    for (const f of this.falls) {
      drawSnoot(ctx, f.type, f.x, f.y, this.cell / 2, this.animTime, true);
    }

    // 照準ガイド（壁 1 回反射まで点線で表示）
    if (this.state === "aim") {
      this.renderAimGuide(ctx);
    }

    // 発射弾
    if (this.projectile) {
      drawSnoot(
        ctx,
        this.projectile.type,
        this.projectile.x,
        this.projectile.y,
        this.cell / 2,
        this.animTime,
      );
    }

    // 発射台
    this.renderCannon(ctx);
  }

  private renderAimGuide(ctx: CanvasRenderingContext2D): void {
    const left = this.offsetX + this.cell / 2;
    const right = this.offsetX + this.W - this.cell / 2;
    let x = this.cannonX;
    let y = this.cannonY;
    let dx = Math.sin(this.aimAngle);
    let dy = -Math.cos(this.aimAngle);
    let remain = this.H * 1.2;

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let bounce = 0; bounce < 3 && remain > 0; bounce++) {
      // 壁か天井までの距離
      let t = remain;
      if (dx > 0) t = Math.min(t, (right - x) / dx);
      else if (dx < 0) t = Math.min(t, (left - x) / dx);
      const tCeil = (this.ceilingY() + this.cell / 2 - y) / dy;
      if (tCeil > 0) t = Math.min(t, tCeil);
      x += dx * t;
      y += dy * t;
      ctx.lineTo(x, y);
      remain -= t;
      if (y <= this.ceilingY() + this.cell / 2 + 0.5) break;
      dx = -dx;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderCannon(ctx: CanvasRenderingContext2D): void {
    // 台座
    ctx.fillStyle = "#3a4a63";
    ctx.beginPath();
    ctx.arc(this.cannonX, this.cannonY, this.cell * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // 砲身（照準方向）
    ctx.strokeStyle = "#b8c4d6";
    ctx.lineWidth = this.cell * 0.22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.cannonX, this.cannonY);
    ctx.lineTo(
      this.cannonX + Math.sin(this.aimAngle) * this.cell * 1.1,
      this.cannonY - Math.cos(this.aimAngle) * this.cell * 1.1,
    );
    ctx.stroke();

    // 現在弾（発射中は表示しない）
    if (this.state === "aim") {
      drawSnoot(ctx, this.currentType, this.cannonX, this.cannonY, this.cell / 2, this.animTime);
    }

    // NEXT 表示（誤認防止のため表情は動かさない＝アニメ時刻を渡さない）
    const nx = this.cannonX + this.cell * 2.2;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${this.cell * 0.32}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("NEXT", nx, this.cannonY - this.cell * 0.7);
    drawSnoot(ctx, this.nextType, nx, this.cannonY, this.cell * 0.35);
  }
}
