// Snoot のオリジナルキャラクター描画（デザイン案 1c：モノクロ）
// 著作権配慮のため Snood のキャラクターは使わず、全キャラを Canvas でコード描画する。
// 白・黒・グレーだけを使い、7 種を「模様と形」で区別する新聞漫画／ゲームボーイ的な世界観。
// 色を使わないので「青（マルオ）と緑（ハッパ）が見分けにくい」という問題自体が消える
// （色覚に依存しない＝無地／斜め縞＋葉／黒ベタ／水玉／灰／二重丸／角形の 7 模様で判別）。

/** 各種の地の明度（模様は drawSnoot 側で重ねる）。順序は他案と共通 */
export const TYPE_COLORS = [
  "#ffffff", // 0: マルオ（白無地）
  "#ffffff", // 1: ハッパ（白＋斜め縞＋葉）
  "#181818", // 2: プンタ（黒ベタ）
  "#ffffff", // 3: ヒナタ（白＋水玉）
  "#9a9a9a", // 4: ネムリ（灰）
  "#ffffff", // 5: ビック（白＋内側二重丸）
  "#4a4a4a", // 6: イシゴロ（濃灰の角形）
];

export const TYPE_COUNT_MAX = TYPE_COLORS.length;

/** Canvas 内テキストの書体。DOM 側（style.css の --font-body）と揃えて統一する */
export const CANVAS_FONT = '"M PLUS Rounded 1c", sans-serif';

/** キャラクター名（TYPE_COLORS と同順） */
export const TYPE_NAMES = ["マルオ", "ハッパ", "プンタ", "ヒナタ", "ネムリ", "ビック", "イシゴロ"];

/** インク（黒）と紙（白）。モノクロ案の 2 原色 */
const INK = "#181818";
const PAPER = "#ffffff";

/** まばたき判定：周期 cycle 秒のうち先頭 dur 秒だけ目を閉じる */
function isBlinking(t: number, cycle: number, dur: number): boolean {
  return t % cycle < dur;
}

/**
 * 種類 type のキャラを中心 (cx, cy)・半径 r で描画する。
 * t（秒）を渡すと表情がコミカルに変化する。省略時は静的な顔
 * （NEXT 表示は誤認防止のため意図的に t を渡さない）。
 */
