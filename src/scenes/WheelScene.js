import * as Phaser from 'phaser';
import {
  correctSentencesByGrammar,
  wheelWrongByGrammar,
} from '../data/sentences';
import PowerBar from '../ui/PowerBar';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Wheel geometry ──────────────────────────────────────────────────────────
// A circular ring centred on screen. Sentence nodes sit evenly spaced on the
// midpoint of the rim. The selected sentence is always at the top (-90°).

const WHEEL_CX      = 687;
const WHEEL_CY      = 448;
const WHEEL_OUTER_R = 162;
const WHEEL_INNER_R = 118;
const WHEEL_RIM_R   = (WHEEL_OUTER_R + WHEEL_INNER_R) / 2;  // 140 — node centre
const NODE_R        = 19;   // radius of each sentence-node circle
const LABEL_OFFSET  = NODE_R + 30;  // px beyond node centre where label anchors

// Mistakes counter geometry
const BOX_W = 28, BOX_H = 28, BOX_GAP = 8;
const BOX_Y = 36;  // top-left y so the box centre sits at y≈50

// Depth layers
const DEPTH_WHEEL = 1;
const DEPTH_NODES = 2;
const DEPTH_PANEL = 10;
const DEPTH_UI    = 10;
const DEPTH_OVERLAY_BG   = 50;
const DEPTH_OVERLAY_FG   = 51;
const DEPTH_OVERLAY_TEXT = 52;

// OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
const GAME_CENTER_X = 687;  // 312 + (750 / 2) = centre of the Display4 screen area

