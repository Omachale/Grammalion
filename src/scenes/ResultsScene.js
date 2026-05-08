import * as Phaser from 'phaser';

const FLAVORS = [
  'MISSION LOGGED',
  'RECORD FILED',
  'SESSION ARCHIVED',
  'DATA COMMITTED',
  'ENTRY CONFIRMED',
];

// Panel geometry — matches the sentence panel used in all game scenes
const PANEL_X = 312;
const PANEL_Y = 130;
const PANEL_W = 750;
const PANEL_H = 490;
const CX      = PANEL_X + PANEL_W / 2;   // 687  — Display4 screen centre

// Shared colours matching game scenes
const C = {
  teal:        '#48C1C0',
  tealHex:     0x48C1C0,
  tealDim:     '#2A6A6A',
  brass:       '#D4A017',
  brassHex:    0xD4A017,
};

const DEPTH_OVERLAY_BG   = 50;
const DEPTH_OVERLAY_FG   = 51;
const DEPTH_OVERLAY_TEXT = 52;

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultsScene' });
  }

  init(data) {
    this._correct    = data.correct    ?? 0;
    this._total      = data.total      ?? 10;
    this._reviewList = data.reviewList || [];

    // Preserve dial selections for restoration when returning to MainScene
    this._grammar = data.grammar || null;
    this._task    = data.task    || null;
    this._cefr    = data.cefr   || null;
    this._rounds  = data.rounds != null ? String(data.rounds) : null;
    this._timer   = data.timer  || null;
  }

  create() {
    const correct = this._correct;
    const total   = this._total;

    this._reviewOverlay  = null;
    this._closingOverlay = false;

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panel = this.add.graphics();
    panel.fillStyle(C.tealHex, 0.15);
    panel.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    panel.lineStyle(2, C.tealHex, 0.8);
    panel.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

    // Inner top divider
    panel.lineStyle(1, C.tealHex, 0.3);
    panel.lineBetween(PANEL_X + 20, PANEL_Y + 76, PANEL_X + PANEL_W - 20, PANEL_Y + 76);

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(CX, PANEL_Y + 42, 'ROUND COMPLETE', {
      fontSize:      '22px',
      fontStyle:     'bold',
      color:         C.teal,
      fontFamily:    "'Syncopate', sans-serif",
      letterSpacing: 6,
    }).setOrigin(0.5, 0.5);

    // ── Score color — varies by proportion correct ────────────────────────────
    const pct = total > 0 ? correct / total : 0;
    const correctColor =
      correct === 0 ? '#CC3344' :
      pct <= 0.20   ? '#FF8800' :
      pct <= 0.40   ? '#FFD700' :
      pct <= 0.60   ? '#0099FF' :
      pct <= 0.80   ? '#9933FF' : '#22BB44';

    // ── Score numeral (3 separate text objects for independent colouring) ─────
    const scoreY     = PANEL_Y + 136;
    const scoreStyle = {
      fontSize:      '56px',
      fontStyle:     'bold',
      fontFamily:    "'Syncopate', sans-serif",
      letterSpacing: 4,
    };

    // Create at x=0 first, then measure and reposition
    const numCorrect = this.add.text(0, scoreY, `${correct}`, { ...scoreStyle, color: correctColor }).setOrigin(0.5, 0.5);
    const numSlash   = this.add.text(0, scoreY, '  /  ',      { ...scoreStyle, color: C.teal      }).setOrigin(0.5, 0.5);
    const numTotal   = this.add.text(0, scoreY, `${total}`,   { ...scoreStyle, color: C.teal      }).setOrigin(0.5, 0.5);

    const totalScoreW = numCorrect.width + numSlash.width + numTotal.width;
    const scoreStartX = CX - totalScoreW / 2;
    numCorrect.setX(scoreStartX + numCorrect.width / 2);
    numSlash  .setX(scoreStartX + numCorrect.width + numSlash.width / 2);
    numTotal  .setX(scoreStartX + numCorrect.width + numSlash.width + numTotal.width / 2);

    // ── Max-score pulse animation (100% correct) ──────────────────────────────
    if (correct === total && total > 0) {
      this.tweens.add({
        targets:  numCorrect,
        scaleX:   0.8,
        scaleY:   0.8,
        duration: 1000,
        ease:     'Sine.easeInOut',
        onComplete: () => {
          this.tweens.add({
            targets:  numCorrect,
            scaleX:   1.286,
            scaleY:   1.286,
            duration: 100,
            ease:     'Sine.easeIn',
            onComplete: () => {
              numSlash.setColor('#22BB44');
              numTotal.setColor('#22BB44');
            },
          });
        },
      });
    }

    // ── Score label ───────────────────────────────────────────────────────────
    this.add.text(CX, PANEL_Y + 170, 'CORRECT ANSWERS', {
      fontSize:      '11px',
      color:         C.tealDim,
      fontFamily:    'monospace',
      letterSpacing: 5,
    }).setOrigin(0.5, 0.5);

    // ── Flavor text ───────────────────────────────────────────────────────────
    const flavor = FLAVORS[correct % FLAVORS.length];
    this.add.text(CX, PANEL_Y + 190, flavor, {
      fontSize:      '12px',
      color:         C.teal,
      fontFamily:    'monospace',
      letterSpacing: 4,
      alpha:         0.5,
    }).setOrigin(0.5, 0.5);

    // ── Review button (Wheel mode only) ───────────────────────────────────────
    if (this._reviewList.length > 0) {
      this._addReviewButton(CX, PANEL_Y + 415);
    }

    // ── Return prompt ─────────────────────────────────────────────────────────
    const returnText = this.add.text(CX, PANEL_Y + PANEL_H + 40, 'CLICK ANYWHERE TO RETURN', {
      fontSize:      '12px',
      color:         C.tealDim,
      fontFamily:    'monospace',
      letterSpacing: 4,
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets:  returnText,
      alpha:    { from: 0.3, to: 1 },
      duration: 1000,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   -1,
    });

    // ── Scan line overlay ─────────────────────────────────────────────────────
    this.scene.run('ScanLineScene');

    // ── Shutdown cleanup ─────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.scene.stop('ScanLineScene');
    });

    // ── Return on click ───────────────────────────────────────────────────────
    // Delayed 800 ms so the scene-start click doesn't also trigger return.
    // _reviewOverlay / _closingOverlay guard against overlay clicks bubbling here.
    this.time.delayedCall(800, () => {
      this.input.on('pointerdown', () => {
        if (!this._reviewOverlay && !this._closingOverlay) {
          this.scene.stop('GameBeamScene');
          this.scene.stop();
        }
      });
    });
  }

  // ─── Review button ────────────────────────────────────────────────────────

  _addReviewButton(x, y) {
    const w = 140, h = 32;
    const gfx = this.add.graphics();
    const draw = (hover) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x0A2A2A : 0x051515, 1);
      gfx.fillRect(x - w / 2, y - h / 2, w, h);
      gfx.lineStyle(2, hover ? 0x5ADDDD : C.tealHex, 1);
      gfx.strokeRect(x - w / 2, y - h / 2, w, h);
    };
    draw(false);

    this.add.text(x, y, '📋  REVIEW', {
      fontSize:   '12px',
      color:      C.teal,
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    const hit = this.add.rectangle(x, y, w, h, 0, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => draw(true));
    hit.on('pointerout',   () => draw(false));
    hit.on('pointerdown',  () => this._showReviewOverlay());
  }

  // ─── Review overlay ───────────────────────────────────────────────────────

  _showReviewOverlay() {
    if (this._reviewOverlay) return;

    // Dim background
    const bg = this.add.graphics().setDepth(DEPTH_OVERLAY_BG);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 2048, 1024);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 2048, 1024),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => this._closeReviewOverlay());

    // Panel — same width and X as results panel
    const oPanelX = PANEL_X, oPanelY = 100, oPanelW = PANEL_W, oPanelH = 540;
    const panelGfx = this.add.graphics().setDepth(DEPTH_OVERLAY_FG);
    panelGfx.fillStyle(C.tealHex, 0.12);
    panelGfx.fillRect(oPanelX, oPanelY, oPanelW, oPanelH);
    panelGfx.lineStyle(2, C.tealHex, 0.9);
    panelGfx.strokeRect(oPanelX, oPanelY, oPanelW, oPanelH);

    // Title
    const title = this.add.text(CX, oPanelY + 38, 'INCORRECT PICKS', {
      fontSize: '16px', color: C.teal, fontFamily: "'Syncopate', sans-serif", letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setDepth(DEPTH_OVERLAY_TEXT);

    // Divider
    panelGfx.lineStyle(1, C.tealHex, 0.3);
    panelGfx.lineBetween(oPanelX + 20, oPanelY + 66, oPanelX + oPanelW - 20, oPanelY + 66);

    // List
    const listObjs = [];
    this._reviewList.forEach((sentence, i) => {
      const y = oPanelY + 90 + i * 36;

      const label = this.add.text(oPanelX + 20, y, `${i + 1}.`, {
        fontSize: '12px', color: C.tealDim, fontFamily: 'monospace',
      }).setOrigin(0, 0).setDepth(DEPTH_OVERLAY_TEXT);

      const text = this.add.text(oPanelX + 46, y, sentence, {
        fontSize: '13px', color: '#F0E8D0', fontFamily: 'monospace',
        wordWrap: { width: oPanelW - 80, useAdvancedWrap: true },
      }).setOrigin(0, 0).setDepth(DEPTH_OVERLAY_TEXT);

      listObjs.push(label, text);
    });

    // Close hint
    const closeHint = this.add.text(CX, oPanelY + oPanelH - 26, 'CLICK ANYWHERE TO CLOSE', {
      fontSize: '11px', color: C.tealDim, fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5, 0.5).setDepth(DEPTH_OVERLAY_TEXT);

    this._reviewOverlay = { bg, panelGfx, title, listObjs, closeHint };
  }

  _closeReviewOverlay() {
    if (!this._reviewOverlay) return;
    const { bg, panelGfx, title, listObjs, closeHint } = this._reviewOverlay;
    bg.destroy();
    panelGfx.destroy();
    title.destroy();
    closeHint.destroy();
    listObjs.forEach(o => o.destroy());
    this._reviewOverlay = null;

    // Brief guard so the closing click doesn't also fire the "return" handler
    this._closingOverlay = true;
    this.time.delayedCall(80, () => { this._closingOverlay = false; });
  }
}
