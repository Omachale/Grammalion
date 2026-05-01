import * as Phaser from 'phaser';

// ─── Text style ───────────────────────────────────────────────────────────────
const TEXT_STYLE = {
  fontFamily:      "'Syncopate', monospace",
  fontSize:        '20px',
  fontStyle:       'bold',
  color:           '#cc44ff',
  stroke:          '#000000',
  strokeThickness: 3,
  align:           'center',
};

const LABEL_STYLE = {
  fontSize:      '12px',
  color:         '#8B7355',
  fontFamily:    'monospace',
  letterSpacing: 3,
};

// ─── Dial rotation animation constants ───────────────────────────────────────
const PEAK_DEG   = 20;      // how far the dial swings
const RISE_SPEED = 0.20;    // deg/ms  →  reaches ±20° in 100 ms from rest
const FALL_SPEED = 0.067;   // deg/ms  →  returns 20° in ~300 ms
const HOLD_MS    = 200;     // ms to pause at peak before returning

// ─── Text glitch constants ────────────────────────────────────────────────────
const GLITCH_DUR   = 125;   // ms for the glitch-in phase
const GLITCH_STEPS = 8;

export default class RotaryDial {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{ label, options, onChange, dialSize }} config
   *   dialSize – rendered px diameter (default 140).
   *   label    – suppressed if falsy (background image has baked-in labels).
   */
  constructor(scene, x, y, { label, options, onChange, dialSize = 140 }) {
    this._scene    = scene;
    this._x        = x;
    this._y        = y;
    this._options  = options;
    this._index    = 0;
    this._onChange = onChange || (() => {});
    this._enabled  = true;

    this._dialSize = dialSize;
    this._dialR    = dialSize / 2;

    // ── Dial rotation state ──────────────────────────────────────────────────
    // The dial image rotates independently of the text/scanlines overlay.
    // _dialPhase drives a three-stage animation per click:
    //   'idle'    → no rotation in progress
    //   'rising'  → moving toward _aimAngle at RISE_SPEED
    //   'holding' → sitting at _aimAngle for HOLD_MS
    //   'falling' → returning to 0° at FALL_SPEED
    //
    // Blending: a new click always sets a fresh _aimAngle and resets
    // _dialPhase to 'rising', starting from whatever _dialAngle currently
    // is.  The motion is therefore continuous — no snaps or pauses.
    this._dialAngle = 0;   // current rendered angle (degrees)
    this._aimAngle  = 0;   // signed peak we are rising toward
    this._dialPhase = 'idle';
    this._holdTimer = 0;   // countdown remaining in the hold phase (ms)

    // ── Glitch text-transition state ─────────────────────────────────────────
    // All timer handles — cancelled on each new click so rapid clicking
    // never stacks multiple glitch sequences.
    this._glitchStepEvent = null;   // repeating step event
    this._glitchEndTimer  = null;   // single-shot end-of-phase timer

    this._container = scene.add.container(x, y);
    this._buildGraphics(label);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  _buildGraphics(label) {
    const r = this._dialR;
    const s = this._dialSize;

    // ── Dial image (rotates on click) ────────────────────────────────────────
    this._dialImage = this._scene.add.image(0, 0, 'dial')
      .setDisplaySize(s, s)
      .setOrigin(0.5, 0.5);

    // Circular hit zone.  Phaser tests localX/Y against the image's own space
    // where (0,0) is the image top-left, so the circle centre is (r, r).
    this._dialImage.setInteractive(
      new Phaser.Geom.Circle(r, r, r),
      Phaser.Geom.Circle.Contains
    );
    this._scene.input.setHitArea([this._dialImage], { useHandCursor: true });

    this._dialImage.on('pointerdown', (_ptr, localX) => {
      if (!this._enabled) return;
      this._advance(localX < r ? -1 : +1);
    });

    this._dialImage.on('pointerover', () => {
      if (this._enabled) this._dialImage.setAlpha(0.88);
    });
    this._dialImage.on('pointerout', () => {
      this._dialImage.setAlpha(1);
    });

    // ── Option text (stays flat — only the image rotates) ────────────────────
    this._optionText = this._scene.add.text(0, 0, this._options[0], TEXT_STYLE)
      .setOrigin(0.5, 0.5);
    // Force apply all style properties explicitly to ensure consistency
    this._applyTextStyle();

    // ── Scan-line tile ────────────────────────────────────────────────────────
    // Texture created by MainScene before any RotaryDial is constructed.
    const slW = Math.round(s * 1.05);
    const slH = Math.round(s * 0.24);
    this._scanlines = this._scene.add.tileSprite(0, 0, slW, slH, 'dial-scanlines')
      .setOrigin(0.5, 0.5);

    this._scene.tweens.add({
      targets: this._scanlines, tilePositionY: 5,
      duration: 220, repeat: -1, ease: 'Linear',
    });

    // ── Optional category label ───────────────────────────────────────────────
    if (label) {
      this._labelText = this._scene.add.text(
        0, -(r + 14), label.toUpperCase(), LABEL_STYLE
      ).setOrigin(0.5, 0.5);
    } else {
      this._labelText = null;
    }

    // ── Stack: dial image → text → scanlines [→ label] ───────────────────────
    const children = [this._dialImage, this._optionText, this._scanlines];
    if (this._labelText) children.push(this._labelText);
    this._container.add(children);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-FRAME UPDATE  (called by MainScene.update every frame)
  // ═══════════════════════════════════════════════════════════════════════════

  update(delta) {
    if (this._dialPhase === 'idle') return;

    if (this._dialPhase === 'rising') {
      // Move _dialAngle toward _aimAngle at constant RISE_SPEED.
      const remaining = this._aimAngle - this._dialAngle;
      const step      = Math.sign(remaining) * RISE_SPEED * delta;

      if (Math.abs(step) >= Math.abs(remaining)) {
        // Arrived — enter hold phase.
        this._dialAngle = this._aimAngle;
        this._dialPhase = 'holding';
        this._holdTimer = HOLD_MS;
      } else {
        this._dialAngle += step;
      }

    } else if (this._dialPhase === 'holding') {
      this._holdTimer -= delta;
      if (this._holdTimer <= 0) {
        this._dialPhase = 'falling';
      }

    } else if (this._dialPhase === 'falling') {
      // Return to 0° at FALL_SPEED, in the direction opposite to the original peak.
      const step     = -Math.sign(this._aimAngle) * FALL_SPEED * delta;
      const newAngle = this._dialAngle + step;

      // Detect crossing zero (sign flips or lands on zero).
      if (newAngle === 0 || Math.sign(newAngle) !== Math.sign(this._dialAngle)) {
        this._dialAngle = 0;
        this._aimAngle  = 0;
        this._dialPhase = 'idle';
      } else {
        this._dialAngle = newAngle;
      }
    }

    this._dialImage.setAngle(this._dialAngle);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVANCE
  // ═══════════════════════════════════════════════════════════════════════════

  _advance(delta) {
    // ── 1. Update option index immediately ───────────────────────────────────
    this._index = ((this._index + delta) % this._options.length + this._options.length)
                  % this._options.length;
    this._onChange(this._options[this._index], this._index);

    // ── 2. Start / blend dial rotation ───────────────────────────────────────
    // Setting _aimAngle and forcing 'rising' blends from wherever the dial
    // currently is — no jump, no queue.
    this._aimAngle  = delta > 0 ? +PEAK_DEG : -PEAK_DEG;
    this._dialPhase = 'rising';
    this._holdTimer = HOLD_MS;   // reset hold ready for when we arrive

    // ── 3. Glitch text transition ─────────────────────────────────────────────
    this._triggerGlitch();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLITCH TEXT TRANSITION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * On every call: cancel any in-progress glitch, immediately snap the text
   * to the new value (alpha 0), then run a single glitch-in sequence.
   * This makes rapid clicking safe — only one sequence runs at a time,
   * always reflecting the latest option.
   */
  _triggerGlitch() {
    this._cancelGlitch();

    // Snap off and update content with explicit style
    this._optionText.setAlpha(0);
    this._optionText.setX(0);
    this._optionText.setText(this._options[this._index]);
    this._applyTextStyle();

    // Glitch-in: alpha flickers from 0 → 1 with diminishing jitter
    let stepIn = 0;
    this._glitchStepEvent = this._scene.time.addEvent({
      delay:    GLITCH_DUR / GLITCH_STEPS,
      repeat:   GLITCH_STEPS - 1,
      callback: () => {
        stepIn++;
        const progress = stepIn / GLITCH_STEPS;
        const alpha  = Math.random() < (1 - progress) ? 0 : progress;
        const jitter = (Math.random() - 0.5) * 14 * (1 - progress);
        this._optionText.setAlpha(alpha);
        this._optionText.setX(jitter);
      },
    });

    this._glitchEndTimer = this._scene.time.delayedCall(GLITCH_DUR, () => {
      this._optionText.setAlpha(1);
      this._optionText.setX(0);
      this._glitchStepEvent = null;
      this._glitchEndTimer  = null;
    });
  }

  _cancelGlitch() {
    if (this._glitchStepEvent) { this._glitchStepEvent.remove(); this._glitchStepEvent = null; }
    if (this._glitchEndTimer)  { this._glitchEndTimer.remove();  this._glitchEndTimer  = null; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE APPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  _applyTextStyle() {
    this._optionText.setFontFamily(TEXT_STYLE.fontFamily);
    this._optionText.setFontSize(TEXT_STYLE.fontSize);
    this._optionText.setFontStyle(TEXT_STYLE.fontStyle);
    this._optionText.setColor(TEXT_STYLE.color);
    this._optionText.setStroke(TEXT_STYLE.stroke, TEXT_STYLE.strokeThickness);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  getValue() { return this._options[this._index]; }
  getIndex() { return this._index; }

  /** Immediate — no animation (used for scene-restore). */
  setIndex(n) {
    this._index = ((n % this._options.length) + this._options.length) % this._options.length;
    this._cancelGlitch();
    this._optionText.setText(this._options[this._index]);
    this._applyTextStyle();
    this._optionText.setAlpha(this._enabled ? 1 : 0.5);
    this._optionText.setX(0);
  }

  /** Replace options array and reset to index 0. Does NOT fire onChange. */
  setOptions(newOptions) {
    this._options = newOptions;
    this._index   = 0;
    this._cancelGlitch();
    this._optionText.setText(newOptions[0]);
    this._applyTextStyle();
    this._optionText.setAlpha(this._enabled ? 1 : 0.5);
    this._optionText.setX(0);
  }

  setDisabled(bool) {
    this._enabled = !bool;
    if (bool) {
      this._optionText.setColor('#555555');
      this._optionText.setAlpha(0.5);
    } else {
      this._optionText.setColor('#cc44ff');
      this._optionText.setAlpha(1);
    }
  }

  setVisible(bool) { this._container.setVisible(bool); }

  destroy() {
    this._cancelGlitch();
    this._container.destroy(true);
  }
}
