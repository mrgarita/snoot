// Snoot のオリジナルキャラクター描画
// 著作権配慮のため Snood のキャラクターは使わず、全キャラを Canvas でコード描画する。
// 色だけでなく表情・付属パーツも変えて、色覚にかかわらず見分けられるようにする。

export const TYPE_COLORS = [
  "#4a90d9", // 0: マルオ（青・にっこり）
  "#5cb85c", // 1: ハッパ（緑・葉っぱ頭）
  "#e74c3c", // 2: プンタ（赤・怒り眉）
  "#f5a623", // 3: ヒナタ(オレンジ・星目)
  "#9b59b6", // 4: ネムリ（紫・ねむり目）
  "#45c4c8", // 5: ビック（水色・びっくり口）
  "#8d8d8d", // 6: イシゴロ（灰色・四角顔）
];

export const TYPE_COUNT_MAX = TYPE_COLORS.length;

/** Canvas 内テキストの書体。DOM 側（style.css の --font-body）と揃えて統一する */
export const CANVAS_FONT = '"M PLUS Rounded 1c", sans-serif';

/** キャラクター名（TYPE_COLORS と同順） */
export const TYPE_NAMES = ["マルオ", "ハッパ", "プンタ", "ヒナタ", "ネムリ", "ビック", "イシゴロ"];

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
  ctx.save();
  ctx.translate(cx, cy);

  const color = TYPE_COLORS[type % TYPE_COLORS.length];

  // 本体（イシゴロのみ角丸四角、他は円）
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  if (type === 6) {
    const s = r * 0.92;
    roundRect(ctx, -s, -s, s * 2, s * 2, r * 0.3);
  } else {
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  // ハイライト
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.32, r * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // ハッパの葉っぱは表情にかかわらず描く（キャラの個性を保つ）
  if (type % TYPE_COLORS.length === 1) {
    const sway = anim && !surprised ? 0.35 * Math.sin(tt * 1.8) : 0;
    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.28, r * 0.16, -0.6 + sway, 0, Math.PI * 2);
    ctx.fill();
  }

  // 顔パーツ
  ctx.fillStyle = "#222";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = Math.max(1, r * 0.1);
  const eyeY = -r * 0.15;
  const eyeX = r * 0.32;

  // 驚き顔（消滅エフェクト用・全種共通）：体の個性は残し顔だけ差し替える
  if (surprised) {
    ctx.fillStyle = "#fff";
    dot(ctx, -eyeX, eyeY, r * 0.2);
    dot(ctx, eyeX, eyeY, r * 0.2);
    ctx.fillStyle = "#222";
    dot(ctx, -eyeX, eyeY, r * 0.07);
    dot(ctx, eyeX, eyeY, r * 0.07);
    // 大きく開いた口
    ctx.fillStyle = "#5a2222";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // コミック風の驚き線
    ctx.strokeStyle = "#ffe27a";
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

  switch (type % TYPE_COLORS.length) {
    case 0: { // マルオ：丸目＋にっこり口。まばたきし、口がゆれる
      if (anim && isBlinking(tt, 3.1, 0.18)) {
        line(ctx, -eyeX - r * 0.12, eyeY, -eyeX + r * 0.12, eyeY);
        line(ctx, eyeX - r * 0.12, eyeY, eyeX + r * 0.12, eyeY);
      } else {
        dot(ctx, -eyeX, eyeY, r * 0.13);
        dot(ctx, eyeX, eyeY, r * 0.13);
      }
      const rm = r * 0.35 * (anim ? 1 + 0.08 * Math.sin(tt * 2.2) : 1);
      arcMouth(ctx, 0, r * 0.25, rm, 0.15 * Math.PI, 0.85 * Math.PI);
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
      arcMouth(ctx, 0, r * 0.3, r * 0.25, 0.2 * Math.PI, 0.8 * Math.PI);
      break;
    }
    case 2: { // プンタ：怒り眉がピクピク上下し、への字口がふるえる
      const jitter = anim ? r * 0.06 * Math.sin(tt * 8) : 0;
      line(ctx, -eyeX - r * 0.15, eyeY - r * 0.25 + jitter, -eyeX + r * 0.12, eyeY - r * 0.08);
      line(ctx, eyeX + r * 0.15, eyeY - r * 0.25 + jitter, eyeX - r * 0.12, eyeY - r * 0.08);
      dot(ctx, -eyeX, eyeY + r * 0.08, r * 0.12);
      dot(ctx, eyeX, eyeY + r * 0.08, r * 0.12);
      arcMouth(ctx, 0, r * 0.55 - jitter * 0.5, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI);
      break;
    }
    case 3: { // ヒナタ：星の目がキラキラ拡縮し、笑い口が開閉する
      const tw = anim ? 1 + 0.25 * Math.sin(tt * 5) : 1;
      const tw2 = anim ? 1 + 0.25 * Math.sin(tt * 5 + 1.6) : 1;
      star(ctx, -eyeX, eyeY, r * 0.18 * tw);
      star(ctx, eyeX, eyeY, r * 0.18 * tw2);
      const open = anim ? 0.7 + 0.3 * Math.abs(Math.sin(tt * 3)) : 1;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.34, r * 0.34 * open, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 4: { // ネムリ：寝息の「z」がふわふわ浮き沈みして明滅する
      line(ctx, -eyeX - r * 0.15, eyeY, -eyeX + r * 0.15, eyeY);
      line(ctx, eyeX - r * 0.15, eyeY, eyeX + r * 0.15, eyeY);
      dot(ctx, 0, r * 0.35, r * 0.08);
      const floatY = anim ? r * 0.12 * Math.sin(tt * 1.5) : 0;
      if (anim) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(tt * 1.5);
      ctx.font = `bold ${r * 0.45}px ${CANVAS_FONT}`;
      ctx.fillText("z", r * 0.45, -r * 0.45 - floatY);
      ctx.globalAlpha = 1;
      break;
    }
    case 5: { // ビック：驚き口が大小し、瞳が左右に泳ぐ
      const dart = anim ? r * 0.07 * Math.sin(tt * 2.3) : 0;
      ctx.fillStyle = "#fff";
      dot(ctx, -eyeX, eyeY, r * 0.2);
      dot(ctx, eyeX, eyeY, r * 0.2);
      ctx.fillStyle = "#222";
      dot(ctx, -eyeX + dart, eyeY, r * 0.09);
      dot(ctx, eyeX + dart, eyeY, r * 0.09);
      const mr = r * 0.18 * (anim ? 0.7 + 0.4 * Math.abs(Math.sin(tt * 4)) : 1);
      ctx.beginPath();
      ctx.arc(0, r * 0.35, mr, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 6: { // イシゴロ：基本無表情。たまにゆっくり目を閉じる（動かないのが持ち味）
      const closed = anim && isBlinking(tt, 6.0, 0.5);
      line(ctx, -eyeX - r * 0.14, eyeY, -eyeX + r * 0.14, eyeY);
      line(ctx, eyeX - r * 0.14, eyeY, eyeX + r * 0.14, eyeY);
      if (!closed) {
        dot(ctx, -eyeX, eyeY + r * 0.06, r * 0.1);
        dot(ctx, eyeX, eyeY + r * 0.06, r * 0.1);
      }
      line(ctx, -r * 0.25, r * 0.35, r * 0.25, r * 0.35);
      break;
    }
  }

  ctx.restore();
}

/**
 * 骸骨（ゲームオーバー演出で全キャラを骸骨へ変化させる）。
 * 著作権配慮でコード描画（画像なし）。popK（0..1）は変化直後だけ与え、
 * 軽くスケールポップさせて「ボンッと骸骨化した」感を出す。決定論的で乱数を使わない。
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

  // 頭蓋（骨色）：上半分のドーム＋下すぼまりのあご
  ctx.fillStyle = "#e9e6da";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
  ctx.lineTo(r * 0.5, r * 0.55);
  ctx.quadraticCurveTo(0, r * 0.82, -r * 0.5, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 眼窩（落ちくぼんだ黒い穴）
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.12, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.36, -r * 0.12, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 鼻（逆三角の穴）
  ctx.beginPath();
  ctx.moveTo(0, r * 0.06);
  ctx.lineTo(-r * 0.12, r * 0.34);
  ctx.lineTo(r * 0.12, r * 0.34);
  ctx.closePath();
  ctx.fill();

  // 歯（歯ぐきラインと縦の歯）
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.5);
  ctx.lineTo(r * 0.4, r * 0.5);
  ctx.stroke();
  for (const tx of [-r * 0.3, -r * 0.1, r * 0.1, r * 0.3]) {
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.5);
    ctx.lineTo(tx, r * 0.72);
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