export function drawSnoot(
  ctx: CanvasRenderingContext2D,
  type: number,
  cx: number,
  cy: number,
  r: number,
  t?: number,
  surprised = false,
): void {
  const anim = t !== undefined;
  const tt = t ?? 0;
  const kind = type % TYPE_COLORS.length;
  ctx.save();
  ctx.translate(cx, cy);

  const lw = r * 0.12; // アウトラインの太さ
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /** 本体の丸（イシゴロ以外の共通シルエット） */
  const bodyPath = (): void => {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  };
  /** 本体の内側だけに模様を描く（白地で塗ってから pat() を重ねる） */
  const patternFill = (pat: () => void): void => {
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    pat();
    ctx.restore();
  };

  // 顔パーツの色。黒ベタ・濃灰の体だけ白抜きにする
  let fg = INK;

  switch (kind) {
    case 0: // マルオ：白無地
      bodyPath();
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    case 1: // ハッパ：斜め縞（葉は後述の共通部で描く）
      patternFill(() => {
        ctx.strokeStyle = "#b9b9b4";
        ctx.lineWidth = r * 0.09;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.38 - r, r);
          ctx.lineTo(i * r * 0.38 + r, -r);
          ctx.stroke();
        }
      });
      bodyPath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    case 2: // プンタ：黒ベタ（顔は白抜き）
      bodyPath();
      ctx.fillStyle = INK;
      ctx.fill();
      fg = PAPER;
      break;
    case 3: // ヒナタ：水玉
      patternFill(() => {
        ctx.fillStyle = "#c4c4bf";
        for (let gy = -2; gy <= 2; gy++) {
          for (let gx = -2; gx <= 2; gx++) {
            ctx.beginPath();
            ctx.arc(gx * r * 0.42 + (gy % 2 ? r * 0.21 : 0), gy * r * 0.42, r * 0.08, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      bodyPath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    case 4: // ネムリ：灰ベタ
      bodyPath();
      ctx.fillStyle = "#9a9a9a";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      break;
    case 5: // ビック：白地＋内側の二重丸
      bodyPath();
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.lineWidth = lw * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 6: { // イシゴロ：濃灰の角丸四角（顔は白抜き）
      const s = r * 0.84;
      ctx.beginPath();
      roundRect(ctx, -s, -s, s * 2, s * 2, r * 0.2);
      ctx.fillStyle = "#4a4a4a";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      fg = PAPER;
      break;
    }
  }

  // ハッパの葉っぱは表情にかかわらず描く（キャラの個性＝形での判別を保つ）
  if (kind === 1) {
    const sway = anim && !surprised ? 0.35 * Math.sin(tt * 1.8) : 0;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, -r * 1.0, r * 0.3, r * 0.16, -0.55 + sway, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 顔パーツ
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = Math.max(1, r * 0.1);
  const eyeY = -r * 0.15;
  const eyeX = r * 0.32;
  /** 目の白／黒は体の明度で反転させる（模様の上でも必ずコントラストが立つ） */
  const bg = fg === INK ? PAPER : INK;

  // 驚き顔（消滅エフェクト用・全種共通）：体の個性は残し顔だけ差し替える
  if (surprised) {
    ctx.fillStyle = fg;
    dot(ctx, -eyeX, eyeY, r * 0.2);
    dot(ctx, eyeX, eyeY, r * 0.2);
    ctx.fillStyle = bg;
    dot(ctx, -eyeX, eyeY, r * 0.07);
    dot(ctx, eyeX, eyeY, r * 0.07);
    // 大きく開いた口
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // コミック風の驚き線（インクの線で描く）
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    for (const a of [-2.2, -Math.PI / 2, -0.95]) {
      line(
        ctx,
        Math.cos(a) * r * 1.05,
        Math.sin(a) * r * 1.05,
        Math.cos(a) * r * 1.35,
        Math.sin(a) * r * 1.35,
      );
    }
    ctx.restore();
    return;
  }

  switch (kind) {
    case 0: { // マルオ：丸目＋にっこり口。まばたきし、口がゆれる
      if (anim && isBlinking(tt, 3.1, 0.18)) {
        line(ctx, -eyeX - r * 0.12, eyeY, -eyeX + r * 0.12, eyeY);
        line(ctx, eyeX - r * 0.12, eyeY, eyeX + r * 0.12, eyeY);
      } else {
        dot(ctx, -eyeX, eyeY, r * 0.14);
        dot(ctx, eyeX, eyeY, r * 0.14);
      }
      const rm = r * 0.35 * (anim ? 1 + 0.08 * Math.sin(tt * 2.2) : 1);
      arcMouth(ctx, 0, r * 0.22, rm, 0.15 * Math.PI, 0.85 * Math.PI);
      break;
    }
    case 1: { // ハッパ：まばたき（葉っぱの揺れは共通部で描画済み）
      if (anim && isBlinking(tt, 3.7, 0.18)) {
        line(ctx, -eyeX - r * 0.12, eyeY, -eyeX + r * 0.12, eyeY);
        line(ctx, eyeX - r * 0.12, eyeY, eyeX + r * 0.12, eyeY);
      } else {
        dot(ctx, -eyeX, eyeY, r * 0.13);
        dot(ctx, eyeX, eyeY, r * 0.13);
      }
      arcMouth(ctx, 0, r * 0.28, r * 0.24, 0.2 * Math.PI, 0.8 * Math.PI);
      break;
    }
    case 2: { // プンタ：怒り眉がピクピク上下し、への字口がふるえる
      const jitter = anim ? r * 0.06 * Math.sin(tt * 8) : 0;
      line(ctx, -eyeX - r * 0.16, eyeY - r * 0.24 + jitter, -eyeX + r * 0.12, eyeY - r * 0.06);
      line(ctx, eyeX + r * 0.16, eyeY - r * 0.24 + jitter, eyeX - r * 0.12, eyeY - r * 0.06);
      dot(ctx, -eyeX, eyeY + r * 0.1, r * 0.12);
      dot(ctx, eyeX, eyeY + r * 0.1, r * 0.12);
      arcMouth(ctx, 0, r * 0.58 - jitter * 0.5, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI);
      break;
    }
    case 3: { // ヒナタ：星の目がキラキラ拡縮し、ベロ〜んと出した舌がのび縮みする
      const tw = anim ? 1 + 0.25 * Math.sin(tt * 5) : 1;
      const tw2 = anim ? 1 + 0.25 * Math.sin(tt * 5 + 1.6) : 1;
      star(ctx, -eyeX, eyeY, r * 0.18 * tw);
      star(ctx, eyeX, eyeY, r * 0.18 * tw2);
      // 開いた口（上半分の塗り）
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.3, r * 0.18, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      // 舌：白地＋インクのアウトライン。模様（水玉）に加えて「形」でも判別できる
      const tip = r * 0.74 * (anim ? 1 + 0.06 * Math.sin(tt * 3) : 1);
      ctx.beginPath();
      ctx.moveTo(-r * 0.14, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.16, tip - r * 0.02, 0, tip);
      ctx.quadraticCurveTo(r * 0.16, tip - r * 0.02, r * 0.14, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = fg;
      ctx.lineWidth = r * 0.07;
      ctx.stroke();
      // 舌中央の割れ目
      ctx.beginPath();
      ctx.moveTo(0, r * 0.42);
      ctx.lineTo(0, tip - r * 0.12);
      ctx.stroke();
      // 後続の描画のために顔パーツの色と線幅へ戻す
      ctx.fillStyle = fg;
      ctx.lineWidth = Math.max(1, r * 0.1);
      break;
    }
    case 4: { // ネムリ：寝息の「z」がふわふわ浮き沈みして明滅する
      line(ctx, -eyeX - r * 0.15, eyeY, -eyeX + r * 0.15, eyeY);
      line(ctx, eyeX - r * 0.15, eyeY, eyeX + r * 0.15, eyeY);
      dot(ctx, 0, r * 0.35, r * 0.08);
      const floatY = anim ? r * 0.12 * Math.sin(tt * 1.5) : 0;
      if (anim) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(tt * 1.5);
      // z は本体の輪郭の内側に収める。モノクロ案は輪郭線が太い（r*0.12）ため、
      // 外寄り・大きめだと右上が線に食い込んで潰れて見える（アプリアイコンで顕著）
      ctx.font = `800 ${r * 0.4}px ${CANVAS_FONT}`;
      ctx.fillText("z", r * 0.3, -r * 0.36 - floatY);
      ctx.globalAlpha = 1;
      break;
    }
    case 5: { // ビック：驚き口が大小し、瞳が左右に泳ぐ（白地なので目は黒地＋白瞳）
      const dart = anim ? r * 0.07 * Math.sin(tt * 2.3) : 0;
      ctx.fillStyle = fg;
      dot(ctx, -eyeX, eyeY, r * 0.2);
      dot(ctx, eyeX, eyeY, r * 0.2);
      ctx.fillStyle = bg;
      dot(ctx, -eyeX + dart, eyeY, r * 0.08);
      dot(ctx, eyeX + dart, eyeY, r * 0.08);
      ctx.fillStyle = fg;
      const mr = r * 0.18 * (anim ? 0.7 + 0.4 * Math.abs(Math.sin(tt * 4)) : 1);
      ctx.beginPath();
      ctx.arc(0, r * 0.36, mr, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 6: { // イシゴロ：基本無表情。たまにゆっくり目を閉じる（動かないのが持ち味）
      const closed = anim && isBlinking(tt, 6.0, 0.5);
      line(ctx, -eyeX - r * 0.14, eyeY, -eyeX + r * 0.14, eyeY);
      line(ctx, eyeX - r * 0.14, eyeY, eyeX + r * 0.14, eyeY);
      if (!closed) {
        dot(ctx, -eyeX, eyeY + r * 0.08, r * 0.1);
        dot(ctx, eyeX, eyeY + r * 0.08, r * 0.1);
      }
      line(ctx, -r * 0.25, r * 0.35, r * 0.25, r * 0.35);
      break;
    }
  }

  ctx.restore();
}

/**
 * 骸骨（ゲームオーバー演出で全キャラを骸骨へ変化させる）。
 * 著作権配慮でコード描画（画像なし）。白地＋黒アウトラインのインク画で描く。
 * popK（0..1）は変化直後だけ与え、軽くスケールポップさせて
 * 「ボンッと骸骨化した」感を出す。決定論的で乱数を使わない。
 */
export function drawSkull(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  popK = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const s = 1 + 0.25 * popK; // 変化直後にふくらむ
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 頭蓋（白地）：上半分のドーム＋下すぼまりのあご
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
  ctx.lineTo(r * 0.5, r * 0.55);
  ctx.quadraticCurveTo(0, r * 0.82, -r * 0.5, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.12;
  ctx.stroke();

  // 眼窩（落ちくぼんだ黒い穴）
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.12, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.36, -r * 0.12, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 鼻（逆三角の穴）
  ctx.beginPath();
  ctx.moveTo(0, r * 0.06);
  ctx.lineTo(-r * 0.11, r * 0.32);
  ctx.lineTo(r * 0.11, r * 0.32);
  ctx.closePath();
  ctx.fill();

  // 歯（歯ぐきラインと縦の歯）
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.38, r * 0.48);
  ctx.lineTo(r * 0.38, r * 0.48);
  ctx.stroke();
  for (const tx of [-r * 0.24, -r * 0.08, r * 0.08, r * 0.24]) {
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.48);
    ctx.lineTo(tx, r * 0.66);
    ctx.stroke();
  }

  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function arcMouth(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, start: number, end: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, start, end);
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
