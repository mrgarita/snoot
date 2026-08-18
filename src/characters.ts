// Snoot のオリジナルキャラクター描画（デザイン案 1a：ドット絵風）
// 著作権配慮のため Snood のキャラクターは使わず、全キャラを Canvas でコード描画する。
// 16×16 のオフスクリーン canvas にスプライトを一度だけ生成してキャッシュし、
// imageSmoothingEnabled=false で拡大ブリットしてレトロ携帯機のドット絵に見せる。
// 色だけでなく表情・付属パーツも変えて、色覚にかかわらず見分けられるようにする。
// 特に「青（マルオ）と緑（ハッパ）が見分けにくい」対策として、青は藍寄り・緑は
// 黄緑寄りに色相を引き離し、ハッパは葉＋体の斑点で「形」でも区別できるようにした。

export const TYPE_COLORS = [
  "#4a6df5", // 0: マルオ（藍寄りの青・にっこり）
  "#9ccb2e", // 1: ハッパ（黄緑・葉っぱ頭＋斑点）
  "#ef3b2f", // 2: プンタ（赤・怒り眉）
  "#ffb703", // 3: ヒナタ（黄・星目）
  "#a05bd8", // 4: ネムリ（紫・寝息の z）
  "#3fd0d4", // 5: ビック（水色・びっくり目）
  "#9aa0a6", // 6: イシゴロ（灰色・角形）
];

export const TYPE_COUNT_MAX = TYPE_COLORS.length;

/** Canvas 内テキストの書体。DOM 側（style.css の --font-body）と揃えて統一する */
export const CANVAS_FONT = '"DotGothic16", monospace';

/** キャラクター名（TYPE_COLORS と同順） */
export const TYPE_NAMES = ["マルオ", "ハッパ", "プンタ", "ヒナタ", "ネムリ", "ビック", "イシゴロ"];

/** スプライトの表情。normal＝通常、blink＝まばたき（ネムリのみ寝息オフ）、surprised＝驚き */
type Face = "normal" | "blink" | "surprised";

/** 生成済みスプライトの置き場（キー："{type}-{face}"）。毎フレームの再生成を防ぐ */
const spriteCache = new Map<string, HTMLCanvasElement>();

/** 骸骨スプライト（1 枚だけ生成して使い回す） */
let skullCache: HTMLCanvasElement | null = null;

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
 * 16×16 のスプライトを 1 枚生成する。
 * 本体は 3 階調（base ／ 輪郭 base−70 ／ ハイライト base+60）で統一し、
 * 顔パーツだけを種類・表情ごとに描き分ける。
 */
function makeSprite(type: number, face: Face): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = 16;
  off.height = 16;
  const o = off.getContext("2d")!;

  const col = TYPE_COLORS[type % TYPE_COLORS.length];
  const dk = shade(col, -70); // 輪郭
  const lt = shade(col, 60); // ハイライト
  const K = "#1c2026"; // 顔パーツの黒
  const W = "#f2f5ff"; // 白目

  const px = (x: number, y: number, c: string): void => {
    o.fillStyle = c;
    o.fillRect(x, y, 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    o.fillStyle = c;
    o.fillRect(x, y, w, h);
  };

  // 本体：イシゴロだけ角ばった岩、他は丸い体
  if (type === 6) {
    rect(2, 3, 12, 11, dk);
    rect(3, 4, 10, 9, col);
    rect(3, 4, 10, 1, lt);
  } else {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 8.2);
        if (d <= 5.9) px(x, y, col);
        else if (d <= 7.0) px(x, y, dk);
      }
    }
    // 左上のハイライト 3 ドット
    for (const [hx, hy] of [[5, 4], [6, 4], [4, 5]]) px(hx, hy, lt);
  }

  // ハッパの葉と斑点は表情にかかわらず描く（形でも見分けられるようにする）
  if (type === 1) {
    const LG = "#3a7d1e";
    rect(7, 0, 2, 2, LG);
    px(6, 1, LG);
    px(9, 1, LG);
    px(8, 2, LG);
    px(3, 10, dk);
    px(12, 9, dk);
    px(11, 12, dk);
  }

  // 驚き顔（消滅エフェクト用・全種共通）：体の個性は残し顔だけ差し替える
  if (face === "surprised") {
    rect(3, 6, 3, 3, W);
    rect(10, 6, 3, 3, W);
    px(4, 7, K);
    px(11, 7, K);
    rect(6, 11, 4, 2, "#5a2222");
    return off;
  }

  const blink = face === "blink";

  switch (type % TYPE_COLORS.length) {
    case 0: // マルオ：丸目＋にっこり口。まばたきで目が 1 ドットの線になる
      if (blink) {
        rect(4, 8, 2, 1, K);
        rect(10, 8, 2, 1, K);
      } else {
        rect(4, 7, 2, 2, K);
        rect(10, 7, 2, 2, K);
      }
      px(5, 11, K);
      px(10, 11, K);
      rect(6, 12, 4, 1, K);
      break;
    case 1: // ハッパ：まばたき（葉と斑点は共通部で描画済み）
      if (blink) {
        rect(4, 8, 2, 1, K);
        rect(10, 8, 2, 1, K);
      } else {
        rect(4, 7, 2, 2, K);
        rect(10, 7, 2, 2, K);
      }
      rect(6, 11, 4, 1, K);
      break;
    case 2: // プンタ：怒り眉＋への字口（動かないのが持ち味なので表情は 1 種類）
      px(3, 5, K);
      px(4, 6, K);
      px(12, 5, K);
      px(11, 6, K);
      rect(4, 8, 2, 2, K);
      rect(10, 8, 2, 2, K);
      px(5, 13, K);
      rect(6, 12, 4, 1, K);
      px(10, 13, K);
      break;
    case 3: // ヒナタ：星目（十字の 5 ドット）＋舌をベロ〜んと出した口
      for (const [ex, ey] of [[5, 7], [10, 7]]) {
        px(ex, ey, K);
        px(ex - 1, ey, K);
        px(ex + 1, ey, K);
        px(ex, ey - 1, K);
        px(ex, ey + 1, K);
      }
      // 開いた口（上唇のライン）
      rect(6, 10, 4, 1, K);
      // 舌は体の下端（y=14）まで垂らす。ハッパと色ではなく「形」で見分けられる
      rect(6, 11, 4, 3, "#f2708f");
      rect(7, 14, 2, 1, "#f2708f");
      // 舌の陰影（左右の上角と中央の割れ目）
      px(6, 11, "#c14a68");
      px(9, 11, "#c14a68");
      rect(7, 11, 2, 1, "#c14a68");
      px(7, 12, "#c14a68");
      break;
    case 4: // ネムリ：閉じた目。寝息の「z」は blink 側で消して明滅させる
      rect(3, 8, 4, 1, K);
      rect(9, 8, 4, 1, K);
      rect(7, 11, 2, 1, K);
      if (!blink) {
        const Z = "#dfe6ff";
        rect(10, 1, 3, 1, Z);
        px(11, 2, Z);
        rect(10, 3, 3, 1, Z);
      }
      break;
    case 5: // ビック：白目＋びっくり口
      rect(3, 6, 3, 3, W);
      rect(10, 6, 3, 3, W);
      px(4, 7, K);
      px(11, 7, K);
      rect(7, 11, 2, 2, K);
      break;
    case 6: // イシゴロ：一文字の目と口。たまにゆっくり目を閉じる（瞳が消える）
      rect(4, 7, 3, 1, K);
      rect(9, 7, 3, 1, K);
      if (!blink) {
        px(5, 8, K);
        px(10, 8, K);
      }
      rect(5, 11, 6, 1, K);
      break;
  }

  return off;
}

