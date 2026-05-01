import * as Phaser from 'phaser';

// Half-width of the reveal band (in pixels) — one-third of original 80
const BAND_HW = 27;

// tan(30°) — how far the top of the band leads the bottom
const TAN_30 = Math.tan(Math.PI / 6); // ≈ 0.577

// Unique texture key so it doesn't clash with other scenes
const MASK_KEY = '__scanline_mask__';

export default class ScanLineScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ScanLineScene' });
  }

  preload() {
    this.load.image('display', 'assets/images/Display.png');
  }

  create() {
    const cw = this.cameras.main.width;
    const ch = this.cameras.main.height;
    const cx = cw / 2;
    const cy = ch / 2;

    this._cw = cw;
    this._ch = ch;

    // ── Display.png: same contain-scale as GameBeamScene ─────────────────────
    const displayFrame = this.textures.getFrame('display');
    const displayW     = displayFrame.realWidth;
    const displayH     = displayFrame.realHeight;
    const displayScale = Math.min(cw / displayW, ch / displayH);

    // ── DynamicTexture used as the mask source ────────────────────────────────
    // White pixels = show Display.png, transparent = hide it
    // Re-create each time scene starts (clean slate)
    if (this.textures.exists(MASK_KEY)) {
      this.textures.remove(MASK_KEY);
    }
    this._maskDT = this.textures.addDynamicTexture(MASK_KEY, cw, ch, false);

    // ── Graphics object for drawing mask shapes into the DynamicTexture ───────
    // make (not add) keeps it off the scene display list — never renders on screen
    this._maskGfx = this.make.graphics({ add: false });

    // ── Display image, hidden until sweep begins ──────────────────────────────
    this._displayImg = this.add.image(cx, cy, 'display')
      .setScale(displayScale)
      .setVisible(false);

    // Apply filter mask using Phaser 4 filter API
    this._displayImg.enableFilters();
    this._displayImg.filters.internal.addMask(MASK_KEY);


    this._scheduleNextSweep(2000);
  }

  _scheduleNextSweep(delay) {
    this.time.delayedCall(delay, () => this._runSweep());
  }

  _runSweep() {
    const cw       = this._cw;
    const ch       = this._ch;
    const topShift = ch * TAN_30;

    const startX = -BAND_HW;
    const endX   = cw + BAND_HW + topShift;
    const band   = { x: startX };

    this._displayImg.setVisible(true);

    this.tweens.add({
      targets:  band,
      x:        endX,
      duration: 1350,
      ease:     'Linear',
      onUpdate: () => {
        this._drawBand(band.x);
      },
      onComplete: () => {
        this._displayImg.setVisible(false);
        this._maskDT.clear();
        this._maskDT.render();
        this._maskGfx.clear();
        const nextDelay = Phaser.Math.Between(8000, 20000);
        this._scheduleNextSweep(nextDelay);
      },
    });
  }

  _drawBand(bx) {
    const ch       = this._ch;
    const topShift = ch * TAN_30;

    // Parallelogram corners — top leads, bottom lags by topShift
    const topL = { x: bx - BAND_HW,            y: 0  };
    const topR = { x: bx + BAND_HW,            y: 0  };
    const botR = { x: bx + BAND_HW - topShift, y: ch };
    const botL = { x: bx - BAND_HW - topShift, y: ch };

    // ── Draw white parallelogram into mask DynamicTexture ────────────────────
    this._maskGfx.clear();
    this._maskGfx.fillStyle(0xffffff, 1);
    this._maskGfx.fillTriangle(topL.x, topL.y, topR.x, topR.y, botR.x, botR.y);
    this._maskGfx.fillTriangle(topL.x, topL.y, botR.x, botR.y, botL.x, botL.y);

    this._maskDT.clear();
    this._maskDT.draw(this._maskGfx);
    this._maskDT.render();

  }
}

