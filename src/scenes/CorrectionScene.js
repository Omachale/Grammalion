import * as Phaser from 'phaser';
import { correction } from '../data/sentences';
import PowerBar from '../ui/PowerBar';
import { startCountdown } from '../ui/countdown';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

// ─── Fisher-Yates shuffle (pure, no side effects on original array) ───────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Shared colours ───────────────────────────────────────────────────────────
const C = {
  brass:       '#D4A017',
  brassHex:    0xD4A017,
  cream:       '#F0E8D0',
  gold:        '#FFD700',
  panelDark:   0x1A1007,
  panelBorder: 0x4A3010,
  inputBg:     0x0A0F1A,
  inputBorder: 0x4A7A9B,
  timerBg:     0x0A0F0A,
  green:       '#22BB44',
  red:         '#CC3344',
  hintDim:     '#3A8A4A',
};

// ─── Timer limits (ms). null = no timer. ─────────────────────────────────────
const TIMER_LIMITS = { Off: null, Slow: 12000, Medium: 7500, Fast: 4500 };

// OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
const GAME_CENTER_X = 687;  // 312 + (750 / 2) = centre of the Display4 screen area

// ─── Vial fraction for a given elapsed/limit ratio ───────────────────────────
function vialFraction(elapsed, limit) {
  if (limit === null) return { fraction: 0, tierColor: null };
  const ratio = elapsed / limit;
  if (ratio <= 0.33) return { fraction: 1.0,  tierColor: null };       // full speed → green
  if (ratio <= 0.66) return { fraction: 0.66, tierColor: 0xD4A017 };  // mid → yellow
  return                    { fraction: 0.33, tierColor: 0xCC3344 };  // slow → red
}

// ─────────────────────────────────────────────────────────────────────────────

