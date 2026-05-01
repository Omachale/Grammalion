import * as Phaser from 'phaser';
import { correctSentencesByGrammar } from '../data/sentences';
import PowerBar from '../ui/PowerBar';
import { startCountdown } from '../ui/countdown';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

// ─── Tile dimensions ──────────────────────────────────────────────────────────
const TILE_W      = 105;
const TILE_H      = 36;
const TILE_GAP    = 8;
const MAX_PER_ROW = 8;

// ─── Panel geometry (matches other game scenes) ───────────────────────────────
// OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
const PANEL_X   = 408;
const PANEL_Y   = 80;
const PANEL_W   = 750;
const PANEL_H   = 130;
const PANEL_MID = PANEL_X + PANEL_W / 2;   // 783
const GAME_CENTER_X = 783;

// ─── Timer limits: 3× the regular limits, scaled by word count ────────────────
const TIMER_LIMITS = { Off: null, Slow: 36000, Medium: 22500, Fast: 13500 };

// ─── Tween duration (ms) for ghost-position shuffle ──────────────────────────
const GHOST_DURATION = 130;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Strip trailing full stop and lowercase the first character so tiles
 * don't reveal sentence-start position and the answer doesn't include
 * unwanted punctuation.
 */
function normaliseForReorder(sentence) {
  return sentence
    .replace(/\.$/, '')
    .replace(/^(.)/, (c) => c.toLowerCase());
}

