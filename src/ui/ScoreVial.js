import * as Phaser from 'phaser';

const VIAL_BG      = 0x050A0A;
const LIQUID_COLOR = 0x0A6655;
const GLASS_BORDER = 0x5A8A8A;
const GLASS_SHINE  = 0x8ACACA;
const BUBBLE_COLOR = 0x0D8877;

export default class ScoreVial {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x      top-left X of the vial
   * @param {number} y      top-left Y of the vial
   * @param {number} width  vial width in px
   * @param {number} height vial height in px
   */
  constructor(scene, x, y, width, height) {
    this._scene = scene;
    this._x     = x;
    this._y     = y;
    this._w     = width;
    this._h     = height;
    this._level = 0;
    this._tween       = null;
    this._rippleTween = null;
    this._colorTween  = null;

    // Tier-color state
    this._incrementStart = 0;   // liquid level before the latest update()
    this._tierColorHex   = null; // null = fully green; hex = show tier color
    this._tierBlend      = 0;   // 0 = tier color, 1 = fully blended to green

    this._gfx = scene.add.graphics();
    this._draw(0);
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  _draw(level) {
    const gfx = this._gfx;
    const { _x: x, _y: y, _w: w, _h: h } = this;
    const pad = 4;

    gfx.clear();

    // Outer glass body
    gfx.fillStyle(0x1A2525, 1);
    gfx.fillRect(x, y, w, h);
    gfx.lineStyle(2, GLASS_BORDER, 1);
    gfx.strokeRect(x, y, w, h);

    // Inner dark background
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    gfx.fillStyle(VIAL_BG, 1);
    gfx.fillRect(x + pad, y + pad, innerW, innerH);

    // Liquid layers from bottom
    const clampedLevel = Math.max(0, Math.min(1, level));
    const baseLevel    = Math.max(0, Math.min(clampedLevel, this._incrementStart));
    const totalH       = innerH * clampedLevel;
    const baseH        = innerH * baseLevel;

    // Green base (liquid below the latest increment)
    if (baseH > 0) {
      gfx.fillStyle(LIQUID_COLOR, 1);
      gfx.fillRect(x + pad, y + pad + (innerH - baseH), innerW, baseH);
    }

    // Tier-coloured increment above base
    const incrementH = totalH - baseH;
    if (incrementH > 0) {
      let color;
      if (this._tierColorHex !== null) {
        color = this._lerpColor(this._tierColorHex, LIQUID_COLOR, this._tierBlend);
      } else {
        color = LIQUID_COLOR;
      }
      gfx.fillStyle(color, 1);
      gfx.fillRect(x + pad, y + pad + (innerH - totalH), innerW, incrementH);
    }

    // Surface highlight line at top of liquid
    if (totalH > 2) {
      gfx.fillStyle(BUBBLE_COLOR, 0.7);
      gfx.fillRect(x + pad, y + pad + (innerH - totalH), innerW, 2);
    }

    // Quarter-mark ticks on right inner edge
    const tickX = x + w - pad - 1;
    for (let i = 1; i < 4; i++) {
      const tickY = y + pad + innerH * (1 - i / 4);
      gfx.lineStyle(1, 0x2A5A5A, 0.55);
      gfx.beginPath();
      gfx.moveTo(tickX - 6, tickY);
      gfx.lineTo(tickX, tickY);
      gfx.strokePath();
    }

    // Glass shine (narrow left stripe)
    gfx.lineStyle(1, GLASS_SHINE, 0.3);
    gfx.beginPath();
    gfx.moveTo(x + pad + 2, y + pad + 6);
    gfx.lineTo(x + pad + 2, y + h - pad - 6);
    gfx.strokePath();

    // Nozzle cap at top centre
    const capW = 10;
    gfx.fillStyle(0x3A5A5A, 1);
    gfx.fillRect(x + w / 2 - capW / 2, y - 9, capW, 9);
    gfx.lineStyle(1, GLASS_BORDER, 1);
    gfx.strokeRect(x + w / 2 - capW / 2, y - 9, capW, 9);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Animate the vial fill to the given level (0–1).
   * tierColorHex: null = full speed (green), 0xD4A017 = mid (yellow), 0xCC3344 = slow (red).
   * After filling, a coloured increment holds for 500ms then transitions to green over 500ms.
   */
  update(level, tierColorHex = null) {
    const target = Math.max(0, Math.min(1, level));

    // Stop any in-progress tweens
    if (this._tween)       { this._tween.stop();       this._tween = null; }
    if (this._rippleTween) { this._rippleTween.stop(); this._rippleTween = null; }
    if (this._colorTween)  { this._colorTween.stop();  this._colorTween = null; }

    // Record the baseline (liquid level before this update)
    this._incrementStart = this._level;
    this._tierColorHex   = tierColorHex;
    this._tierBlend      = 0;

    const proxy = { level: this._level };
    this._tween = this._scene.tweens.add({
      targets:  proxy,
      level:    target,
      duration: 500,
      ease:     'Cubic.easeOut',
      onUpdate:  () => { this._draw(proxy.level); },
      onComplete: () => {
        this._level = target;
        // Ripple slosh, then handle color transition
        this._startRipple(target, () => {
          if (tierColorHex !== null) {
            // Hold tier color for 500ms, then blend to green over 500ms
            this._scene.time.delayedCall(500, () => {
              const colorProxy = { blend: 0 };
              this._colorTween = this._scene.tweens.add({
                targets:  colorProxy,
                blend:    1,
                duration: 500,
                ease:     'Linear',
                onUpdate: () => {
                  this._tierBlend = colorProxy.blend;
                  this._draw(this._level);
                },
                onComplete: () => {
                  this._tierColorHex   = null;
                  this._incrementStart = this._level;
                  this._tierBlend      = 0;
                  this._draw(this._level);
                  this._colorTween = null;
                },
              });
            });
          } else {
            // No tier color — reset base immediately
            this._incrementStart = this._level;
          }
        });
      },
    });
  }

  // ─── Ripple slosh ─────────────────────────────────────────────────────────

  _startRipple(base, afterCallback) {
    if (base <= 0) { if (afterCallback) afterCallback(); return; }
    const proxy = { level: base };
    this._rippleTween = this._scene.tweens.add({
      targets:  proxy,
      level:    base + 0.018,
      duration: 110,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   2,
      onUpdate:  () => { this._draw(proxy.level); },
      onComplete: () => {
        this._draw(base);
        this._rippleTween = null;
        if (afterCallback) afterCallback();
      },
    });
  }

  // ─── RGB linear interpolation ─────────────────────────────────────────────

  _lerpColor(from, to, t) {
    const fr = (from >> 16) & 0xFF;
    const fg = (from >> 8)  & 0xFF;
    const fb =  from        & 0xFF;
    const tr = (to   >> 16) & 0xFF;
    const tg = (to   >> 8)  & 0xFF;
    const tb =  to          & 0xFF;
    const r  = Math.round(fr + (tr - fr) * t);
    const g  = Math.round(fg + (tg - fg) * t);
    const b  = Math.round(fb + (tb - fb) * t);
    return (r << 16) | (g << 8) | b;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    if (this._tween)       this._tween.stop();
    if (this._rippleTween) this._rippleTween.stop();
    if (this._colorTween)  this._colorTween.stop();
    this._gfx.destroy();
  }
}
