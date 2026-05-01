import * as Phaser from 'phaser';
import { multiChoice, multiChoiceVerbPatterns } from '../data/sentences';

const MC_POOLS = {
  'Present Simple': multiChoice,
  'Verb Patterns':  multiChoiceVerbPatterns,
};
import PowerBar from '../ui/PowerBar';
import { startCountdown } from '../ui/countdown';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Shared colours ────────────────────────────────────────────────────────────
const C = {
  brass:        '#D4A017',
  brassHex:     0xD4A017,
  cream:        '#F0E8D0',
  panelDark:    0x1A1007,
  panelBorder:  0x4A3010,
  hintBorder:   0x4A7A9B,
  hintBg:       0x0A0F1A,
  btnIdle:      0x48C1C0,
  btnBorder:    0x48C1C0,
  btnHover:     0x5ADDDD,
  btnCorrect:   0x22BB44,
  btnWrong:     0xBB2244,
  green:        '#22BB44',
  red:          '#CC3344',
};

const BTN_W   = 180;
const BTN_H   = 52;
const BTN_GAP = 40;    // horizontal gap between the two buttons

// OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
const GAME_CENTER_X = 783;  // 408 + (750 / 2) = center of UI panels

const TIMER_LIMITS = { Off: null, Slow: 12000, Medium: 7500, Fast: 4500 };

