import * as Phaser from 'phaser';

export default class StartButton {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{ onActivate: Function }} config
   */
  constructor(scene, x, y, { onActivate, scale = 1 }) {
    this._scene      = scene;
    this._x          = x;
    this._y          = y;
    this._onActivate = onActivate || (() => {});
    this._enabled    = false;  // disabled until compatibility check enables it
    this._scale      = scale;

    this._container = scene.add.container(x, y);

    // ── Start button image ──────────────────────────────────────────────────────
    this._frame = scene.add.image(0, 0, 'start-img')
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this._container.add(this._frame);

    // Apply scale if specified
    if (this._scale !== 1) {
      this._container.setScale(this._scale);
    }

    // Start in disabled visual state
    this._container.setAlpha(0.35);

    // ── Interaction ───────────────────────────────────────────────────────────
    this._frame.on('pointerdown', () => {
      if (!this._enabled) return;
      this._pulseFeedback();
      // Small delay so pulse is visible before scene transition
      scene.time.delayedCall(80, () => this._onActivate());
    });

    this._frame.on('pointerover', () => {
      if (!this._enabled) return;
      this._container.setAlpha(0.85);
    });

    this._frame.on('pointerout', () => {
      if (!this._enabled) return;
      this._container.setAlpha(1);
    });
  }

  // ── Tactile scale pulse ───────────────────────────────────────────────────

  _pulseFeedback() {
    this._scene.tweens.add({
      targets:  this._container,
      scaleX:   1.07,
      scaleY:   1.07,
      duration: 60,
      yoyo:     true,
      ease:     'Sine.easeOut',
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setEnabled(bool) {
    this._enabled = bool;
    this._container.setAlpha(bool ? 1 : 0.35);
  }

  /** Called when returning from a game scene — nothing to reset visually. */
  reset() {}

  destroy() {
    this._container.destroy(true);
  }
}