export default class WheelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WheelScene' });
  }

  init(data) {
    this._grammar    = data.grammar    || 'Present Simple';
    this._task       = data.task       || 'Wheel';
    this._cefr       = data.cefr       || 'A2';
    this._timer      = data.timer      || 'Off';
    this._wheelMode  = data.wheelMode  || 'total';    // 'total' | 'mistakes'
    this._wheelValue = data.wheelValue || 5;          // N rounds OR N max mistakes
  }

  preload() {
    this.load.image('menu-btn', 'assets/images/Menu.png');
    this.load.image('review-btn', 'assets/images/Review.png');
    PowerBar.preload(this);
  }

  // ─── Grammar-aware pool selection ─────────────────────────────────────────

  _sourcePools() {
    const correct = correctSentencesByGrammar[this._grammar] || correctSentencesByGrammar['Present Simple'];
    const wrong   = wheelWrongByGrammar[this._grammar]       || wheelWrongByGrammar['Present Simple'];
    return { correct, wrong };
  }

  _refillCorrect() { this._correctPool = shuffle([...this._sourcePools().correct]); }
  _refillWrong()   { this._wrongPool   = shuffle([...this._sourcePools().wrong]);   }

  _popCorrect() { if (this._correctPool.length === 0) this._refillCorrect(); return this._correctPool.pop(); }
  _popWrong()   { if (this._wrongPool.length   === 0) this._refillWrong();   return this._wrongPool.pop();   }

  create() {
    // ── Pools ─────────────────────────────────────────────────────────────────
    this._correctPool = [];
    this._wrongPool   = [];
    this._refillCorrect();
    this._refillWrong();

    // ── Game state ────────────────────────────────────────────────────────────
    this._active       = [];    // [{ text, isCorrect, id }]
    this._count        = 0;     // sentences on wheel (2–10)
    this._wheelAngle   = -90;   // degrees; sentence[0] at top when wheelAngle + 0° = -90°
    this._topIndex     = 0;
    this._spinning     = false;
    this._rotateTween  = null;
    this._correct      = 0;
    this._wrong        = 0;
    this._inputLocked  = true;
    this._roundsPlayed = 0;     // total picks made (both modes)
    this._reviewList   = [];    // texts of incorrectly-picked sentences
    this._reviewOverlay = null; // overlay object while review panel is open

    // Per-sentence display objects (rebuilt whenever _active changes)
    this._nodeGfx       = [];
    this._nodeLabelText = [];

    // ── Static wheel ring ─────────────────────────────────────────────────────
    this._wheelRingGfx = this.add.graphics().setDepth(DEPTH_WHEEL);
    this._drawWheelRing();

    // ── Sentence panel ────────────────────────────────────────────────────────
    const panelGfx = this.add.graphics().setDepth(DEPTH_PANEL);
    panelGfx.fillStyle(0x48C1C0, 0.2);
    panelGfx.fillRect(312, 143, 750, 130);
    panelGfx.lineStyle(2, 0x48C1C0, 0.6);
    panelGfx.strokeRect(312, 143, 750, 130);

    // Large readable text for the selected (top) sentence
    // Center the text to the sentence panel center: 312 + 375 = 687
    // Panel center Y = 143 + 130/2 = 208
    this._sentenceText = this.add.text(687, 208, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      align: 'center',
      wordWrap: { width: 720, useAdvancedWrap: true },
    }).setOrigin(0.5, 0.5).setDepth(DEPTH_PANEL);

    // ── Top counter — conditional on mode ────────────────────────────────────
    if (this._wheelMode === 'total') {
      this._levelText     = this.add.text(GAME_CENTER_X, 50, '', {
        fontSize: '16px', color: '#D4A017', fontFamily: 'monospace', letterSpacing: 2,
      }).setOrigin(0.5, 0.5).setDepth(DEPTH_UI);
      this._mistakeBoxGfx = null;
      this._mistakeBoxes  = null;
    } else {
      // Mistakes mode: N brass-bordered boxes replace the level counter
      this._levelText     = null;
      this._mistakeBoxGfx = null;
      this._mistakeBoxes  = [];
      this._buildMistakesCounter();
    }

    // ── Feedback text (just below the panel) ─────────────────────────────────
    this._feedbackText = this.add.text(GAME_CENTER_X, 236, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#22BB44',
      fontFamily: "'Syncopate', sans-serif",
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(DEPTH_UI);

    // ── Power bar (replaces ScoreDial) ────────────────────────────────────────
    this._powerBar = new PowerBar(this, POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, this._wheelValue);

    // ── Buttons ───────────────────────────────────────────────────────────────
    this._addReturnButton();
    this._createReviewButton();

    // ── Keyboard ──────────────────────────────────────────────────────────────
    this._keyHandler = (e) => this._handleKey(e);
    this.input.keyboard.on('keydown', this._keyHandler);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this._keyHandler);
      if (this._rotateTween) this._rotateTween.stop();
      this._powerBar.destroy();
      this.scene.stop('ScanLineScene');
    });

    // ── Scan line overlay ─────────────────────────────────────────────────────
    this.scene.run('ScanLineScene');

    // ── Start ─────────────────────────────────────────────────────────────────
    this._buildInitialWheel();
    this._inputLocked = false;
  }

  // ─── Mistakes counter ─────────────────────────────────────────────────────

  _buildMistakesCounter() {
    const N     = this._wheelValue;
    const total = N * BOX_W + (N - 1) * BOX_GAP;
    this._mistakeStartX = 687 - total / 2;

    for (let i = 0; i < N; i++) {
      this._mistakeBoxes.push({ red: false });
    }
    this._mistakeBoxGfx = this.add.graphics().setDepth(DEPTH_UI);
    this._redrawMistakesCounter();
  }

  _redrawMistakesCounter() {
    this._mistakeBoxGfx.clear();
    this._mistakeBoxes.forEach((box, i) => {
      const x    = this._mistakeStartX + i * (BOX_W + BOX_GAP);
      const fill = box.red ? 0xBB2244 : 0x22BB44;
      this._mistakeBoxGfx.fillStyle(fill, 1);
      this._mistakeBoxGfx.fillRect(x, BOX_Y, BOX_W, BOX_H);
      this._mistakeBoxGfx.lineStyle(2, 0xD4A017, 1);
      this._mistakeBoxGfx.strokeRect(x, BOX_Y, BOX_W, BOX_H);
    });
  }

  // ─── Draw the static wheel ring ───────────────────────────────────────────

  _drawWheelRing() {
    // Wheel ring visualization removed — nodes still move in circular pattern via WHEEL_RIM_R
  }

  // ─── Buttons ─────────────────────────────────────────────────────────────

  _addReturnButton() {
    const menuBtn = this.add.image(MENU_BTN_X, MENU_BTN_Y, 'menu-btn');
    menuBtn.setOrigin(0.5, 0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.setScale(MENU_BTN_SCALE);
    menuBtn.setDepth(DEPTH_UI);
    menuBtn.on('pointerdown', () => {
      this.scene.stop('GameBeamScene');
      this.scene.stop();
    });
  }

  _createReviewButton() {
    const x = 944;
    const y = 744;
    const reviewBtn = this.add.image(x, y, 'review-btn');
    reviewBtn.setOrigin(0.5, 0.5);
    reviewBtn.setScale(0.5);
    reviewBtn.setInteractive({ useHandCursor: true });
    reviewBtn.setDepth(DEPTH_UI);
    reviewBtn.on('pointerdown', () => this._showReviewOverlay());
  }

  // ─── Review overlay ───────────────────────────────────────────────────────

  _showReviewOverlay() {
    if (this._reviewOverlay) return;

    // Dim background — full screen, closes overlay on click
    const bg = this.add.graphics().setDepth(DEPTH_OVERLAY_BG);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 1374, 768);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 1374, 768),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => this._closeReviewOverlay());

    // Panel
    const panelGfx = this.add.graphics().setDepth(DEPTH_OVERLAY_FG);
    panelGfx.fillStyle(0x2C1F0E, 1);
    panelGfx.fillRect(337, 100, 700, 568);
    panelGfx.lineStyle(2, 0xD4A017, 1);
    panelGfx.strokeRect(337, 100, 700, 568);

    // Title
    const title = this.add.text(GAME_CENTER_X, 135, 'INCORRECT PICKS', {
      fontSize: '18px', color: '#D4A017', fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setDepth(DEPTH_OVERLAY_TEXT);

    // Divider line
    panelGfx.lineStyle(1, 0x4A3010, 0.8);
    panelGfx.lineBetween(357, 158, 1017, 158);

    // List items
    const listObjs = [];
    if (this._reviewList.length === 0) {
      listObjs.push(this.add.text(GAME_CENTER_X, 340, 'No mistakes yet!', {
        fontSize: '14px', color: '#5A4A2A', fontFamily: 'monospace', fontStyle: 'italic',
      }).setOrigin(0.5, 0.5).setDepth(DEPTH_OVERLAY_TEXT));
    } else {
      this._reviewList.forEach((sentence, i) => {
        const y = 178 + i * 36;
        const label = this.add.text(357, y, `${i + 1}.`, {
          fontSize: '12px', color: '#6A5A3A', fontFamily: 'monospace',
        }).setOrigin(0, 0).setDepth(DEPTH_OVERLAY_TEXT);

        const text = this.add.text(383, y, sentence, {
          fontSize: '13px', color: '#F0E8D0', fontFamily: 'monospace',
          wordWrap: { width: 620, useAdvancedWrap: true },
        }).setOrigin(0, 0).setDepth(DEPTH_OVERLAY_TEXT);

        listObjs.push(label, text);
      });
    }

    // Close hint
    const closeHint = this.add.text(GAME_CENTER_X, 650, 'CLICK ANYWHERE TO CLOSE', {
      fontSize: '11px', color: '#5A4A2A', fontFamily: 'monospace', letterSpacing: 3,
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
  }

  // ─── Wheel initialisation ─────────────────────────────────────────────────

  _buildInitialWheel() {
    this._active = shuffle([
      { text: this._popCorrect(), isCorrect: true,  id: 0 },
      { text: this._popWrong(),   isCorrect: false, id: 0 },
    ]);
    this._active.forEach((s, i) => { s.id = i + 1; });
    this._count      = 2;
    this._topIndex   = 0;
    this._wheelAngle = -90;

    this._rebuildNodeObjects();
    this._updateLevelText();
  }

  // ─── Advance to the next level ────────────────────────────────────────────

  _advanceLevel() {
    // In total mode the wheel is capped at 10 — don't advance past that
    const newLevel = (this._wheelMode === 'total')
      ? Math.min(this._count + 1, 10)
      : this._count + 1;

    const correctText = this._popCorrect();
    const wrongs = [];
    for (let i = 0; i < newLevel - 1; i++) wrongs.push(this._popWrong());

    this._active = shuffle([
      { text: correctText, isCorrect: true,  id: 0 },
      ...wrongs.map((text) => ({ text, isCorrect: false, id: 0 })),
    ]);
    this._active.forEach((s, i) => { s.id = i + 1; });
    this._count      = newLevel;
    this._topIndex   = 0;
    this._wheelAngle = -90;

    this._rebuildNodeObjects();
    this._updateLevelText();
    this._inputLocked = false;
  }

  // ─── Rebuild per-sentence display objects ─────────────────────────────────

  _rebuildNodeObjects() {
    this._nodeGfx.forEach(g => { if (g && g.active) g.destroy(); });
    this._nodeLabelText.forEach(t => { if (t && t.active) t.destroy(); });
    this._nodeGfx       = [];
    this._nodeLabelText = [];

    this._active.forEach(() => {
      this._nodeGfx.push(this.add.graphics().setDepth(DEPTH_NODES));
      this._nodeLabelText.push(
        this.add.text(0, 0, '', {
          fontSize: '11px', color: '#A09070', fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5).setDepth(DEPTH_NODES)
      );
    });

    this._updatePositions();
    this._updatePanelText();
  }

  // ─── Update node positions ────────────────────────────────────────────────

  _updatePositions() {
    const N       = this._count;
    const stepDeg = 360 / N;

    this._active.forEach((s, i) => {
      const gfx = this._nodeGfx[i];
      const lbl = this._nodeLabelText[i];
      if (!gfx || !gfx.active) return;

      const angleDeg = this._wheelAngle + i * stepDeg;
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const cosA     = Math.cos(angleRad);
      const sinA     = Math.sin(angleRad);

      const nx = WHEEL_CX + WHEEL_RIM_R * cosA;
      const ny = WHEEL_CY + WHEEL_RIM_R * sinA;

      let relAngle = ((angleDeg + 90) % 360 + 360) % 360;
      if (relAngle > 180) relAngle -= 360;
      const isTop = Math.abs(relAngle) < (stepDeg / 2);

      gfx.clear();
      if (isTop) {
        gfx.fillStyle(0xD4A017, 0.95);
        gfx.fillCircle(nx, ny, NODE_R + 3);
        gfx.lineStyle(2, 0xF0C840, 1);
        gfx.strokeCircle(nx, ny, NODE_R + 3);
      } else {
        gfx.fillStyle(0x2C1A0A, 0.85);
        gfx.fillCircle(nx, ny, NODE_R);
        gfx.lineStyle(1.5, 0x6A5030, 0.75);
        gfx.strokeCircle(nx, ny, NODE_R);
      }

      if (isTop) {
        lbl.setAlpha(0).setText('');
      } else {
        const words   = s.text.split(' ');
        const snippet = words.slice(0, 3).join(' ') + (words.length > 3 ? '…' : '');
        lbl.setText(`${s.id}.  ${snippet}`).setAlpha(1);

        const lx = WHEEL_CX + (WHEEL_RIM_R + LABEL_OFFSET) * cosA;
        const ly = WHEEL_CY + (WHEEL_RIM_R + LABEL_OFFSET) * sinA;

        if      (cosA >  0.25) lbl.setOrigin(0,   0.5);
        else if (cosA < -0.25) lbl.setOrigin(1,   0.5);
        else if (sinA >  0)    lbl.setOrigin(0.5, 0);
        else                   lbl.setOrigin(0.5, 1);

        lbl.setPosition(lx, ly);
      }
    });
  }

  // ─── Panel text ───────────────────────────────────────────────────────────

  _updatePanelText() {
    const top = this._active[this._topIndex];
    if (top) {
      this._sentenceText.setText(top.text).setColor('#48C1C0');
      this._fitTextToPanel(this._sentenceText, 750, 130, 12);
    }
  }

  _setPanelState(state) {
    if      (state === 'correct') this._sentenceText.setColor('#44CC66');
    else if (state === 'wrong')   this._sentenceText.setColor('#CC4444');
    else                          this._sentenceText.setColor('#48C1C0');
  }

  // ─── Level / counter text ─────────────────────────────────────────────────

  _updateLevelText() {
    if (this._levelText) {
      this._levelText.setText(`LEVEL  ${this._count - 1}  /  9`);
    }
    // Mistakes counter boxes are redrawn only when a mistake is made, not here
  }

  // ─── Keyboard input ───────────────────────────────────────────────────────

  _handleKey(e) {
    if (this._inputLocked || this._reviewOverlay) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      this._rotateBy(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      this._rotateBy(+1);
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (!this._spinning) this._selectCurrent();
    } else if (e.key >= '1' && e.key <= '9') {
      const n   = parseInt(e.key, 10);
      const idx = this._active.findIndex(s => s.id === n);
      if (idx >= 0) this._rotateTo(idx);
    }
  }

  // ─── Rotation ─────────────────────────────────────────────────────────────

  _rotateBy(delta) {
    if (this._spinning) return;
    const N      = this._count;
    const target = ((this._topIndex + delta) % N + N) % N;
    this._rotateTo(target);
  }

  _rotateTo(targetIndex, onComplete) {
    if (this._rotateTween) {
      this._rotateTween.stop();
      this._rotateTween = null;
    }

    const N       = this._count;
    const stepDeg = 360 / N;

    const targetWheelAngle = -90 - targetIndex * stepDeg;
    let delta = targetWheelAngle - this._wheelAngle;
    delta = ((delta + 180) % 360 + 360) % 360 - 180;

    const finalAngle = this._wheelAngle + delta;
    const duration   = Math.max(150, Math.abs(delta) * 5);

    this._spinning = true;
    const proxy = { angle: this._wheelAngle };

    this._rotateTween = this.tweens.add({
      targets:  proxy,
      angle:    finalAngle,
      duration,
      ease:     'Cubic.easeOut',
      onUpdate: () => {
        this._wheelAngle = proxy.angle;
        this._updatePositions();
      },
      onComplete: () => {
        this._wheelAngle  = finalAngle;
        this._topIndex    = targetIndex;
        this._spinning    = false;
        this._rotateTween = null;
        this._updatePositions();
        this._updatePanelText();
        if (onComplete) onComplete();
      },
    });
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  _selectCurrent() {
    const picked = this._active[this._topIndex];
    if (!picked) return;

    this._inputLocked = true;
    this._roundsPlayed++;

    if (picked.isCorrect) {
      this._correct++;
      this._powerBar.addCorrect();
      this._setPanelState('correct');

      // Total mode: end after N picks regardless of win/lose
      if (this._wheelMode === 'total' && this._roundsPlayed >= this._wheelValue) {
        this.time.delayedCall(1400, () => this._endRound());
        return;
      }
      // Mistakes mode: win when the wheel is at full size (10 sentences)
      if (this._wheelMode === 'mistakes' && this._count >= 10) {
        this.time.delayedCall(1400, () => this._endRound());
        return;
      }
      // Continue — advance to next level (capped at 10 in total mode)
      this.time.delayedCall(700, () => {
        this._setPanelState('idle');
        this._hideFeedback();
        this._advanceLevel();
      });

    } else {
      this._wrong++;
      this._powerBar.addIncorrect();
      this._setPanelState('wrong');
      this._reviewList.push(picked.text);   // record for review panel

      // Mistakes mode: flip a box red, then check for game-over
      if (this._wheelMode === 'mistakes') {
        this._mistakeBoxes[this._wrong - 1].red = true;
        this._redrawMistakesCounter();
        if (this._wrong >= this._wheelValue) {
          this._showFeedback('✗  Out of chances!', '#CC3344');
          this.cameras.main.shake(300, 0.008);
          this.time.delayedCall(1400, () => this._endRound());
          return;
        }
      }

      // Total mode: end after N picks
      if (this._wheelMode === 'total' && this._roundsPlayed >= this._wheelValue) {
        this._showFeedback('✗  Not quite!', '#CC3344');
        this.cameras.main.shake(300, 0.008);
        this.time.delayedCall(1400, () => this._endRound());
        return;
      }

      // Floor (2 sentences): reshuffle with fresh set
      if (this._count === 2) {
        this._showFeedback('✗  Not quite — reshuffling…', '#CC3344');
        this.cameras.main.shake(300, 0.008);
        this.time.delayedCall(1100, () => {
          this._setPanelState('idle');
          this._hideFeedback();
          this._reshuffle();
          this._inputLocked = false;
        });
      } else {
        // Remove the wrong sentence, keep the correct one
        this._showFeedback('✗  Not that one!', '#CC3344');
        this.cameras.main.shake(300, 0.008);
        this.time.delayedCall(600, () => {
          this._setPanelState('idle');
          this._hideFeedback();
          this._removeCurrentSentence();
        });
      }
    }
  }

  // ─── Remove / reshuffle ───────────────────────────────────────────────────

  _removeCurrentSentence() {
    const idx = this._topIndex;
    this._active.splice(idx, 1);
    this._count--;
    this._active.forEach((s, i) => { s.id = i + 1; });
    this._topIndex   = Math.min(idx, this._count - 1);
    this._wheelAngle = -90 - this._topIndex * (360 / this._count);

    this._rebuildNodeObjects();
    this._updateLevelText();
    this._inputLocked = false;
  }

  _reshuffle() {
    this._active = shuffle([
      { text: this._popCorrect(), isCorrect: true,  id: 0 },
      { text: this._popWrong(),   isCorrect: false, id: 0 },
    ]);
    this._active.forEach((s, i) => { s.id = i + 1; });
    this._count      = 2;
    this._topIndex   = 0;
    this._wheelAngle = -90;

    this._rebuildNodeObjects();
    this._updateLevelText();
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  _showFeedback(msg, color) {
    this._feedbackText.setText(msg).setColor(color).setAlpha(1);
  }

  _hideFeedback() {
    this._feedbackText.setAlpha(0);
  }

  // ─── End of round ─────────────────────────────────────────────────────────

  _endRound() {
    const roundsStr = `${this._wheelValue} ${this._wheelMode === 'total' ? 'Rounds' : 'Mistakes'}`;
    this.scene.start('ResultsScene', {
      correct:    this._correct,
      total:      this._correct + this._wrong,
      vialScore:  null,
      grammar:    this._grammar,
      task:       this._task,
      cefr:       this._cefr,
      rounds:     roundsStr,
      timer:      this._timer,
      reviewList: this._reviewList,
    });
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