/** キャッシュ経由でスプライトを取り出す */
function snootSprite(type: number, face: Face): HTMLCanvasElement {
  const key = `${type % TYPE_COLORS.length}-${face}`;
  let sp = spriteCache.get(key);
  if (!sp) {
    sp = makeSprite(type % TYPE_COLORS.length, face);
    spriteCache.set(key, sp);
  }
  return sp;
}

/** 種類ごとのまばたき周期（[周期秒, 閉じている秒]）。0 は「まばたきしない」 */
const BLINK_CYCLE: [number, number][] = [
  [3.1, 0.18], // 0 マルオ
  [3.7, 0.18], // 1 ハッパ
  [0, 0], // 2 プンタ（怒り顔のまま）
  [0, 0], // 3 ヒナタ（星目のまま）
  [2.2, 1.1], // 4 ネムリ（寝息 z の明滅）
  [0, 0], // 5 ビック（見開いたまま）
  [6.0, 0.5], // 6 イシゴロ（ゆっくり閉じる）
];

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
  let face: Face = "normal";
  if (surprised) {
    face = "surprised";
  } else if (t !== undefined) {
    const [cycle, dur] = BLINK_CYCLE[type % TYPE_COLORS.length];
    if (cycle > 0 && isBlinking(t, cycle, dur)) face = "blink";
  }

  ctx.save();
  // ドットの輪郭を保つため補間を切る（スプライトを整数倍以外に拡大しても粒が残る）
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(snootSprite(type, face), cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** 骸骨スプライト（16×16）。骨色 #e9e6da／輪郭 #7d786a／穴 #14161c の 3 階調 */
function skullSprite(): HTMLCanvasElement {
  if (skullCache) return skullCache;
  const off = document.createElement("canvas");
  off.width = 16;
  off.height = 16;
  const o = off.getContext("2d")!;
  const B = "#e9e6da";
  const dk = "#7d786a";
  const K = "#14161c";
  const px = (x: number, y: number, c: string): void => {
    o.fillStyle = c;
    o.fillRect(x, y, 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    o.fillStyle = c;
    o.fillRect(x, y, w, h);
  };

  // 頭蓋（上半分のドーム）
  for (let y = 0; y <= 10; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7);
      if (d <= 5.6) px(x, y, B);
      else if (d <= 6.7) px(x, y, dk);
    }
  }
  // あご
  rect(5, 10, 6, 3, B);
  rect(4, 10, 1, 3, dk);
  rect(11, 10, 1, 3, dk);
  rect(5, 13, 6, 1, dk);
  // 眼窩と鼻の穴
  rect(4, 5, 3, 3, K);
  rect(9, 5, 3, 3, K);
  rect(7, 8, 2, 1, K);
  // 歯の合わせ目
  for (const x of [6, 8, 10]) {
    px(x, 11, dk);
    px(x, 12, dk);
  }

  skullCache = off;
  return off;
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
  const s = r * (1 + 0.25 * popK); // 変化直後にふくらむ
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(skullSprite(), cx - s, cy - s, s * 2, s * 2);
  ctx.restore();
}
