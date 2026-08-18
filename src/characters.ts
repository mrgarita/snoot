// Snoot のオリジナルキャラクター描画（デザイン案 1b：立体キャラ）
// 著作権配慮のため Snood のキャラクターは使わず、全キャラを Canvas でコード描画する。
// 放射グラデーション＋白いスペキュラ＋下部の反射光＋接地影で「ツヤのあるビー玉」に見せ、
// つまんで撃つ手触りを出す。色だけでなく表情・付属パーツも変えて、色覚にかかわらず
// 見分けられるようにする。特に「青（マルオ）と緑（ハッパ）が見分けにくい」対策として、
// 青は濃い青・緑は黄緑寄りに色相を引き離し、ハッパは葉付きシルエットで形でも区別する。

export const TYPE_COLORS = [
  "#2f6fd8", // 0: マルオ（青・にっこり）
  "#71ba32", // 1: ハッパ（黄緑・葉っぱ頭）
  "#d93a2b", // 2: プンタ（赤・怒り眉）
  "#f5941f", // 3: ヒナタ（オレンジ・星目）
  "#8e44ad", // 4: ネムリ（紫・ねむり目）
  "#25b6c9", // 5: ビック（水色・びっくり口）
  "#8a929b", // 6: イシゴロ（灰色・角形キューブ）
];

export const TYPE_COUNT_MAX = TYPE_COLORS.length;

/** Canvas 内テキストの書体。DOM 側（style.css の --font-body）と揃えて統一する */
export const CANVAS_FONT = '"M PLUS Rounded 1c", sans-serif';

/** キャラクター名（TYPE_COLORS と同順） */
export const TYPE_NAMES = ["マルオ", "ハッパ", "プンタ", "ヒナタ", "ネムリ", "ビック", "イシゴロ"];

/** 顔パーツの色（黒よりわずかに青みのある濃色。光沢の中で沈み込みすぎない） */
const FACE_COLOR = "#22262e";

/** まばたき判定：周期 cycle 秒のうち先頭 dur 秒だけ目を閉じる */
function isBlinking(t: number, cycle: number, dur: number): boolean {
  return t % cycle < dur;
}

