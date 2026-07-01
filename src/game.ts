// ゲーム本体：盤面描画・発射・マッチ判定・危険ゲージ・スコア・入力
import {
  DIFFICULTIES,
  DifficultyConfig,
  DifficultyId,
  ROWS_LIMIT,
  ROW_H,
  SHOT_SPEED,
  CEILING_DROP_DUR,
  GAMEOVER_SEQ_DUR,
  SCORE_POP,
  SCORE_DROP,
  SCORE_LEVEL_BONUS,
  SHOT_BONUS_PAR_DIV,
  SHOT_BONUS_PER,
  SHOT_BONUS_CAP,
  effectiveConfig,
} from "./config";
import { Board, Cell } from "./grid";
import { nearestEmptyCell, resolveLanding } from "./placement";
import { drawSnoot, drawSkull } from "./characters";
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
  /** このレベルでの発射回数 */
  shots: number;
  /** クリア時のショットボーナス（少ない発射数で加点。gameover 時は 0） */
  bonus: number;
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
  /** このレベルでの発射回数（ショットボーナス算出に使う） */
  private shots = 0;
  /** このレベル開始時のピース数（ショットボーナスの par 算出に使う） */
  private initialCount = 0;

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
  /** 天井降下アニメの残量（1→0 に減衰。1 のとき論理位置より 1 行ぶん上に描画＝降りる前） */
  private dropAnim = 0;
  /**
   * 終了情報の保留。降下アニメ・骸骨化シーケンスを見せ切ってから onEnd で通知するために使う。
   */
  private pendingEnd: GameEndInfo | null = null;
  /**
   * ゲームオーバー演出（骸骨化ウェーブ）の経過秒。0=非実行。
   * GAMEOVER_SEQ_DUR に達すると pendingEnd を onEnd で通知する。以降は DUR で据え置き、
   * 結果画面の背後に骸骨化した盤面を残す（次の start() で 0 に戻す）。
   */
  private gameoverSeq = 0;
  /** 表情アニメーション用の経過時間（秒） */
  private animTime = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  /** 開発者向け：着地予測の表示。URL に ?debug を付けると初期 ON、PC では d キーで切替 */
  private debug = false;

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

    // 開発者向け：?debug（または #debug）で着地予測を初期 ON、d キーで切替
    this.debug = /[?&#]debug\b/.test(location.search + location.hash);
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return; // 名前入力中などは無視
      if (e.key === "d" || e.key === "D") this.debug = !this.debug;
    });
  }

  start(difficulty: DifficultyId, level = 1, carriedScore = 0): void {
    // 選んだ難易度を起点に、レベルに応じて段階的に難化させた実効設定で開始する
    this.cfg = effectiveConfig(DIFFICULTIES[difficulty], level);
    this.level = level;
    this.score = carriedScore;
    this.danger = 0;
    this.shots = 0;
    this.board = new Board(this.cfg.cols);
    this.projectile = null;
    this.pops = [];
    this.falls = [];
    this.dropAnim = 0;
    this.pendingEnd = null;
    this.gameoverSeq = 0;
    this.state = "aim";
    this.aimAngle = 0;

    // 初期配置：上から initialRows 行をランダムに埋める
    for (let r = 0; r < this.cfg.initialRows; r++) {
      for (let c = 0; c < this.board.colsInRow(r); c++) {
        this.board.set(r, c, this.randomType());
      }
    }
    // 初期ピース数を記録（ショットボーナスの par 算出に使う）
    this.initialCount = this.board.count;
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

  /** 現在の run の得点（途中離脱時のハイスコア記録に使う） */
  getScore(): number {
    return this.score;
  }

  /** 現在の run の到達レベル */
  getLevel(): number {
    return this.level;
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

    // 盤面幅は「幅優先」で決める。まず盤面を画面全幅にして両端フラッシュを最優先する
    // （偶数行＝最上段などが左右の壁にぴったり接する）。ホーム画面追加前の Safari
    // 表示のように下部ツールバーで縦が縮む環境でも、左右いっぱいに出すのが狙い。
    // 難易度が上がる（列数が増える）ほど 1 個が小さくなるが、盤面幅は常に全幅で揃う。
    let boardW = availW;
    let cell = boardW / this.cfg.cols;

    // ただし縦が破綻しないよう、デッドライン下に最低限の操作エリアは確保する。
    // 必要縦セル数 = デッドライン(0.5 + ROWS_LIMIT*ROW_H) + 操作エリアの最小余白(OP_MIN)。
    // これも収まらない極端に低いビューポートのときだけ、高さ基準で縮める（左右に余白）。
    // OP_MIN は「どの高さで全幅に切り替わるか」を決める値。iPhone 8 の Safari 通常表示
    // （枠の高さ availH ≈ 510px 前後）でも全幅になるよう 1.2 とする。この高さでの砲台は
    // デッドライン直下ぎりぎり（現状 v0.9.18 のブラウザ表示と同じ見た目）に収まる。
    const OP_MIN = 1.2;
    const neededCells = 0.5 + ROWS_LIMIT * ROW_H + OP_MIN;
    if (cell * neededCells > availH) {
      cell = availH / neededCells;
      boardW = cell * this.cfg.cols;
    }
    this.cell = cell;

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

    // 盤面が画面全幅のとき（スマホ）は左右余白＝ボールの跳ね返り壁が存在しない。
    // この場合だけ枠（#canvas-wrap）を盤面色に揃える。盤面下端のサブピクセル隙間や
    // iOS スタンドアロンのレイアウト外帯に枠色（#213654）が覗いて横線になるのを防ぐ。
    // 左右余白が出る PC では枠色を残し、壁の目印を維持する。
    wrap.classList.toggle("board-fullwidth", boardW >= availW - 0.5);
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

    // 天井降下のスライド中は発射をロックする（誤発射を防ぎ、緊張の間をつくる）
    if (isUp && this.state === "aim" && this.dropAnim === 0) {
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
    this.shots++;
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

    // 天井降下のスライドを進める。降り切った瞬間に、保留していたゲームオーバーがあれば
    // 骸骨化シーケンスを開始する（降下を見せてから骸骨化→結果画面の順に演出する）。
    if (this.dropAnim > 0) {
      this.dropAnim = Math.max(0, this.dropAnim - dt / CEILING_DROP_DUR);
      if (this.dropAnim === 0 && this.pendingEnd && this.gameoverSeq === 0) {
        this.startGameoverSequence();
      }
    }

    // ゲームオーバー演出（骸骨化ウェーブ）を進める。見せ切ったら結果画面を通知する。
    if (this.gameoverSeq > 0) {
      this.gameoverSeq = Math.min(GAMEOVER_SEQ_DUR, this.gameoverSeq + dt);
      if (this.gameoverSeq >= GAMEOVER_SEQ_DUR && this.pendingEnd) {
        const end = this.pendingEnd;
        this.pendingEnd = null;
        this.onEnd(end);
      }
    }

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

        const landed = this.hitCell(p.x, p.y);
        if (landed) this.land(p, landed);
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

  /**
   * 弾の現在中心 (x,y) で着地すべきか判定し、着地セルを返す（まだ飛ぶなら null）。
   * 天井に達したら天井直下の空きセルへ、そうでなければ最近傍セル（ボロノイ）方式で
   * 「埋まりセルの領域に入った瞬間に直前の空きセルへ」着地する（placement.ts）。
   * 弾の幅を通り道では考慮しないので、ねらった射線どおり奥のくぼみへ滑り込める。
   */
  private hitCell(x: number, y: number): { r: number; c: number } | null {
    const cellPos = (r: number, c: number) => this.cellPos(r, c);
    if (y - this.cell / 2 <= this.ceilingY()) {
      return nearestEmptyCell(this.board, cellPos, this.cell, x, y);
    }
    return resolveLanding(this.board, cellPos, this.cell, x, y);
  }

  /** 着弾：確定した空きセルに弾を吸着させ、消去判定へ。 */
  private land(p: Projectile, landed: { r: number; c: number }): void {
    this.projectile = null;
    this.board.set(landed.r, landed.c, p.type);
    sound.play("stick");
    this.resolve(landed.r, landed.c);
  }

  /**
   * 開発者向け：現在の照準で発射した場合の着地セルを予測する。
   * 実弾と同じ移動（壁反射・サブステップ）・衝突・着弾ロジックを使うので、
   * 表示されたセルに実際に着地する（着地予測の検証に使える）。
   */
  private predictLanding(): { r: number; c: number } | null {
    const speed = SHOT_SPEED * this.cell;
    const p: Projectile = {
      x: this.cannonX,
      y: this.cannonY,
      vx: Math.sin(this.aimAngle) * speed,
      vy: -Math.cos(this.aimAngle) * speed,
      type: this.currentType,
    };
    const stepLen = this.cell * 0.25;
    const left = this.offsetX + this.cell / 2;
    const right = this.offsetX + this.W - this.cell / 2;
    const maxIter = Math.ceil((this.H * 4) / stepLen) + 10; // 反射込みの十分な上限
    for (let i = 0; i < maxIter; i++) {
      const len = Math.hypot(p.vx, p.vy) || 1;
      p.x += (p.vx / len) * stepLen;
      p.y += (p.vy / len) * stepLen;
      if (p.x < left) {
        p.x = left + (left - p.x);
        p.vx = -p.vx;
      } else if (p.x > right) {
        p.x = right - (p.x - right);
        p.vx = -p.vx;
      }
      const landed = this.hitCell(p.x, p.y);
      if (landed) return landed;
      if (p.y < -this.cell) break; // 安全：画面上に抜けた
    }
    return null;
  }

  /** 開発者向け：着地予測セルをリングと座標で重ね描きする */
  private renderLandingPreview(ctx: CanvasRenderingContext2D): void {
    const pred = this.predictLanding();
    ctx.save();
    if (pred) {
      const pos = this.cellPos(pred.r, pred.c);
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, this.cell / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#00e5ff";
      ctx.font = `bold ${Math.max(10, this.cell * 0.3)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`${pred.r},${pred.c}`, pos.x, pos.y - this.cell * 0.62);
    }
    ctx.fillStyle = "#00e5ff";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("DEBUG 着地予測 ON（d キーで切替）", 6, this.H - 8);
    ctx.restore();
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
      // 即時に下げず、描画側で 1 行ぶんスライドさせる（怖さの演出）＋低い地鳴り
      this.dropAnim = 1;
      sound.play("quake");
    }

    this.updateHud();

    // 終了判定
    if (this.board.count === 0) {
      this.state = "clear";
      // クリアボーナス：基本点＋残ゲージ余裕＋レベルが上がるほど増える加点
      this.score += 500 + this.cfg.dangerCap * 20 + (this.level - 1) * SCORE_LEVEL_BONUS;
      // ショットボーナス（②b）：par より少ない発射数でクリアするほど加点
      const par = Math.ceil(this.initialCount / SHOT_BONUS_PAR_DIV);
      const bonus = Math.min(SHOT_BONUS_CAP, Math.max(0, par - this.shots) * SHOT_BONUS_PER);
      this.score += bonus;
      this.updateHud();
      sound.play("clear");
      this.onEnd({ kind: "clear", score: this.score, level: this.level, shots: this.shots, bonus });
      return;
    }
    if (this.board.maxVisualRow() >= ROWS_LIMIT) {
      this.state = "over";
      this.pendingEnd = {
        kind: "gameover",
        score: this.score,
        level: this.level,
        shots: this.shots,
        bonus: 0,
      };
      // 即・結果画面ではなく、骸骨化ウェーブ（②a）を見せ切ってから onEnd で通知する。
      // 天井降下中なら、まずスライドを見せ切ってから（update 内で）シーケンスを開始する。
      if (this.dropAnim === 0) this.startGameoverSequence();
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

  /** ゲームオーバー演出（②a）を開始する。暗い重低音を鳴らし、骸骨化ウェーブを走らせる。 */
  private startGameoverSequence(): void {
    this.gameoverSeq = 1e-6; // >0 で実行中（経過は update で加算）
    sound.play("doom");
  }

  // ---------- 描画 ----------

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // 盤面背景：背後の #canvas-wrap 色に依存しないよう不透明の盤面色 --play-bg で塗る。
    // 半透明（rgba 黒×0.25）だと全幅時に wrap 色×0.75 で実効色が変わり、版数表示部の
    // 下端帯と色差が出てしまうため、実効色を #19283f に固定する（#14 追従）
    ctx.fillStyle = "#19283f";
    ctx.fillRect(0, 0, this.W, this.H);

    // 天井降下アニメの見かけのオフセット（px）。論理座標は動かさず描画だけずらす。
    // smoothstep で緩急をつけ、岩天井が「ジリッ」と降りてくるようにする。
    const off = this.dropAnim * this.dropAnim * (3 - 2 * this.dropAnim);
    const dropPx = off * ROW_H * this.cell;

    // 天井バンド（岩肌＋下端ギザギザ）。降下中は見かけの下端を 1 行ぶん上げて描く。
    const cy = this.ceilingY();
    if (cy > 0) {
      this.renderRockyCeiling(ctx, cy - dropPx);
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

    // 盤面のピース（セルごとに位相をずらし、一斉まばたきを防ぐ）。
    // 天井と一緒に降下スライドさせるため dropPx ぶん上へずらして描く。
    // ゲームオーバー演出中（②a）は、下のセルほど早く骸骨へ変化させる「下→上のウェーブ」。
    const deadline = this.deadlineY();
    for (const cell of this.board.all()) {
      const pos = this.cellPos(cell.r, cell.c);
      const x = pos.x;
      const y = pos.y - dropPx;
      if (this.gameoverSeq > 0) {
        // yNorm: 0=上, 1=下。下（y 大）ほど revealAt が小さく＝先に骸骨化する。
        const yNorm = Math.max(0, Math.min(1, y / deadline));
        const revealAt = (1 - yNorm) * GAMEOVER_SEQ_DUR * 0.8;
        const since = this.gameoverSeq - revealAt;
        if (since >= 0) {
          const popK = since < 0.15 ? 1 - since / 0.15 : 0; // 変化直後だけポップ
          drawSkull(ctx, x, y, this.cell / 2, popK);
          continue;
        }
      }
      const phase = ((cell.r * 7 + cell.c * 13) % 17) * 0.37;
      drawSnoot(ctx, cell.type, x, y, this.cell / 2, this.animTime + phase);
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
      // 開発者向け：着地予測の重ね描き
      if (this.debug) this.renderLandingPreview(ctx);
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

  /**
   * 岩っぽい天井バンドを描く（著作権配慮でコード描画・画像は使わない）。
   * edgeY は見かけの下端 y（降下アニメ中は 1 行ぶん上がる）。
   * 地層・スペックル・下端のギザギザ岩は整数インデックスのハッシュで決定論的に
   * 生成し、毎フレームのちらつきを防ぐ。
   */
  private renderRockyCeiling(ctx: CanvasRenderingContext2D, edgeY: number): void {
    const W = this.W;
    if (edgeY <= 0) return;
    // 0〜1 を返す決定論的ハッシュ（i ごとに固定値）
    const h = (i: number): number => {
      const x = Math.sin(i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    ctx.save();

    // 帯本体：上が暗く下が明るい石肌のグラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, edgeY);
    grad.addColorStop(0, "#2c2622");
    grad.addColorStop(1, "#4a423a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, edgeY);

    // 地層（暗い横線）
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = edgeY * (i / 4) + (h(i) - 0.5) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // スペックル（岩肌の粒。明暗を散らす）
    const dots = Math.floor((W * edgeY) / 900);
    for (let i = 0; i < dots; i++) {
      const x = h(i * 2 + 1) * W;
      const y = h(i * 2 + 2) * edgeY;
      const r = 0.6 + h(i + 7) * 1.2;
      ctx.fillStyle = h(i + 3) > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 下端のギザギザ岩（鍾乳石風の歯）。edgeY を基準に下へ突き出す。
    const step = Math.max(10, this.cell * 0.7);
    const n = Math.ceil(W / step) + 1;
    ctx.beginPath();
    ctx.moveTo(0, edgeY);
    for (let i = 0; i < n; i++) {
      const x0 = i * step;
      const xMid = x0 + step / 2;
      const x1 = x0 + step;
      const depth = this.cell * (0.18 + h(i) * 0.22); // 歯の長さに変化をつける
      ctx.lineTo(xMid, edgeY + depth);
      ctx.lineTo(Math.min(W, x1), edgeY);
    }
    ctx.lineTo(W, edgeY);
    ctx.closePath();
    ctx.fillStyle = "#3b342d";
    ctx.fill();

    // 歯の輪郭（暗い影）で立体感を出す
    ctx.strokeStyle = "#1c1814";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 下端に明るいリムを 1 本入れて岩の張り出し感を強める
    ctx.strokeStyle = "rgba(150,140,125,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, edgeY - 1);
    ctx.lineTo(W, edgeY - 1);
    ctx.stroke();

    ctx.restore();
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
