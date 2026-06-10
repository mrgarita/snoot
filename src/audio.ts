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

  play(name: SeName): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    switch (name) {
      case "shoot":
        this.tone(660, t, 0.08, "square", 0.15, 880);
        break;
      case "stick":
        this.tone(220, t, 0.05, "triangle", 0.2);
        break;
      case "pop":
        this.tone(523, t, 0.09, "sine", 0.25);
        this.tone(784, t + 0.06, 0.09, "sine", 0.22);
        this.tone(1047, t + 0.12, 0.12, "sine", 0.2);
        break;
      case "drop":
        this.tone(880, t, 0.25, "sawtooth", 0.15, 220);
        break;
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
