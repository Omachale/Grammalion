import * as Phaser from 'phaser';
import { gapFill, gapFillContinuous, gapFillPast, gapFillVerbPatterns } from '../data/sentences';
import PowerBar from '../ui/PowerBar';
import { startCountdown } from '../ui/countdown';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

const TIMER_LIMITS = { Off: null, Slow: 12000, Medium: 7500, Fast: 4500 };

// ─── Fisher-Yates shuffle (pure function, no side effects on original) ────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('menu-btn', 'assets/images/game/Menu.png');
    PowerBar.preload(this);
  }

  // Phaser calls init() before create(), ideal for receiving scene data
  init(data) {
    this._grammar = data.grammar || 'Present Simple';
    this._task    = data.task    || 'Gap Fill';
    this._cefr    = data.cefr   || 'A2';
    this._rounds  = data.rounds  || 10;
    this._timer   = data.timer   || 'Off';
  }

  create() {
    // ── Game state ──────────────────────────────────────────────────────────
    this._correct       = 0;
    this._wrong         = 0;
    this._questionIndex = 0;
    this._typedAnswer   = '';
    this._cursorVisible = true;
    this._inputLocked   = true;   // locked until countdown finishes

    // ── Question pool: choose bank by grammar point, shuffle, slice ─────────
    const POOLS = {
      'Present Simple':     gapFill,
      'Present Continuous': gapFillContinuous,
      'Past Simple':        gapFillPast,
      'Verb Patterns':      gapFillVerbPatterns,
    };
    const pool = POOLS[this._grammar] || gapFill;
    this._questions = shuffle(pool).slice(0, this._rounds);

    // ── Question counter ────────────────────────────────────────────────────
    // (Removed for now)

    // ── Sentence panel (teal) ──────────────────────────────────────────────
    // OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
    const sentencePanelX = 495;
    const sentencePanelY = 143;
    const sentencePanelW = 750;
    const sentencePanelH = 180;
    // ── Center of UI: Game X = 408 + 375 = 783 ────────────────────────────

    const sentencePanel = this.add.graphics();
    sentencePanel.fillStyle(0x48C1C0, 0.2);  // Teal with transparency
    sentencePanel.fillRect(sentencePanelX, sentencePanelY, sentencePanelW, sentencePanelH);
    sentencePanel.lineStyle(2, 0x48C1C0, 0.6);
    sentencePanel.strokeRect(sentencePanelX, sentencePanelY, sentencePanelW, sentencePanelH);

    // Sentence text — inside the panel, constrained to panel dimensions
    this._sentenceText = this.add.text(sentencePanelX + sentencePanelW / 2, sentencePanelY + sentencePanelH / 2, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: sentencePanelW - 20, useAdvancedWrap: true },
      align: 'center',
    }).setOrigin(0.5, 0.5);

    // ── Input area (teal themed) ────────────────────────────────────────────
    const inputAreaY = 338;
    const inputAreaH = 67;

    const inputBg = this.add.graphics();
    inputBg.fillStyle(0x0A0F1A, 1);
    inputBg.fillRect(sentencePanelX, inputAreaY + 10, sentencePanelW, inputAreaH);
    inputBg.lineStyle(2, 0x48C1C0, 1);
    inputBg.strokeRect(sentencePanelX, inputAreaY + 10, sentencePanelW, inputAreaH);

    this._inputText = this.add.text(sentencePanelX + sentencePanelW / 2, inputAreaY + inputAreaH / 2 + 10, '', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
    }).setOrigin(0.5, 0.5);

    // ── Feedback text (below input area) ────────────────────────────────────
    const feedbackY = inputAreaY + inputAreaH + 30;  // 30px gap below input box
    this._feedbackText = this.add.text(sentencePanelX + sentencePanelW / 2, feedbackY, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#22BB44',
      fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: sentencePanelW },
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // ── Instruction text (below input area, hides when typing starts) ────────
    const instructionY = inputAreaY + inputAreaH + 20;  // 20px gap below input box
    this._instructionText = this.add.text(sentencePanelX + sentencePanelW / 2, instructionY, 'TYPE THE CORRECT FORM AND PRESS ENTER', {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    // ── Score dial ───────────────────────────────────────────────────────────
    // (Removed for now - will be updated soon)

    // ── Timer setup ──────────────────────────────────────────────────────────
    this._timerLimit        = TIMER_LIMITS[this._timer] || null;
    this._timerActive       = false;
    this._timerNeedsStart   = false;
    this._questionStartTime = 0;
    this._vialSum           = 0;

    // Timer bar (only drawn if timer is active)
    const timerBarBg = this.add.graphics();
    if (this._timerLimit) {
      timerBarBg.fillStyle(0x0A0F0A, 1);
      timerBarBg.fillRect(40, 213, 944, 5);
    }
    this._timerBarGfx = this.add.graphics();

    // ── Power bar (replaces ScoreDial + ScoreVial) ───────────────────────────
    this._powerBar = new PowerBar(this, POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, this._rounds);

    // ── Return button ────────────────────────────────────────────────────────
    this._addReturnButton();

    // ── Cursor blink timer ───────────────────────────────────────────────────
    this._cursorTimer = this.time.addEvent({
      delay: 500,
      loop:  true,
      callback: () => {
        this._cursorVisible = !this._cursorVisible;
        this._refreshInput();
      },
    });

    // ── Keyboard input ───────────────────────────────────────────────────────
    this._keyHandler = (event) => this._handleKey(event);
    this.input.keyboard.on('keydown', this._keyHandler);

    // Clean up on scene shutdown to prevent listener leaks
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this._keyHandler);
      this._cursorTimer.remove(false);
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
      // Stop this game scene and any overlay scenes, returning to MainScene
      this.scene.stop('GameBeamScene');
      this.scene.stop();
    });
  }

  // ─── Question display ─────────────────────────────────────────────────────

  _showQuestion() {
    const q = this._questions[this._questionIndex];
    this._sentenceText.setText(q.prompt);
    this._inputLocked = false;
    this._typedAnswer = '';
    this._feedbackText.setAlpha(0);
    // this._instructionText.setAlpha(1);  // Keep instruction text hidden after first interaction
    this._refreshInput();
    this._timerActive     = false;
    this._timerNeedsStart = !!this._timerLimit;
  }

  _refreshInput() {
    const cursor = this._cursorVisible ? '|' : ' ';
    this._inputText.setText(this._typedAnswer + cursor);
  }

  // ─── Keyboard handling ────────────────────────────────────────────────────

  _handleKey(event) {
    if (this._inputLocked) return;

    if (event.key === 'Enter') {
      this._submitAnswer();
      return;
    }

    if (event.key === 'Backspace') {
      this._typedAnswer = this._typedAnswer.slice(0, -1);
      this._refreshInput();
      return;
    }

    // Accept letters, apostrophe, and space (needed for two-word forms like "is running")
    // Prevent leading space; cap at 25 chars
    if (event.key === ' ' && this._typedAnswer.length === 0) return;
    if (event.key.length === 1 && /[a-zA-Z' ]/.test(event.key) && this._typedAnswer.length < 25) {
      // Hide the instruction text on first character typed
      if (this._typedAnswer.length === 0) {
        this._instructionText.setAlpha(0);
      }
      this._typedAnswer += event.key;
      this._refreshInput();
    }
  }

  // ─── Answer evaluation ────────────────────────────────────────────────────

  _submitAnswer() {
    // Stop timer; capture elapsed only if the timer had actually started
    const timerWasActive  = this._timerActive;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    const elapsed = timerWasActive ? Math.max(0, this.time.now - this._questionStartTime) : 0;

    const q       = this._questions[this._questionIndex];
    const typed          = this._typedAnswer.trim().toLowerCase();
    const correctAnswers = q.answer.toLowerCase().split('/').map(s => s.trim());
    const isRight        = correctAnswers.includes(typed);

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

    // Fade out feedback then advance
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 300,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) {
            this._endRound();
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

  // ─── Timer helpers ─────────────────────────────────────────────────────────

  _getVialFraction(elapsedMs) {
    if (!this._timerLimit) return { fraction: 0, tierColor: null };
    const ratio = elapsedMs / this._timerLimit;
    if (ratio <= 0.33) return { fraction: 1.0,  tierColor: null };       // full speed → green
    if (ratio <= 0.66) return { fraction: 0.66, tierColor: 0xD4A017 };  // mid speed → yellow
    return                    { fraction: 0.33, tierColor: 0xCC3344 };  // slow → red
  }

  _onTimeout() {
    if (!this._timerActive) return;
    this._timerNeedsStart = false;
    this._timerActive     = false;
    this._inputLocked     = true;

    this._wrong++;
    this._powerBar.addIncorrect();

    this._timerBarGfx.clear();
    this.cameras.main.shake(400, 0.012);

    const q = this._questions[this._questionIndex];
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 300,
        onComplete: () => {
          this._questionIndex++;
          if (this._questionIndex >= this._rounds) {
            this._endRound();
          } else {
            this._showQuestion();
          }
        },
      });
    });
  }

  // ─── Frame loop ───────────────────────────────────────────────────────────

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
}
