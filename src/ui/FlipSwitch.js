import * as Phaser from 'phaser';

export default class FlipSwitch {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x  - centre X (= lever pivot)
   * @param {number} y  - centre Y (= lever pivot)
   * @param {{ onActivate: Function }} options
   */
  constructor(scene, x, y, { onActivate } = {}) {
    this._scene      = scene;
    this._activated  = false;
    this._onActivate = onActivate || (() => {});
    this.leverAngle  = -90;  // degrees: -90=up (ready), 90=down (activated)
    this._enabled     = true;
    this._disabledGfx = null;   // lazy overlay

    this._container = scene.add.container(x, y);
    this._gfx       = scene.add.graphics();
    this._leverGfx  = scene.add.graphics();

    this._container.add([this._gfx, this._leverGfx]);

    this._drawBase();
    this._drawLever();
    this._makeInteractive();
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  _drawBase() {
    const gfx = this._gfx;
    gfx.clear();

    // Base plate — dark brushed metal
    gfx.fillStyle(0x2A2A35, 1);
    gfx.fillRect(-35, -50, 70, 100);
    gfx.lineStyle(2, 0x4A4A5A, 1);
    gfx.strokeRect(-35, -50, 70, 100);

    // Subtle inner bevel
    gfx.lineStyle(1, 0x1A1A25, 1);
    gfx.strokeRect(-31, -46, 62, 92);

    // 4 corner screws
    [[-27, -42], [27, -42], [-27, 42], [27, 42]].forEach(([sx, sy]) => {
      // Screw shadow
      gfx.fillStyle(0x1A1A00, 0.5);
      gfx.fillCircle(sx + 1, sy + 1, 5);
      // Screw body
      gfx.fillStyle(0x5C2E00, 1);
      gfx.fillCircle(sx, sy, 5);
      // Screw highlight
      gfx.fillStyle(0xD4A017, 1);
      gfx.fillCircle(sx - 1.5, sy - 1.5, 2.5);
      // Crosshair slot
      gfx.lineStyle(1, 0x1A1000, 0.9);
      gfx.beginPath();
      gfx.moveTo(sx - 3, sy); gfx.lineTo(sx + 3, sy);
      gfx.moveTo(sx, sy - 3); gfx.lineTo(sx, sy + 3);
      gfx.strokePath();
    });

    // Switch housing — raised dark box
    gfx.fillStyle(0x111118, 1);
    gfx.fillRect(-15, -35, 30, 70);
    gfx.lineStyle(2, 0x3A3A4A, 1);
    gfx.strokeRect(-15, -35, 30, 70);
    // Housing inner shadow line at top
    gfx.lineStyle(1, 0x050508, 1);
    gfx.strokeRect(-13, -33, 26, 66);

    // Label below switch
    // (drawn as a text object added to container rather than graphics)
    const label = this._scene.add.text(0, 62, 'START', {
      fontSize: '10px',
      color: '#6A5A3A',
      fontFamily: 'monospace',
      letterSpacing: 3,
    });
    label.setOrigin(0.5, 0);
    this._container.add(label);
  }

  _drawLever() {
    const gfx = this._leverGfx;
    const rad = Phaser.Math.DegToRad(this.leverAngle);
    const len = 28;
    const endX = len * Math.cos(rad);
    const endY = len * Math.sin(rad);

    gfx.clear();

    // Lever stem shadow
    gfx.lineStyle(8, 0x3A2800, 0.5);
    gfx.beginPath();
    gfx.moveTo(1, 1);
    gfx.lineTo(endX + 1, endY + 1);
    gfx.strokePath();

    // Lever stem — thick brass
    gfx.lineStyle(6, 0xB8860B, 1);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(endX, endY);
    gfx.strokePath();

    // Lever stem highlight
    gfx.lineStyle(2, 0xE8C040, 0.5);
    gfx.beginPath();
    gfx.moveTo(-1, -1);
    gfx.lineTo(endX - 1, endY - 1);
    gfx.strokePath();

    // Ball shadow
    gfx.fillStyle(0x3A2800, 0.4);
    gfx.fillCircle(endX + 1, endY + 1, 7);

    // Ball end — brass
    gfx.fillStyle(0xD4A017, 1);
    gfx.fillCircle(endX, endY, 7);

    // Ball highlight
    gfx.fillStyle(0xFFE060, 0.6);
    gfx.fillCircle(endX - 2, endY - 2, 3);

    // Pivot cap
    gfx.fillStyle(0x8B6914, 1);
    gfx.fillCircle(0, 0, 5);
    gfx.fillStyle(0xD4A017, 0.6);
    gfx.fillCircle(-1, -1, 2);
  }

  _makeInteractive() {
    // Invisible Rectangle as hit zone over the full base plate
    const hitZone = this._scene.add.rectangle(0, 0, 70, 100, 0x000000, 0);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this._activate());
    hitZone.on('pointerover', () => {
      this._gfx.setAlpha(0.85);
      this._scene.input.setDefaultCursor('pointer');
    });
    hitZone.on('pointerout', () => {
      this._gfx.setAlpha(1);
      this._scene.input.setDefaultCursor('default');
    });
    this._container.add(hitZone);
  }

  // ─── Activation ───────────────────────────────────────────────────────────

  _activate() {
    if (!this._enabled) return;   // locked — ignore click
    if (this._activated) return;
    this._activated = true;

    // Tween leverAngle -90 (up) → 90 (down) with a mechanical snap
    this._scene.tweens.add({
      targets:  this,
      leverAngle: 90,
      duration: 300,
      ease:     'Back.easeOut',
      onUpdate: () => this._drawLever(),
      onComplete: () => {
        this._scene.time.delayedCall(200, () => this._onActivate());
      },
    });
  }

  /**
   * Enable or disable the switch.
   * When disabled: lever turns steel-grey, a translucent overlay appears,
   * and clicks are silently ignored.
   */
  setEnabled(bool) {
    this._enabled = bool;

    if (!bool) {
      // Grey lever
      this._leverGfx.clear();
      const rad  = Phaser.Math.DegToRad(this.leverAngle);
      const len  = 28;
      const endX = len * Math.cos(rad);
      const endY = len * Math.sin(rad);

      this._leverGfx.lineStyle(6, 0x444444, 1);
      this._leverGfx.beginPath();
      this._leverGfx.moveTo(0, 0);
      this._leverGfx.lineTo(endX, endY);
      this._leverGfx.strokePath();

      this._leverGfx.fillStyle(0x666666, 1);
      this._leverGfx.fillCircle(endX, endY, 7);

      this._leverGfx.fillStyle(0x444444, 1);
      this._leverGfx.fillCircle(0, 0, 5);

      // Disabled overlay on the housing
      if (!this._disabledGfx) {
        this._disabledGfx = this._scene.add.graphics();
        this._disabledGfx.fillStyle(0x000000, 0.45);
        this._disabledGfx.fillRect(-15, -35, 30, 70);
        this._container.add(this._disabledGfx);
      }
      this._disabledGfx.setVisible(true);

    } else {
      // Restore brass lever
      this._drawLever();
      if (this._disabledGfx) this._disabledGfx.setVisible(false);
    }
  }

  /** Reset switch to down position (called when returning to MainScene). */
  reset() {
    this._activated = false;
    this.leverAngle = -90;
    this._drawLever();
  }

  destroy() { this._container.destroy(true); }
}