/** #rrggbb を amt（-255..255）だけ明暗させた rgb() 文字列を返す */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
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

  // 接地影：真下に薄い楕円を落として「置かれている」感を出す
  ctx.fillStyle = "rgba(30,40,60,0.20)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.98, r * 0.72, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type % TYPE_COLORS.length === 6) {
    // イシゴロ：縦グラデの角丸キューブ＋上面のベベル
    const s = r * 0.88;
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, shade(color, 60));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -55));
    ctx.fillStyle = g;
    ctx.beginPath();
    roundRect(ctx, -s, -s, s * 2, s * 2, r * 0.22);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    roundRect(ctx, -s * 0.8, -s * 0.92, s * 1.6, s * 0.3, r * 0.12);
    ctx.fill();
  } else {
    // 光沢球：左上から当たる光を放射グラデで表現し、縁を暗く落とす
    const g = ctx.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.08, 0, -r * 0.02, r * 1.12);
    g.addColorStop(0, shade(color, 75));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -75));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // 下部の反射光（床から返る光）
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();

    // 白いスペキュラ（ツヤの芯）
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, -r * 0.46, r * 0.15, r * 0.09, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // ハッパの葉っぱは表情にかかわらず描く（キャラの個性＝形での判別を保つ）
  if (type % TYPE_COLORS.length === 1) {
    const sway = anim && !surprised ? 0.35 * Math.sin(tt * 1.8) : 0;
    const lg = ctx.createLinearGradient(0, -r * 1.3, 0, -r * 0.8);
    lg.addColorStop(0, "#8fd14f");
    lg.addColorStop(1, "#3f8f22");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, -r * 1.0, r * 0.32, r * 0.17, -0.55 + sway, 0, Math.PI * 2);
    ctx.fill();
  }

  // 顔パーツ
  ctx.fillStyle = FACE_COLOR;
  ctx.strokeStyle = FACE_COLOR;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = "round";
  const eyeY = -r * 0.15;
  const eyeX = r * 0.32;

  /** 瞳に白いグリントを入れて「ガラス玉の目」に見せる */
  const glint = (x: number, y: number): void => {
    ctx.fillStyle = "#fff";
    dot(ctx, x - r * 0.045, y - r * 0.05, r * 0.045);
    ctx.fillStyle = FACE_COLOR;
  };

  // 驚き顔（消滅エフェクト用・全種共通）：体の個性は残し顔だけ差し替える
  if (surprised) {
    ctx.fillStyle = "#fff";
    dot(ctx, -eyeX, eyeY, r * 0.2);
    dot(ctx, eyeX, eyeY, r * 0.2);
    ctx.fillStyle = FACE_COLOR;
    dot(ctx, -eyeX, eyeY, r * 0.07);
    dot(ctx, eyeX, eyeY, r * 0.07);
    // 大きく開いた口
    ctx.fillStyle = "#5a2222";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // コミック風の驚き線
    ctx.strokeStyle = "#ffd166";
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
        dot(ctx, -eyeX, eyeY, r * 0.14);
        dot(ctx, eyeX, eyeY, r * 0.14);
        glint(-eyeX, eyeY);
        glint(eyeX, eyeY);
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
        glint(-eyeX, eyeY);
        glint(eyeX, eyeY);
      }
      arcMouth(ctx, 0, r * 0.3, r * 0.25, 0.2 * Math.PI, 0.8 * Math.PI);
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
      // 舌：光沢球の質感に合わせ、縦グラデ＋ツヤでピンクの舌を垂らす
      const tip = r * 0.74 * (anim ? 1 + 0.06 * Math.sin(tt * 3) : 1);
      const tongue = ctx.createLinearGradient(0, r * 0.3, 0, tip);
      tongue.addColorStop(0, "#f78ba5");
      tongue.addColorStop(1, "#d94f74");
      ctx.beginPath();
      ctx.moveTo(-r * 0.14, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.16, tip - r * 0.02, 0, tip);
      ctx.quadraticCurveTo(r * 0.16, tip - r * 0.02, r * 0.14, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = tongue;
      ctx.fill();
      // 舌中央の割れ目
      ctx.strokeStyle = "#b23a5c";
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.42);
      ctx.lineTo(0, tip - r * 0.12);
      ctx.stroke();
      // ツヤ（白ハイライト）
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.05, r * 0.4, r * 0.045, r * 0.07, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // 後続の描画のために顔パーツの色と線幅へ戻す
      ctx.fillStyle = FACE_COLOR;
      ctx.strokeStyle = FACE_COLOR;
      ctx.lineWidth = Math.max(1, r * 0.1);
      break;
    }
    case 4: { // ネムリ：寝息の「z」がふわふわ浮き沈みして明滅する
      line(ctx, -eyeX - r * 0.15, eyeY, -eyeX + r * 0.15, eyeY);
      line(ctx, eyeX - r * 0.15, eyeY, eyeX + r * 0.15, eyeY);
      dot(ctx, 0, r * 0.35, r * 0.08);
      const floatY = anim ? r * 0.12 * Math.sin(tt * 1.5) : 0;
      if (anim) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(tt * 1.5);
      ctx.font = `700 ${r * 0.45}px ${CANVAS_FONT}`;
      ctx.fillText("z", r * 0.42, -r * 0.5 - floatY);
      ctx.globalAlpha = 1;
      break;
    }
    case 5: { // ビック：驚き口が大小し、瞳が左右に泳ぐ
      const dart = anim ? r * 0.07 * Math.sin(tt * 2.3) : 0;
      ctx.fillStyle = "#fff";
      dot(ctx, -eyeX, eyeY, r * 0.2);
      dot(ctx, eyeX, eyeY, r * 0.2);
      ctx.fillStyle = FACE_COLOR;
      dot(ctx, -eyeX + dart, eyeY, r * 0.09);
      dot(ctx, eyeX + dart, eyeY, r * 0.09);
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
 * 著作権配慮でコード描画（画像なし）。本体と同じく陰影を付けた立体で描く。
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

  // 接地影（本体と同じ扱いで置かれている感を保つ）
  ctx.fillStyle = "rgba(30,40,60,0.20)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.95, r * 0.7, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // 頭蓋（骨色）：上半分のドーム＋下すぼまりのあご。放射グラデで陰影を付ける
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.45, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#fdfbf2");
  g.addColorStop(0.55, "#e9e6da");
  g.addColorStop(1, "#a09a89");
  ctx.fillStyle = g;
  skullPath(ctx, r);
  ctx.fill();

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
  ctx.strokeStyle = "#8d887a";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = "round";
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

/** 骸骨の輪郭（ドーム＋あご）。原点は頭の中心 */
function skullPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
  ctx.lineTo(r * 0.5, r * 0.55);
  ctx.quadraticCurveTo(0, r * 0.82, -r * 0.5, r * 0.55);
  ctx.closePath();
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