export default class ReorderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ReorderScene' });
  }

  init(data) {
    this._grammar = data.grammar || 'Present Simple';
    this._task    = data.task    || 'Reorder';
    this._cefr    = data.cefr   || 'A2';
    this._rounds  = data.rounds  || 10;
    this._timer   = data.timer   || 'Off';
  }

  preload() {
    this.load.image('menu-btn', 'assets/images/Menu.png');
    PowerBar.preload(this);
  }

  create() {
    // ── State ────────────────────────────────────────────────────────────────
    this._correct           = 0;
    this._wrong             = 0;
    this._questionIndex     = 0;
    this._inputLocked       = true;   // locked until countdown finishes
    this._timerNeedsStart   = false;
    this._timerActive       = false;
    this._questionStartTime = 0;
    this._vialSum           = 0;
    this._tiles             = [];
    this._slots             = [];

    // ── Drag state ───────────────────────────────────────────────────────────
    this._dragTile        = null;   // tile currently being dragged
    this._insertionIndex  = -1;     // where in the order the dragged tile would land

    // ── Question pool ────────────────────────────────────────────────────────
    const bank = correctSentencesByGrammar[this._grammar] || correctSentencesByGrammar['Present Simple'];
    this._questions = shuffle(bank)
      .slice(0, this._rounds)
      .map(normaliseForReorder);

    // ── Counter ──────────────────────────────────────────────────────────────
    this._counterText = this.add.text(GAME_CENTER_X, 50, '', {
      fontSize: '16px', color: '#D4A017', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    // ── Sentence panel ───────────────────────────────────────────────────────
    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(0x48C1C0, 0.2);
    panelGfx.fillRect(495, 143, 750, 130);
    panelGfx.lineStyle(2, 0x48C1C0, 0.6);
    panelGfx.strokeRect(495, 143, 750, 130);

    // ── Timer bar ────────────────────────────────────────────────────────────
    // _timerLimit will be set dynamically in _showQuestion() based on word count
    const timerBarBg = this.add.graphics();
    if (this._timer !== 'Off') {
      timerBarBg.fillStyle(0x0A0F0A, 1);
      timerBarBg.fillRect(40, 213, 944, 5);
    }
    this._timerBarGfx = this.add.graphics();

    // ── Instruction label ────────────────────────────────────────────────────
    this.add.text(GAME_CENTER_X, 237, 'DRAG WORDS INTO THE CORRECT ORDER, THEN PRESS ENTER', {
      fontSize: '13px', fontStyle: 'bold', color: '#48C1C0', fontFamily: "'Syncopate', sans-serif", letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    // ── CONFIRM button ───────────────────────────────────────────────────────
    const BTN_W = 160, BTN_H = 38;
    const btnX = GAME_CENTER_X - BTN_W / 2;  // Left edge for fillRect
    const btnGfx = this.add.graphics();
    const drawBtn = (hover) => {
      btnGfx.clear();
      btnGfx.fillStyle(hover ? 0x1A3A1A : 0x0A1A0A, 1);
      btnGfx.fillRect(btnX, 252, BTN_W, BTN_H);
      btnGfx.lineStyle(2, hover ? 0x5A9A5A : 0x3A6A3A, 1);
      btnGfx.strokeRect(btnX, 252, BTN_W, BTN_H);
    };
    drawBtn(false);
    this.add.text(GAME_CENTER_X, 271, 'CONFIRM', {
      fontSize: '14px', color: '#D4A017', fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5, 0.5);
    const btnHit = this.add.rectangle(GAME_CENTER_X, 271, BTN_W, BTN_H, 0, 0);
    btnHit.setInteractive({ useHandCursor: true });
    btnHit.on('pointerover', () => drawBtn(true));
    btnHit.on('pointerout',  () => drawBtn(false));
    btnHit.on('pointerdown', () => { if (!this._inputLocked) this._submitAnswer(); });

    // ── Feedback text ────────────────────────────────────────────────────────
    // feedbackY = confirm button bottom (y=252 + BTN_H=38) + 30 = 320
    this._feedbackText = this.add.text(GAME_CENTER_X, 320, '', {
      fontSize: '20px', fontStyle: 'bold', color: '#22BB44', fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: 900, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // ── Power bar (replaces ScoreDial + ScoreVial) ───────────────────────────
    this._powerBar = new PowerBar(this, POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, this._rounds);

    // ── Return button ────────────────────────────────────────────────────────
    this._addReturnButton();

    // ── Keyboard ─────────────────────────────────────────────────────────────
    this._keyHandler = (e) => { if (!this._inputLocked && e.key === 'Enter') this._submitAnswer(); };
    this.input.keyboard.on('keydown', this._keyHandler);

    // ── Scene-level drag handlers ─────────────────────────────────────────────
    this.input.on('dragstart', (_ptr, tile) => this._onDragStart(tile));
    this.input.on('drag',      (_ptr, tile, dragX, dragY) => this._onDrag(tile, dragX, dragY));
    this.input.on('dragend',   (_ptr, tile) => this._onDragEnd(tile));

    // ── Shutdown cleanup ──────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this._keyHandler);
      this.input.off('dragstart');
      this.input.off('drag');
      this.input.off('dragend');
      this._powerBar.destroy();
      this.scene.stop('ScanLineScene');
    });

    // ── Scan line overlay ─────────────────────────────────────────────────────
    this.scene.run('ScanLineScene');

    // ── Countdown then start (only when timer is active) ─────────────────────
    if (this._timerLimit) {
      startCountdown(this, () => this._showQuestion());
    } else {
      this._showQuestion();
    }
  }

  // ─── Return button ────────────────────────────────────────────────────────

  _addReturnButton() {
    const menuBtn = this.add.image(MENU_BTN_X, MENU_BTN_Y, 'menu-btn');
    menuBtn.setOrigin(0.5, 0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.setScale(MENU_BTN_SCALE);
    menuBtn.on('pointerdown', () => {
      this.scene.stop('GameBeamScene');
      this.scene.stop();
    });
  }

  // ─── Question display ─────────────────────────────────────────────────────

  _showQuestion() {
    // Destroy tiles from previous question
    this._tiles.forEach(t => t.destroy());
    this._tiles = [];
    this._dragTile       = null;
    this._insertionIndex = -1;

    const sentence = this._questions[this._questionIndex];
    const words    = sentence.split(' ');
    const N        = words.length;

    // ─── ProportionalTimer: scale by word count (20% per word beyond 4) ───
    const baseLimit = TIMER_LIMITS[this._timer];
    this._timerLimit = baseLimit
      ? baseLimit * Math.max(1, 1 + (words.length - 4) * 0.2)
      : null;

    this._correctOrder = words;
    this._counterText.setText(`Question ${this._questionIndex + 1} of ${this._rounds}`);
    this._feedbackText.setAlpha(0);
    this._inputLocked = false;

    this._slots = this._calcSlots(N);

    // Shuffle word order (guarantee at least one change for N > 1)
    let shuffled;
    do { shuffled = shuffle(words); }
    while (N > 1 && shuffled.join(' ') === words.join(' '));

    // Each tile gets _orderIndex = its initial position in the shuffled array
    shuffled.forEach((word, i) => {
      this._tiles.push(this._createTile(word, i));
    });

    this._timerActive     = false;
    this._timerNeedsStart = !!this._timerLimit;
  }

  // ─── Slot positions ───────────────────────────────────────────────────────

  _calcSlots(N) {
    const slots = [];
    const step  = TILE_W + TILE_GAP;

    if (N <= MAX_PER_ROW) {
      const rowW   = N * TILE_W + (N - 1) * TILE_GAP;
      const startX = PANEL_MID - rowW / 2 + TILE_W / 2;
      const y      = PANEL_Y + PANEL_H / 2;
      for (let i = 0; i < N; i++) slots.push({ x: startX + i * step, y });
    } else {
      const r1 = Math.ceil(N / 2);
      const r2 = N - r1;
      const r1W = r1 * TILE_W + (r1 - 1) * TILE_GAP;
      const r2W = r2 * TILE_W + (r2 - 1) * TILE_GAP;
      const y1  = PANEL_Y + PANEL_H / 2 - 22;
      const y2  = PANEL_Y + PANEL_H / 2 + 22;
      for (let i = 0; i < r1; i++) slots.push({ x: PANEL_MID - r1W / 2 + TILE_W / 2 + i * step, y: y1 });
      for (let i = 0; i < r2; i++) slots.push({ x: PANEL_MID - r2W / 2 + TILE_W / 2 + i * step, y: y2 });
    }
    return slots;
  }

  // ─── Tile factory ─────────────────────────────────────────────────────────

  _createTile(word, orderIndex) {
    const { x, y } = this._slots[orderIndex];

    const bg = this.add.graphics();
    const drawBg = (state) => {
      bg.clear();
      if (state === 'drag') {
        bg.fillStyle(0x3A4A3A, 1);
        bg.fillRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
        bg.lineStyle(2, 0xD4A017, 1);
        bg.strokeRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      } else if (state === 'hover') {
        bg.fillStyle(0x253525, 1);
        bg.fillRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
        bg.lineStyle(2, 0xD4A017, 1);
        bg.strokeRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      } else {
        bg.fillStyle(0x1A2A1A, 1);
        bg.fillRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
        bg.lineStyle(2, 0x5C8B3A, 1);
        bg.strokeRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      }
    };
    drawBg('idle');

    const label = this.add.text(0, 0, word, {
      fontSize: '13px', fontStyle: 'bold', color: '#48C1C0', fontFamily: "'Syncopate', sans-serif",
    }).setOrigin(0.5, 0.5);

    const tile = this.add.container(x, y, [bg, label]);
    tile._word       = word;
    tile._orderIndex = orderIndex;
    tile._drawBg     = drawBg;

    tile.setSize(TILE_W, TILE_H);
    tile.setInteractive({ useHandCursor: true });
    this.input.setDraggable(tile);

    tile.on('pointerover', () => {
      if (!this._inputLocked && tile !== this._dragTile) drawBg('hover');
    });
    tile.on('pointerout', () => {
      if (tile !== this._dragTile) drawBg('idle');
    });

    return tile;
  }

  // ─── Drag handlers ────────────────────────────────────────────────────────

  _onDragStart(tile) {
    if (this._inputLocked) return;

    this._dragTile       = tile;
    this._insertionIndex = tile._orderIndex;

    tile._drawBg('drag');
    // Bring dragged tile to front so it renders above siblings
    this.children.bringToTop(tile);
  }

  _onDrag(tile, dragX, dragY) {
    if (tile !== this._dragTile) return;

    // Follow the pointer
    tile.x = dragX;
    tile.y = dragY;

    // Recalculate where in the sentence this tile would be inserted
    const newIdx = this._computeInsertIndex(dragX, dragY);
    if (newIdx !== this._insertionIndex) {
      this._insertionIndex = newIdx;
      this._animateGhostPositions();
    }
  }

  _onDragEnd(tile) {
    if (tile !== this._dragTile) return;

    // Snap the dragged tile to its insertion slot
    const targetSlot = this._slots[this._insertionIndex];
    this.tweens.killTweensOf(tile);
    this.tweens.add({
      targets:  tile,
      x:        targetSlot.x,
      y:        targetSlot.y,
      duration: 140,
      ease:     'Back.easeOut',
      easeParams: [3],
    });

    // Commit the new logical order across all tiles:
    // Others are already at their ghost positions; just update _orderIndex to match.
    const others = this._tiles
      .filter(t => t !== tile)
      .sort((a, b) => a._orderIndex - b._orderIndex);

    others.forEach((t, i) => {
      t._orderIndex = i < this._insertionIndex ? i : i + 1;
    });
    tile._orderIndex = this._insertionIndex;

    this._dragTile       = null;
    this._insertionIndex = -1;

    tile._drawBg('idle');
  }

  // ─── Insertion index calculation ──────────────────────────────────────────

  /**
   * Returns the slot index (0…N-1) that is spatially nearest to (dragX, dragY).
   * This becomes the insertion point — the dragged tile would land at this slot,
   * and all tiles currently after it shift one step to the right.
   */
  _computeInsertIndex(dragX, dragY) {
    let nearestIdx  = 0;
    let nearestDist = Infinity;
    this._slots.forEach(({ x, y }, i) => {
      const d = Phaser.Math.Distance.Between(dragX, dragY, x, y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx  = i;
      }
    });
    return nearestIdx;
  }

  // ─── Ghost position animation ─────────────────────────────────────────────

  /**
   * Animate all non-dragged tiles to their "gap" positions:
   * tiles before the insertion point stay in place;
   * tiles at or after it shift one slot to the right.
   */
  _animateGhostPositions() {
    if (!this._dragTile) return;

    // Other tiles sorted by their current logical order
    const others = this._tiles
      .filter(t => t !== this._dragTile)
      .sort((a, b) => a._orderIndex - b._orderIndex);

    others.forEach((tile, i) => {
      // Tiles before the gap go to slot i; tiles at/after go to slot i+1
      const slotIdx = i < this._insertionIndex ? i : i + 1;
      const { x, y } = this._slots[slotIdx];

      this.tweens.killTweensOf(tile);
      this.tweens.add({
        targets:  tile,
        x,
        y,
        duration: GHOST_DURATION,
        ease:     'Cubic.easeOut',
      });
    });
  }

  // ─── Answer submission ────────────────────────────────────────────────────

  _submitAnswer() {
    if (this._inputLocked) return;

    const timerWasActive  = this._timerActive;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    const elapsed = timerWasActive ? Math.max(0, this.time.now - this._questionStartTime) : 0;

    // Read current order by _orderIndex
    const ordered = [...this._tiles]
      .sort((a, b) => a._orderIndex - b._orderIndex)
      .map(t => t._word);

    const isRight = ordered.join(' ') === this._correctOrder.join(' ');
    this._inputLocked = true;

    if (isRight) {
      this._correct++;
      const { fraction, tierColor } = this._timerLimit
        ? this._getVialFraction(elapsed)
        : { fraction: 0, tierColor: null };
      this._vialSum += fraction;
      this._powerBar.addCorrect();
    } else {
      this._wrong++;
      this._powerBar.addIncorrect();
    }

    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: this._feedbackText, alpha: 0, duration: 300,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) this._endRound();
          else this._showQuestion();
        },
      });
    });
  }

  _showFeedback(msg, color) {
    this._feedbackText.setText(msg).setColor(color).setAlpha(1);
  }

  // ─── Timeout ─────────────────────────────────────────────────────────────

  _onTimeout() {
    if (!this._timerActive) return;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    this._inputLocked     = true;

    this._wrong++;
    this._powerBar.addIncorrect();
    this._timerBarGfx.clear();
    this.cameras.main.shake(400, 0.012);

    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: this._feedbackText, alpha: 0, duration: 300,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) this._endRound();
          else this._showQuestion();
        },
      });
    });
  }

  // ─── End of round ─────────────────────────────────────────────────────────

  _endRound() {
    this.scene.start('ResultsScene', {
      correct:   this._correct,
      total:     this._rounds,
      vialScore: this._timerLimit ? (this._vialSum / this._rounds) : null,
      grammar:   this._grammar,
      task:      this._task,
      cefr:      this._cefr,
      rounds:    this._rounds,
      timer:     this._timer,
    });
  }

  // ─── Vial fraction helper ─────────────────────────────────────────────────

  _getVialFraction(elapsed) {
    if (!this._timerLimit) return { fraction: 0, tierColor: null };
    const ratio = elapsed / this._timerLimit;
    if (ratio <= 0.33) return { fraction: 1.0,  tierColor: null };
    if (ratio <= 0.66) return { fraction: 0.66, tierColor: 0xD4A017 };
    return                    { fraction: 0.33, tierColor: 0xCC3344 };
  }

  // ─── Frame update — timer bar ─────────────────────────────────────────────

  update() {
    if (!this._timerLimit) return;

    if (this._timerNeedsStart) {
      this._timerNeedsStart   = false;
      this._timerActive       = true;
      this._questionStartTime = this.time.now;
      return;
    }

    if (!this._timerActive) return;

    const elapsed = this.time.now - this._questionStartTime;
    if (elapsed >= this._timerLimit) { this._onTimeout(); return; }

    const ratio = elapsed / this._timerLimit;
    const barW  = Math.max(0, 944 * (1 - ratio));
    const color = ratio < 0.5 ? 0x22BB44 : ratio < 0.8 ? 0xD4A017 : 0xBB2244;
    this._timerBarGfx.clear();
    this._timerBarGfx.fillStyle(color, 1);
    this._timerBarGfx.fillRect(40, 213, barW, 5);
  }

  // ─── Dynamic text fitting ─────────────────────────────────────────────────

  _fitTextToPanel(textObj, panelWidth, panelHeight, minFontSize = 12) {
    // Get current font size
    let fontSize = parseInt(textObj.style.fontSize);

    // Keep reducing font size until text fits in panel
    while (fontSize >= minFontSize) {
      textObj.setStyle({ fontSize: fontSize + 'px' });

      // Check if text fits
      if (textObj.height <= panelHeight) {
        return textObj;
      }

      fontSize--;
    }

    // Set to minimum size if still doesn't fit
    textObj.setStyle({ fontSize: minFontSize + 'px' });
    return textObj;
  }
}

