import * as Phaser from 'phaser';

const ARC_START   = 185;   // degrees — 5° past left horizontal, symmetrical about vertical axis
const ARC_SPAN    = 170;   // degrees — ends at 355° (5° past right horizontal)
const HALF_GAP    = 0.5;   // degrees — gap each side of segment boundary

const C_CORRECT   = 0x22BB44;
const C_WRONG     = 0xBB2244;
const C_NEUTRAL   = 0x2A2020;
const C_BRASS     = 0xD4A017;
const HUB_RADIUS  = 8;

export default class ScoreDial {
  constructor(scene, cx, cy, outerRadius, innerRadius, totalSegments) {
    this._scene   = scene;
    this._outer   = outerRadius;
    this._inner   = innerRadius;
    this._total   = totalSegments;
    this._correct = 0;
    this._wrong   = 0;

    this._container = scene.add.container(cx, cy);

    // Layer order: segments → needle → hub (hub always on top)
    this._segGfx    = scene.add.graphics();
    this._needleGfx = scene.add.graphics();
    this._hubGfx    = scene.add.graphics();

    this._container.add([this._segGfx, this._needleGfx, this._hubGfx]);

    this._drawSegments();
    this._drawNeedle();
    this._drawHub();
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  _drawSegments() {
    const gfx   = this._segGfx;
    const n     = this._total;
    const outer = this._outer;
    const inner = this._inner;

    gfx.clear();

    for (let i = 0; i < n; i++) {
      const segDeg     = ARC_SPAN / n;
      const effStartRad = Phaser.Math.DegToRad(ARC_START + i * segDeg + HALF_GAP);
      const effEndRad   = Phaser.Math.DegToRad(ARC_START + (i + 1) * segDeg - HALF_GAP);

      let color;
      if (i < this._correct)             color = C_CORRECT;
      else if (i >= n - this._wrong)     color = C_WRONG;
      else                               color = C_NEUTRAL;

      gfx.fillStyle(color, 1);
      gfx.beginPath();
      gfx.arc(0, 0, outer, effStartRad, effEndRad, false);  // outer edge, clockwise
      gfx.arc(0, 0, inner, effEndRad, effStartRad, true);   // inner edge, anticlockwise
      gfx.closePath();
      gfx.fillPath();
    }
  }

  _drawNeedle(overrideAngleDeg) {
    const gfx      = this._needleGfx;
    const angleDeg = overrideAngleDeg !== undefined
      ? overrideAngleDeg
      : ARC_START + (this._correct / this._total) * ARC_SPAN;
    const rad      = Phaser.Math.DegToRad(angleDeg);
    const len      = this._outer - 5;

    gfx.clear();
    gfx.lineStyle(3, C_BRASS, 1);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(len * Math.cos(rad), len * Math.sin(rad));
    gfx.strokePath();
  }

  _drawHub() {
    this._hubGfx.clear();
    this._hubGfx.fillStyle(C_BRASS, 1);
    this._hubGfx.fillCircle(0, 0, HUB_RADIUS);
    // Small dark centre pip
    this._hubGfx.fillStyle(0x5C3A00, 1);
    this._hubGfx.fillCircle(0, 0, 3);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Update the dial to reflect new scores and animate the needle.
   * @param {number} correctCount
   * @param {number} wrongCount
   */
  update(correctCount, wrongCount) {
    // Clamp: correct + wrong must not exceed total
    const maxWrong = this._total - correctCount;
    wrongCount = Math.min(wrongCount, maxWrong);

    const oldAngleDeg = ARC_START + (this._correct / this._total) * ARC_SPAN;

    this._correct = correctCount;
    this._wrong   = wrongCount;

    const newAngleDeg = ARC_START + (this._correct / this._total) * ARC_SPAN;

    // Redraw segments immediately
    this._drawSegments();

    // Animate needle via proxy object
    const proxy = { angle: oldAngleDeg };
    this._scene.tweens.add({
      targets:  proxy,
      angle:    newAngleDeg,
      duration: 400,
      ease:     'Cubic.easeOut',
      onUpdate: () => {
        this._drawNeedle(proxy.angle);
      },
      onComplete: () => {
        this._drawNeedle();
        this._drawHub();   // ensure hub stays on top after needle redraw
      },
    });
  }

  getContainer() { return this._container; }

  destroy() { this._container.destroy(true); }
}