export default class CorrectionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CorrectionScene' });
  }

  // Phaser calls init() before create(); receives data from scene.start()
  init(data) {
    this._grammar = data.grammar || 'Present Simple';
    this._task    = data.task    || 'Correction';
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
    this._correct           = 0;
    this._wrong             = 0;
    this._questionIndex     = 0;
    this._typedAnswer       = '';
    this._cursorVisible     = true;
    this._inputLocked       = true;   // locked until word is clicked (and countdown)
    this._wordClicked       = false;  // true once any word has been clicked this round
    this._wordObjects       = [];     // Text objects for the current sentence's words
    this._vialScore         = 0;     // cumulative sum of per-question fractions
    this._timerNeedsStart   = false;
    this._questionStartTime = 0;
    this._timeElapsed       = 0;

    // ── Question pool: shuffled, sliced to round length ──────────────────────
    this._questions = shuffle(correction).slice(0, this._rounds);

    // ── Question counter ────────────────────────────────────────────────────
    this._counterText = this.add.text(687, 50, '', {
      fontSize: '16px',
      color: C.brass,
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    // ── Sentence panel ──────────────────────────────────────────────────────
    const sentencePanel = this.add.graphics();
    sentencePanel.fillStyle(0x48C1C0, 0.2);
    sentencePanel.fillRect(312, 143, 750, 130);
    sentencePanel.lineStyle(2, 0x48C1C0, 0.6);
    sentencePanel.strokeRect(312, 143, 750, 130);

    // ── Timer bar ────────────────────────────────────────────────────────────
    const timerBgBar = this.add.graphics();
    timerBgBar.fillStyle(C.timerBg, 1);
    timerBgBar.fillRect(40, 213, 944, 5);

    this._timerBarGfx = this.add.graphics();

    // ── Input area container (hidden until correct word is clicked) ──────────
    this._inputContainer = this.add.container(0, 0).setAlpha(0);

    const inputBg = this.add.graphics();
    inputBg.fillStyle(C.inputBg, 1);
    inputBg.fillRect(487, 246, 400, 48);
    inputBg.lineStyle(2, C.inputBorder, 1);
    inputBg.strokeRect(487, 246, 400, 48);

    const inputLabel = this.add.text(687, 237, 'CORRECT THE VERB AND PRESS ENTER', {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
      letterSpacing: 2,
    }).setOrigin(0.5, 1);

    this._inputText = this.add.text(687, 270, '', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#48C1C0',
      fontFamily: "'Syncopate', sans-serif",
    }).setOrigin(0.5, 0.5);

    this._inputContainer.add([inputBg, inputLabel, this._inputText]);

    // ── Feedback text ────────────────────────────────────────────────────────
    // feedbackY = inputContainer bottom (y=294) + 30 = 324
    this._feedbackText = this.add.text(687, 324, '', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: C.green,
      fontFamily: "'Syncopate', sans-serif",
      wordWrap: { width: 940 },
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0);

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
        if (this._inputContainer.alpha > 0) {
          this._refreshInput();
        }
      },
    });

    // ── Keyboard input ───────────────────────────────────────────────────────
    this._keyHandler = (event) => this._handleKey(event);
    this.input.keyboard.on('keydown', this._keyHandler);

    // Clean up on scene shutdown
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this._keyHandler);
      this._cursorTimer.remove(false);
      this._clearWordObjects();
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

  // ─────────────────────────────────────────────────────────────────────────
  // Question display
  // ─────────────────────────────────────────────────────────────────────────

  _showQuestion() {
    const q = this._questions[this._questionIndex];

    this._wordClicked = false;
    this._inputLocked = true;
    this._typedAnswer = '';
    this._feedbackText.setAlpha(0);
    this._inputContainer.setAlpha(0);

    this._counterText.setText(`Question ${this._questionIndex + 1} of ${this._rounds}`);

    this._clearWordObjects();
    this._renderWords(q);

    this._timerNeedsStart   = (TIMER_LIMITS[this._timer] !== null);
    this._questionStartTime = 0;
  }

  // ─── Render each word as its own clickable Text object ───────────────────

  _renderWords(q) {
    const words      = q.sentence.split(' ');
    const wordGap    = 12;
    const originY    = 145;

    const textObjects = words.map((word) =>
      this.add.text(0, 0, word, {
        fontSize:   '18px',
        fontStyle:  'bold',
        color:      '#48C1C0',
        fontFamily: "'Syncopate', sans-serif",
      })
    );

    const totalWidth = textObjects.reduce((sum, t) => sum + t.width, 0)
                     + (words.length - 1) * wordGap;

    let cursorX = 687 - totalWidth / 2;

    textObjects.forEach((wordText, wordIndex) => {
      const originalY = originY;

      wordText.setOrigin(0, 0.5);
      wordText.setPosition(cursorX, originalY);
      wordText.setInteractive({ useHandCursor: true });

      wordText.on('pointerover', () => {
        if (this._wordClicked) return;
        wordText.setScale(1.15);
        wordText.setColor(C.gold);
        wordText._quiverTween = this.tweens.add({
          targets:  wordText,
          y:        originalY - 3,
          duration: 70,
          ease:     'Sine.easeInOut',
          yoyo:     true,
          repeat:   -1,
        });
      });

      wordText.on('pointerout', () => {
        if (this._wordClicked) return;
        wordText.setScale(1);
        wordText.setColor('#48C1C0');
        if (wordText._quiverTween) {
          wordText._quiverTween.stop();
          wordText._quiverTween = null;
        }
        wordText.setY(originalY);
      });

      wordText.on('pointerdown', () => {
        this._onWordClick(wordIndex, q, originalY, wordText);
      });

      this._wordObjects.push(wordText);
      cursorX += wordText.width + wordGap;
    });
  }

  // ─── Remove all word Text objects from the scene ─────────────────────────

  _clearWordObjects() {
    this._wordObjects.forEach((wt) => {
      if (wt._quiverTween) {
        wt._quiverTween.stop();
        wt._quiverTween = null;
      }
      wt.destroy();
    });
    this._wordObjects = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Word click handler
  // ─────────────────────────────────────────────────────────────────────────

  _onWordClick(wordIndex, q, originalY, wordText) {
    if (this._wordClicked) return;
    this._wordClicked = true;

    this._timeElapsed = this.time.now - this._questionStartTime;

    if (wordText._quiverTween) {
      wordText._quiverTween.stop();
      wordText._quiverTween = null;
      wordText.setY(originalY);
    }

    this._wordObjects.forEach((wt) => {
      if (wt._quiverTween) {
        wt._quiverTween.stop();
        wt._quiverTween = null;
      }
      wt.setScale(1);
      wt.setColor('#48C1C0');
    });

    if (wordIndex === q.wrongWordIndex) {
      this._typedAnswer = q.wrongWord;
      this._inputLocked = false;
      this._inputContainer.setAlpha(1);
      this._refreshInput();

      this._showFeedback(
        '✓  Now correct the verb form and press ENTER',
        '#4A9A5A',
        0.7
      );
    } else {
      this._wrong++;
      this._powerBar.addIncorrect();

      this.time.delayedCall(1400, () => {
        this.tweens.add({
          targets:  this._feedbackText,
          alpha:    0,
          duration: 300,
          onComplete: () => this._advance(),
        });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input display
  // ─────────────────────────────────────────────────────────────────────────

  _refreshInput() {
    const cursor = this._cursorVisible ? '|' : ' ';
    this._inputText.setText(this._typedAnswer + cursor);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard handling
  // ─────────────────────────────────────────────────────────────────────────

  _handleKey(event) {
    if (this._inputLocked) return;
    if (this._inputContainer.alpha < 1) return;

    if (event.key === 'Enter') {
      this._submitAnswer();
      return;
    }

    if (event.key === 'Backspace') {
      this._typedAnswer = this._typedAnswer.slice(0, -1);
      this._refreshInput();
      return;
    }

    if (
      event.key.length === 1 &&
      /[a-zA-Z']/.test(event.key) &&
      this._typedAnswer.length < 20
    ) {
      this._typedAnswer += event.key;
      this._refreshInput();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Answer submission
  // ─────────────────────────────────────────────────────────────────────────

  _submitAnswer() {
    const q       = this._questions[this._questionIndex];
    const typed   = this._typedAnswer.trim().toLowerCase();
    const correct = q.answer.toLowerCase();
    const isRight = typed === correct;

    this._inputLocked = true;

    if (isRight) {
      this._correct++;

      const limit = TIMER_LIMITS[this._timer];
      const { fraction, tierColor } = limit !== null
        ? vialFraction(this._timeElapsed, limit)
        : { fraction: 0, tierColor: null };

      this._vialScore += fraction;

      this._powerBar.addCorrect();
    } else {
      this._wrong++;

      this._powerBar.addIncorrect();
    }

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 300,
        onComplete: () => this._advance(),
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Feedback helper
  // ─────────────────────────────────────────────────────────────────────────

  _showFeedback(msg, color, alpha = 1) {
    this._feedbackText
      .setText(msg)
      .setColor(color)
      .setAlpha(alpha);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Advance to next question or end round
  // ─────────────────────────────────────────────────────────────────────────

  _advance() {
    this._questionIndex++;
    if (this._questionIndex >= this._rounds) {
      this._endRound();
    } else {
      this._showQuestion();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timer timeout
  // ─────────────────────────────────────────────────────────────────────────

  _onTimeout() {
    this._wordClicked = true;
    this._inputLocked = true;

    this._wrong++;
    this._powerBar.addIncorrect();

    this.cameras.main.shake(400, 0.012);

    this.time.delayedCall(1400, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 300,
        onComplete: () => this._advance(),
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // End of round
  // ─────────────────────────────────────────────────────────────────────────

  _endRound() {
    this.scene.start('ResultsScene', {
      correct:   this._correct,
      total:     this._rounds,
      vialScore: this._timer !== 'Off' ? (this._vialScore / this._rounds) : null,
      grammar:   this._grammar,
      task:      this._task,
      cefr:      this._cefr,
      rounds:    this._rounds,
      timer:     this._timer,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // update() — timer bar + timeout detection
  // ─────────────────────────────────────────────────────────────────────────

  update() {
    const limit = TIMER_LIMITS[this._timer];

    if (limit === null || this._wordClicked) {
      this._timerBarGfx.clear();
      return;
    }

    if (this._timerNeedsStart) {
      this._timerNeedsStart   = false;
      this._questionStartTime = this.time.now;
      return;
    }

    const elapsed  = this.time.now - this._questionStartTime;
    const fraction = Math.max(0, 1 - elapsed / limit);

    let barColor;
    if (fraction > 0.5)      barColor = 0x22BB44;
    else if (fraction > 0.2) barColor = 0xD4A017;
    else                     barColor = 0xCC3344;

    this._timerBarGfx.clear();
    this._timerBarGfx.fillStyle(barColor, 1);
    this._timerBarGfx.fillRect(40, 213, 944 * fraction, 5);

    if (fraction <= 0) {
      this._onTimeout();
    }
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
