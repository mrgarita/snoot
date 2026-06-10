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

/** 種類 type のキャラを中心 (cx, cy)・半径 r で描画する */
export function drawSnoot(
  ctx: CanvasRenderingContext2D,
  type: number,
  cx: number,
  cy: number,
  r: number,
): void {
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

  // 顔パーツ
  ctx.fillStyle = "#222";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = Math.max(1, r * 0.1);
  const eyeY = -r * 0.15;
  const eyeX = r * 0.32;

  switch (type % TYPE_COLORS.length) {
    case 0: // マルオ：丸目＋にっこり口
      dot(ctx, -eyeX, eyeY, r * 0.13);
      dot(ctx, eyeX, eyeY, r * 0.13);
      arcMouth(ctx, 0, r * 0.25, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
      break;
    case 1: // ハッパ：頭に葉っぱ＋丸目
      ctx.fillStyle = "#2e7d32";
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.05, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      dot(ctx, -eyeX, eyeY, r * 0.13);
      dot(ctx, eyeX, eyeY, r * 0.13);
      arcMouth(ctx, 0, r * 0.3, r * 0.25, 0.2 * Math.PI, 0.8 * Math.PI);
      break;
    case 2: // プンタ：怒り眉＋への字口
      line(ctx, -eyeX - r * 0.15, eyeY - r * 0.25, -eyeX + r * 0.12, eyeY - r * 0.08);
      line(ctx, eyeX + r * 0.15, eyeY - r * 0.25, eyeX - r * 0.12, eyeY - r * 0.08);
      dot(ctx, -eyeX, eyeY + r * 0.08, r * 0.12);
      dot(ctx, eyeX, eyeY + r * 0.08, r * 0.12);
      arcMouth(ctx, 0, r * 0.55, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI);
      break;
    case 3: // ヒナタ：星型の目＋大きな笑い口
      star(ctx, -eyeX, eyeY, r * 0.18);
      star(ctx, eyeX, eyeY, r * 0.18);
      ctx.beginPath();
      ctx.arc(0, r * 0.22, r * 0.34, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      break;
    case 4: // ネムリ：ねむり目（横線）＋小さい口、寝息
      line(ctx, -eyeX - r * 0.15, eyeY, -eyeX + r * 0.15, eyeY);
      line(ctx, eyeX - r * 0.15, eyeY, eyeX + r * 0.15, eyeY);
      dot(ctx, 0, r * 0.35, r * 0.08);
      ctx.font = `bold ${r * 0.45}px sans-serif`;
      ctx.fillText("z", r * 0.45, -r * 0.45);
      break;
    case 5: // ビック：白目＋驚きの丸口
      ctx.fillStyle = "#fff";
      dot(ctx, -eyeX, eyeY, r * 0.2);
      dot(ctx, eyeX, eyeY, r * 0.2);
      ctx.fillStyle = "#222";
      dot(ctx, -eyeX, eyeY, r * 0.09);
      dot(ctx, eyeX, eyeY, r * 0.09);
      ctx.beginPath();
      ctx.arc(0, r * 0.35, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 6: // イシゴロ：半目＋真一文字の口
      line(ctx, -eyeX - r * 0.14, eyeY, -eyeX + r * 0.14, eyeY);
      dot(ctx, -eyeX, eyeY + r * 0.06, r * 0.1);
      line(ctx, eyeX - r * 0.14, eyeY, eyeX + r * 0.14, eyeY);
      dot(ctx, eyeX, eyeY + r * 0.06, r * 0.1);
      line(ctx, -r * 0.25, r * 0.35, r * 0.25, r * 0.35);
      break;
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
