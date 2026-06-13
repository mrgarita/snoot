// Web Audio API による効果音（SE）
// v0.1 はフリー素材を使わずコード生成の簡易 SE とする（ゼロコスト・ライセンス確認不要）。
// step3 のフィードバック次第でフリー素材の BGM/SE への差し替えを検討する。

type SeName = "shoot" | "stick" | "pop" | "drop" | "alarm" | "clear" | "gameover";

class SoundPlayer {
  private ctx: AudioContext | null = null;

  /** ユーザー操作を起点に呼び、AudioContext を起こす（モバイルの自動再生制限対策） */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /**
   * SE を再生する。intensity（消滅したキャラ数など）が大きいほど
   * pop / drop は音数・音量が増えて盛大になる（上限あり）。
   */
  play(name: SeName, intensity = 0): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    switch (name) {
      case "shoot":
        this.tone(660, t, 0.08, "square", 0.15, 880);
        break;
      case "stick":
        this.tone(220, t, 0.05, "triangle", 0.2);
        break;
      case "pop": {
        // 消滅数が多いほどアルペジオの音数と音量を増やす
        const gain = Math.min(0.34, 0.2 + intensity * 0.012);
        const notes = [523, 784, 1047];
        if (intensity >= 5) notes.push(1319);
        if (intensity >= 8) notes.push(1568);
        notes.forEach((f, i) => this.tone(f, t + i * 0.06, 0.12, "sine", gain));
        break;
      }
      case "drop": {
        const gain = Math.min(0.3, 0.15 + intensity * 0.012);
        this.tone(880, t, 0.25, "sawtooth", gain, 220);
        // まとめて落としたときはブラスふうの上昇ファンファーレで祝う
        if (intensity >= 4) {
          this.fanfare(t + 0.05, intensity);
        }
        break;
      }
      case "alarm":
        this.tone(440, t, 0.12, "square", 0.2);
        this.tone(440, t + 0.18, 0.12, "square", 0.2);
        break;
      case "clear":
        [523, 659, 784, 1047].forEach((f, i) => {
          this.tone(f, t + i * 0.12, 0.25, "triangle", 0.25);
        });
        break;
      case "gameover":
        [392, 349, 311, 262].forEach((f, i) => {
          this.tone(f, t + i * 0.18, 0.3, "triangle", 0.25);
        });
        break;
    }
  }

  /**
   * 大量落下を祝うブラスふうの上昇ファンファーレ。
   * 「タタタ・ターン」型で、落下数が多いほど最後の和音が豪華になる。
   */
  private fanfare(start: number, intensity: number): void {
    // 上昇する助走（G4→C5→E5）と、最後に伸ばす主和音（G5 を軸に）
    const lead = [392, 523, 659]; // G4, C5, E5
    const step = 0.1;
    lead.forEach((f, i) => this.tone(f, start + i * step, 0.12, "square", 0.22));

    const climax = start + lead.length * step;
    // 主和音：G5 + C6（5 度＋オクターブ）。intensity が大きいほど厚くする
    const chord = [784, 1047]; // G5, C6
    if (intensity >= 6) chord.push(1319); // E6 を足して三和音に
    if (intensity >= 9) chord.push(1568); // さらに G6 で華やかに
    for (const f of chord) {
      this.tone(f, climax, 0.5, "square", 0.2);
    }
    // 主和音の根音を triangle で軽く重ねて芯を出す
    this.tone(392, climax, 0.5, "triangle", 0.18);
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    glideTo?: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    }
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
}

export const sound = new SoundPlayer();
