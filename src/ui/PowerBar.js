/**
 * PowerBar — replaces ScoreDial + ScoreVial.
 *
 * Each answer fills N cells proportional to round count (30 ÷ rounds).
 * Correct answers grow blue cells upward from the bottom of the bar.
 * Wrong answers grow red cells downward from the top of the bar.
 * Cells expand via scaleY so they are always contained within their own
 * grid row — no masking or Y-movement needed.
 *
 * Usage:
 *   PowerBar.preload(this);                          // in preload()
 *   this._powerBar = new PowerBar(this, x, y, scale, rounds);  // in create()
 *   this._powerBar.addCorrect();                     // on correct answer
 *   this._powerBar.addIncorrect();                   // on wrong answer / timeout
 *   this._powerBar.destroy();                        // in shutdown handler
 */

// ── Grid spec (native pixels within the 590×350 base image) ──────────────────
const GRID = {
  offsetX:     282,   // left edge of both columns
  offsetY:      52,   // y of row 0
  cellH:         8,   // height of one row
  doubleCellW:  25,   // both columns + gap  (9 + 7 + 9)
  rows:         30,
};

// Total animation duration (ms) per answer
const ANIM_MS = 800;

export default class PowerBar {

  static preload(scene) {
    scene.load.image('power-bar-base', 'assets/images/game/Power Base Bar.png');
    scene.load.image('blue-cell',      'assets/images/game/Blue Cells Bigger.png');
    scene.load.image('red-cell',       'assets/images/game/Red Cells.png');
  }

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x      Centre X in game coords
   * @param {number} y      Centre Y in game coords
   * @param {number} scale  Uniform scale for base image and cells
   * @param {number} rounds Round count (determines cells per answer)
   */
  constructor(scene, x, y, scale = 0.5, rounds = 10) {
    this._scene          = scene;
    this._scale          = scale;
    this._correct        = 0;
    this._wrong          = 0;
    this._cellsPerAnswer = Math.max(1, Math.floor(GRID.rows / rounds));

    // Base frame
    this._base = scene.add.image(x, y, 'power-bar-base').setScale(scale);

    // Grid top-left in screen coords
    const tlX = x - (590 * scale / 2);
    const tlY = y - (350 * scale / 2);
    this._cellX     = tlX + GRID.offsetX * scale;
    this._cellBaseY = tlY + GRID.offsetY * scale;   // top of row 0

    // Displayed cell dimensions
    const dispW = GRID.doubleCellW * scale;
    const dispH = GRID.cellH       * scale;

    // Derive per-axis scales from texture dimensions so setDisplaySize isn't needed
    const blueFrame  = scene.textures.getFrame('blue-cell');
    const redFrame   = scene.textures.getFrame('red-cell');
    const blueTW = blueFrame ? blueFrame.realWidth  : GRID.doubleCellW;
    const blueTH = blueFrame ? blueFrame.realHeight : GRID.cellH;
    const redTW  = redFrame  ? redFrame.realWidth   : GRID.doubleCellW;
    const redTH  = redFrame  ? redFrame.realHeight  : GRID.cellH;

    this._blueScaleX = dispW / blueTW;
    this._blueScaleY = dispH / blueTH;
    this._redScaleX  = dispW / redTW;
    this._redScaleY  = dispH / redTH;

    // Pre-create 30 blue + 30 red images, all at height 0 (invisible)
    this._blueCells = [];
    this._redCells  = [];

    for (let row = 0; row < GRID.rows; row++) {
      const rowTopY    = this._cellBaseY + row * dispH;
      const rowBottomY = rowTopY + dispH;

      // Blue: origin at bottom-left → scaleY 0→1 grows the cell UPWARD
      this._blueCells.push(
        scene.add.image(this._cellX, rowBottomY, 'blue-cell')
          .setOrigin(0, 1)
          .setScale(this._blueScaleX, 0)
      );

      // Red: origin at top-left → scaleY 0→1 grows the cell DOWNWARD
      this._redCells.push(
        scene.add.image(this._cellX, rowTopY, 'red-cell')
          .setOrigin(0, 0)
          .setScale(this._redScaleX, 0)
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Animate N cells in series at a constant rate.
   * A single linear tween drives overall progress 0→1.
   * Each cell occupies an equal 1/N slice; within its slice it grows
   * from scaleY=0 to full scaleY at constant speed.
   *
   * @param {Phaser.GameObjects.Image[]} cells
   * @param {number} scaleX  Final scaleX for these cells
   * @param {number} scaleY  Final scaleY for these cells
   */
  _animateCells(cells, scaleX, scaleY) {
    const n = cells.length;

    // Reset all cells to height 0 (in case of repeated fills)
    cells.forEach(img => img.setScale(scaleX, 0));

    const proxy = { t: 0 };
    this._scene.tweens.add({
      targets:  proxy,
      t:        1,
      duration: ANIM_MS,
      ease:     'Linear',
      onUpdate: () => {
        const p = proxy.t;
        cells.forEach((img, i) => {
          const slotStart = i / n;
          if (p < slotStart) return;
          const slotEnd  = (i + 1) / n;
          const localT   = Math.min(1, (p - slotStart) / (slotEnd - slotStart));
          img.setScale(scaleX, scaleY * localT);
        });
      },
      onComplete: () => {
        cells.forEach(img => img.setScale(scaleX, scaleY));
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  /** Call on correct answer. */
  addCorrect() {
    const n = this._cellsPerAnswer;
    if (this._correct + this._wrong + n > GRID.rows) return;

    // Collect next N blue cells, bottom-most first (fills upward)
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(this._blueCells[GRID.rows - 1 - this._correct - i]);
    }
    this._correct += n;
    this._animateCells(cells, this._blueScaleX, this._blueScaleY);
  }

  /** Call on wrong answer or timeout. */
  addIncorrect() {
    const n = this._cellsPerAnswer;
    if (this._correct + this._wrong + n > GRID.rows) return;

    // Collect next N red cells, top-most first (fills downward)
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(this._redCells[this._wrong + i]);
    }
    this._wrong += n;
    this._animateCells(cells, this._redScaleX, this._redScaleY);
  }

  setDepth(d) {
    this._base.setDepth(d);
    this._blueCells.forEach(c => c.setDepth(d));
    this._redCells.forEach(c => c.setDepth(d));
    return this;
  }

  destroy() {
    this._base.destroy();
    this._blueCells.forEach(c => c.destroy());
    this._redCells.forEach(c => c.destroy());
  }
}
