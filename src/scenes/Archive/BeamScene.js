import * as Phaser from 'phaser';

// ─── Background image dimensions (same as MainScene) ─────────────────────────
const BG_IMG_W         = 1570;
const BG_IMG_H         = 868;
const DIAL_SOURCE_SIZE = 178;

// Dial-hole centroids in original image coordinates
const DIAL_POS_ORIGINAL = {
  grammar: { x: 523,  y: 220 },
  cefr:    { x: 1050, y: 224 },
  task:    { x: 775,  y: 422 },
  timer:   { x: 528,  y: 620 },
  rounds:  { x: 1043, y: 624 },
};

export default class BeamScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BeamScene' });
    this.speedMultiplier = 1.0;
  }

  preload() {
    this.load.image('bg',      'assets/images/Background UI.png');
    this.load.image('dial',    'assets/images/cropped_circle_image.png');
    this.load.image('display', 'assets/images/Display.png');
    this.load.image('display1', 'assets/images/Display1.png');
    this.load.image('display2', 'assets/images/Display2.png');
    this.load.image('display3', 'assets/images/Display3.png');
    this.load.image('display4', 'assets/images/Display4.png');
    this.load.image('display5', 'assets/images/Display5.png');
    this.load.image('display6', 'assets/images/Display6.png');
  }

  create() {
    const cw = this.cameras.main.width;
    const ch = this.cameras.main.height;

    // ── Geometry: contain-scale (same logic as MainScene) ────────────────────
    const bgScale  = Math.min(cw / BG_IMG_W, ch / BG_IMG_H);
    const scaledW  = BG_IMG_W * bgScale;
    const scaledH  = BG_IMG_H * bgScale;
    const bgXOff   = (cw - scaledW) / 2;
    const bgYOff   = (ch - scaledH) / 2;
    const dialSize = Math.round(DIAL_SOURCE_SIZE * bgScale);
    const cx       = cw / 2;
    const cy       = ch / 2;

    // ── Layer 1: Static home-screen background (never modified) ───────────────
    this.add.image(cx, cy, 'bg').setScale(bgScale);

    // ── Layer 2: Static dial images (visual only — no interaction) ────────────
    for (const orig of Object.values(DIAL_POS_ORIGINAL)) {
      this.add.image(
        Math.round(bgXOff + orig.x * bgScale),
        Math.round(bgYOff + orig.y * bgScale),
        'dial'
      ).setDisplaySize(dialSize, dialSize);
    }

    // ── Layer 3: Beam image ───────────────────────────────────────────────────
    const displayFrame = this.textures.getFrame('display');
    const displayW     = displayFrame.realWidth;
    const displayH     = displayFrame.realHeight;
    const displayScale = Math.min(cw / displayW, ch / displayH);

    const beamScaleXFull  = displayScale;
    const beamScaleXStart = displayScale * 0.3;
    const beamScaleYStart = 5 / displayH;
    const beamScaleYEnd   = (ch * 1.0) / displayH;

    this._beam        = this.add.image(cx, cy, 'display').setOrigin(0.5, 0.5);
    this._beam.scaleX = beamScaleXStart;
    this._beam.scaleY = beamScaleYStart;

    // Crossfade layer
    this._beamNext = this.add.image(cx, cy, 'display').setOrigin(0.5, 0.5);
    this._beamNext.scaleX = beamScaleXStart;
    this._beamNext.scaleY = beamScaleYStart;
    this._beamNext.setAlpha(0);

    // ── Layer 4: Teal glow overlay ────────────────────────────────────────────
    this._glow        = this.add.rectangle(cx, cy, displayW, displayH, 0x00cccc, 0.55);
    this._glow.scaleX = beamScaleXStart;
    this._glow.scaleY = beamScaleYStart;
    this._glow.setBlendMode(Phaser.BlendModes.ADD);

    // ── Store animation config ───────────────────────────────────────────────
    this._animConfig = {
      cx, cy, displayW, displayH, displayScale,
      beamScaleXFull, beamScaleXStart, beamScaleYStart, beamScaleYEnd,
    };

    // ── Start animation ──────────────────────────────────────────────────────
    this._playAnimation();

    // ── Set up DOM controls ──────────────────────────────────────────────────
    this._setupControls();
  }

  _playAnimation() {
    const { cx, cy, displayW, displayH, displayScale, beamScaleXFull, beamScaleXStart, beamScaleYStart, beamScaleYEnd } = this._animConfig;
    const dur = (ms) => Math.round(ms * this.speedMultiplier);

    // Stop all existing tweens
    this.tweens.killAll();

    // Reset beam and glow to initial state
    this._beam.setScale(beamScaleXStart, beamScaleYStart).setAlpha(1).setTexture('display');
    this._beamNext.setScale(beamScaleXStart, beamScaleYStart).setAlpha(0).setTexture('display');
    this._glow.setScale(beamScaleXStart, beamScaleYStart).setAlpha(0.55);

    // ── Phase 1: Pause before animation ──────────────────────────────────────
    this.time.delayedCall(dur(500), () => {
      // ── Phase 2: Widen horizontally ──────────────────────────────────────
      this.tweens.add({
        targets:  [this._beam, this._glow],
        scaleX:   beamScaleXFull,
        duration: dur(100),
        ease:     'Sine.easeOut',
        onComplete: () => {
          // ── Phase 3: Expand vertically + fade glow ──────────────────────
          this.tweens.add({
            targets:  [this._beam, this._glow],
            scaleY:   beamScaleYEnd,
            duration: dur(300),
            ease:     'Sine.easeOut',
            onComplete: () => {
              // ── Phase 4: Crossfade through Display1-6 ───────────────────
              this._startDisplaySequence();
            },
          });
          this.tweens.add({
            targets:  this._glow,
            alpha:    0.08,
            duration: dur(300),
            ease:     'Sine.easeOut',
          });
        },
      });
    });
  }

  _startDisplaySequence() {
    const dur = (ms) => Math.round(ms * this.speedMultiplier);
    const displayKeys = ['display1', 'display2', 'display3', 'display4', 'display5', 'display6'];
    const scaleX = this._beam.scaleX;
    const scaleY = this._beam.scaleY;
    let index = 0;

    const crossfadeNext = () => {
      if (index >= displayKeys.length) return;

      const nextKey = displayKeys[index];
      this._beamNext.setTexture(nextKey).setScale(scaleX, scaleY).setAlpha(0);

      this.tweens.add({
        targets:  this._beam,
        alpha:    0,
        duration: dur(50),
        ease:     'Linear',
      });
      this.tweens.add({
        targets:  this._beamNext,
        alpha:    1,
        duration: dur(50),
        ease:     'Linear',
        onComplete: () => {
          const temp = this._beam;
          this._beam = this._beamNext;
          this._beamNext = temp;
          this._beamNext.setAlpha(0);

          index++;
          crossfadeNext();
        },
      });
    };

    crossfadeNext();
  }

  _setupControls() {
    const speedSlider = document.getElementById('speedSlider');
    const speedLabel = document.getElementById('speedLabel');
    const restartBtn = document.getElementById('restartBtn');

    if (!speedSlider || !speedLabel || !restartBtn) {
      console.warn('Control elements not found in DOM');
      return;
    }

    speedSlider.addEventListener('change', (e) => {
      this.speedMultiplier = parseFloat(e.target.value);
      speedLabel.textContent = this.speedMultiplier.toFixed(1) + 'x';
      this._playAnimation();
    });

    restartBtn.addEventListener('click', () => {
      this._playAnimation();
    });
  }
}