export default class MultiChoiceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MultiChoiceScene' });
  }

  init(data) {
    this._grammar = data.grammar || 'Present Simple';
    this._task    = data.task    || 'Multichoice';
    this._cefr    = data.cefr   || 'A2';
    this._rounds  = data.rounds  || 10;
    this._timer   = data.timer   || 'Off';
  }

  preload() {
    this.load.image('menu-btn', 'assets/images/game/Menu.png');
    PowerBar.preload(this);
  }

  create() {
    // ── Game state ──────────────────────────────────────────────────────────
    this._correct       = 0;
    this._wrong         = 0;
    this._questionIndex = 0;
    this._locked        = true;   // locked until countdown finishes

    // Shuffled pool sliced to round length — grammar-based selection
    this._questions = shuffle(MC_POOLS[this._grammar] || multiChoice).slice(0, this._rounds);

    // ── Question counter ────────────────────────────────────────────────────
    this._counterText = this.add.text(GAME_CENTER_X, 50, '', {
      fontSize: '16px',
      color: C.brass,
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    // ── Sentence panel ──────────────────────────────────────────────────────
    // Centered at GAME_CENTER_X = 783, width 750, same as GameScene
    const PANEL_X = 495, PANEL_Y = 143, PANEL_W = 750, PANEL_H = 180;
    const sentencePanel = this.add.graphics();
    sentencePanel.fillStyle(0x48C1C0, 0.2);
    sentencePanel.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    sentencePanel.lineStyle(2, 0x48C1C0, 0.6);
    sentencePanel.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

    // Sentence text (static panel, changes per question)
    // Center the text to the sentence panel center: 495 + 375 = 870
    // Panel center Y = 143 + 130/2 = 208
    this._sentenceText = this.add.text(870, 208, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: 720, useAdvancedWrap: true },
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // ── Answer buttons (created dynamically per question in _showQuestion) ───
    this._buttons = [];

    // ── Feedback text ────────────────────────────────────────────────────────
    this._feedbackText = this.add.text(GAME_CENTER_X, 360, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: C.green,
      fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: 940 },
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // ── Power bar (replaces ScoreDial + ScoreVial) ───────────────────────────
    this._powerBar = new PowerBar(this, POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, this._rounds);

    // ── Timer setup ──────────────────────────────────────────────────────────
    this._timerLimit        = TIMER_LIMITS[this._timer] || null;
    this._timerActive       = false;
    this._timerNeedsStart   = false;
    this._questionStartTime = 0;
    this._vialSum           = 0;

    const timerBarBg = this.add.graphics();
    if (this._timerLimit) {
      timerBarBg.fillStyle(0x0A0F0A, 1);
      timerBarBg.fillRect(40, 213, 944, 5);
    }
    this._timerBarGfx = this.add.graphics();

    // ── Return button ────────────────────────────────────────────────────────
    this._addReturnButton();

    // ── Shutdown cleanup ─────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
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

  // ─── Button factory ───────────────────────────────────────────────────────

  _makeButton(x, y, w, h, index) {
    const container = this.add.container(0, 0);

    const bg = this.add.graphics();
    this._drawBtn(bg, x, y, w, h, 'idle');

    const label = this.add.text(x + w / 2, y + h / 2, '', {
      fontSize: '22px',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      if (!this._locked) this._drawBtn(bg, x, y, w, h, 'hover');
    });
    hit.on('pointerout', () => {
      if (!this._locked) this._drawBtn(bg, x, y, w, h, 'idle');
    });
    hit.on('pointerdown', () => {
      if (!this._locked) this._selectAnswer(index);
    });

    container.add([bg, label, hit]);

    return { container, bg, label, hit, x, y, w, h };
  }

  _drawBtn(gfx, x, y, w, h, state) {
    gfx.clear();
    let fill, border;
    if (state === 'idle')    { fill = C.btnIdle;    border = C.btnBorder;  }
    if (state === 'hover')   { fill = C.btnHover;   border = 0x5ADDDD;     }
    if (state === 'correct') { fill = C.btnCorrect; border = 0x44EE66;     }
    if (state === 'wrong')   { fill = C.btnWrong;   border = 0xFF4466;     }

    gfx.fillStyle(fill, 0.2);
    gfx.fillRect(x, y, w, h);
    gfx.lineStyle(2, border, 1);
    gfx.strokeRect(x, y, w, h);
  }

  // ─── Question display ─────────────────────────────────────────────────────

  _showQuestion() {
    const q = this._questions[this._questionIndex];

    // Destroy buttons from the previous question
    this._buttons.forEach(btn => {
      btn.bg.destroy();
      btn.label.destroy();
      btn.hit.destroy();
      btn.container.destroy();
    });
    this._buttons = [];

    this._locked = false;

    this._counterText.setText(`Question ${this._questionIndex + 1} of ${this._rounds}`);
    this._sentenceText.setText(q.prompt);
    this._fitTextToPanel(this._sentenceText, 750, 130, 12);
    this._feedbackText.setAlpha(0);

    // Create buttons dynamically based on how many options this question has
    const n      = q.options.length;
    const totalW = BTN_W * n + BTN_GAP * (n - 1);
    const startX = 870 - totalW / 2;
    const btnY   = 350;

    for (let i = 0; i < n; i++) {
      const btnX = startX + i * (BTN_W + BTN_GAP);
      const btn  = this._makeButton(btnX, btnY, BTN_W, BTN_H, i);
      btn.label.setText(q.options[i]);
      this._buttons.push(btn);
    }

    this._timerActive     = false;
    this._timerNeedsStart = !!this._timerLimit;
  }

  // ─── Answer selection ─────────────────────────────────────────────────────

  _selectAnswer(btnIndex) {
    const q              = this._questions[this._questionIndex];
    const chosen         = q.options[btnIndex];
    const correctAnswers = q.answer.split('/').map(s => s.trim());
    const isRight        = correctAnswers.includes(chosen);

    const timerWasActive  = this._timerActive;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    const elapsed = timerWasActive ? Math.max(0, this.time.now - this._questionStartTime) : 0;

    this._locked = true;

    if (isRight) {
      this._correct++;
      // Highlight all correct options (handles dual-answer questions)
      this._buttons.forEach((btn, i) => {
        if (correctAnswers.includes(q.options[i])) {
          this._drawBtn(btn.bg, btn.x, btn.y, BTN_W, BTN_H, 'correct');
        }
      });
      const { fraction } = this._timerLimit
        ? this._getVialFraction(elapsed)
        : { fraction: 0 };
      this._vialSum += fraction;
      this._powerBar.addCorrect();
    } else {
      this._wrong++;
      this._drawBtn(this._buttons[btnIndex].bg, this._buttons[btnIndex].x, this._buttons[btnIndex].y, BTN_W, BTN_H, 'wrong');
      // Highlight all correct options so player sees what was right
      this._buttons.forEach((btn, i) => {
        if (correctAnswers.includes(q.options[i])) {
          this._drawBtn(btn.bg, btn.x, btn.y, BTN_W, BTN_H, 'correct');
        }
      });
      this._powerBar.addIncorrect();
    }

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 250,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) {
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
          } else {
            this._showQuestion();
          }
        },
      });
    });
  }

  _showFeedback(msg, color) {
    this._feedbackText.setText(msg).setColor(color).setAlpha(1);
  }

  // ─── Vial fraction helper ─────────────────────────────────────────────────

  _getVialFraction(elapsedMs) {
    if (!this._timerLimit) return { fraction: 0, tierColor: null };
    const ratio = elapsedMs / this._timerLimit;
    if (ratio <= 0.33) return { fraction: 1.0,  tierColor: null };       // full speed → green
    if (ratio <= 0.66) return { fraction: 0.66, tierColor: 0xD4A017 };  // mid → yellow
    return                    { fraction: 0.33, tierColor: 0xCC3344 };  // slow → red
  }

  // ─── Timeout handler ──────────────────────────────────────────────────────

  _onTimeout() {
    if (!this._timerActive) return;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    this._locked          = true;

    this._wrong++;
    this._powerBar.addIncorrect();
    this._timerBarGfx.clear();
    this.cameras.main.shake(400, 0.012);

    const q              = this._questions[this._questionIndex];
    const correctAnswers = q.answer.split('/').map(s => s.trim());
    this._buttons.forEach((btn, i) => {
      if (correctAnswers.includes(q.options[i])) {
        this._drawBtn(btn.bg, btn.x, btn.y, BTN_W, BTN_H, 'correct');
      }
    });

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 250,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) {
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
          } else {
            this._showQuestion();
          }
        },
      });
    });
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

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
    if (elapsed >= this._timerLimit) {
      this._onTimeout();
      return;
    }

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
