import * as Phaser from 'phaser';
import { gapFill, gapFillContinuous, gapFillPast, gapFillVerbPatterns } from '../data/sentences';
import PowerBar from '../ui/PowerBar';
import MultiplayerHUD from '../ui/MultiplayerHUD';
import socketClient from '../network/SocketClient';
import roomManager  from '../network/RoomManager';
import { startCountdown } from '../ui/countdown';
import { POWER_BAR_X, POWER_BAR_Y, POWER_BAR_SCALE, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';

const TIMER_LIMITS = { Off: null, Slow: 12000, Medium: 7500, Fast: 4500 };

// ── Multiplayer layout (mirrors MultiChoiceScene for consistency) ────────────
const GAME_CENTER_X = 687;   // centre of the sentence panel (312 + 750/2)
const SCORE_CX      = 130;
const SCORE_Y0      = 160;
const SCORE_ROW     = 36;

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
    this.load.image('display4', 'assets/images/game/Display4.png');
    PowerBar.preload(this);
  }

  // Phaser calls init() before create(), ideal for receiving scene data
  init(data) {
    this._grammar = data.grammar || 'Present Simple';
    this._task    = data.task    || 'Gap Fill';
    this._cefr    = data.cefr   || 'A2';
    this._rounds  = data.rounds  || 10;
    this._timer   = data.timer   || 'Off';

    // ── Multiplayer context ────────────────────────────────────────────────────
    this._isMultiplayer = !!data.isMultiplayer;
    this._roomId        = data.roomId     || null;
    this._playerName    = data.playerName || null;
    this._duration      = data.duration   || null;   // null = no round timer
    this._startTime     = data.startTime  || null;
    this._players       = (data.players   || []).map(p => ({ playerName: p.playerName, score: 0 }));
    this._roundEnded    = false;
    this._interimPanel  = null;
    this._mpQuestions   = this._isMultiplayer ? (data.questions || []) : null;
    this._lastAnswer    = '';
  }

  create() {
    const cw = this.cameras.main.width;
    const ch = this.cameras.main.height;

    // ── Background: Display4 (self-contained so this scene works with or without GameBeamScene) ──
    const displayFrame = this.textures.getFrame('display4');
    const displayScale = Math.min(cw / displayFrame.realWidth, ch / displayFrame.realHeight);
    this.add.image(cw / 2, ch / 2, 'display4').setScale(displayScale);

    // ── Game state ──────────────────────────────────────────────────────────
    this._correct       = 0;
    this._wrong         = 0;
    this._questionIndex = 0;
    this._typedAnswer   = '';
    this._cursorVisible = true;
    this._inputLocked   = true;   // locked until countdown finishes

    // ── Question pool: server-provided in multiplayer; locally shuffled otherwise
    const POOLS = {
      'Present Simple':     gapFill,
      'Present Continuous': gapFillContinuous,
      'Past Simple':        gapFillPast,
      'Verb Patterns':      gapFillVerbPatterns,
    };
    this._questions = this._isMultiplayer
      ? this._mpQuestions
      : shuffle(POOLS[this._grammar] || gapFill).slice(0, this._rounds);

    // ── Question counter ────────────────────────────────────────────────────
    // (Removed for now)

    // ── Sentence panel (teal) ──────────────────────────────────────────────
    // OFFSET FORMULA: Game X = Display4 X + 106 (verified by manual positioning)
    const sentencePanelX = 312;
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
      if (this._isMultiplayer) {
        this._hud?.destroy();
        ['answerResult', 'scoreUpdate', 'roundEnd'].forEach(e => socketClient.offAll(e));
      }
    });

    // ── Scan line overlay ─────────────────────────────────────────────────────
    this.scene.run('ScanLineScene');

    // ── Multiplayer: HUD + socket handlers, then start immediately ────────────
    if (this._isMultiplayer) {
      this._createMultiplayerUI();
      this._registerSocketHandlers();
      this._inputLocked = false;
      this._showQuestion();
      return;
    }

    // ── Single-player: countdown then start (only when timer is active) ──────
    if (this._timerLimit) {
      startCountdown(this, () => this._showQuestion());
    } else {
      this._showQuestion();
    }
  }

  // ─── Multiplayer UI ───────────────────────────────────────────────────────

  _createMultiplayerUI() {
    this._hud = new MultiplayerHUD(this, {
      players:    this._players,
      playerName: this._playerName,
      duration:   this._duration,
      startTime:  this._startTime,
      timer:      { x: GAME_CENTER_X, y: 80 },
      scoreboard: { cx: SCORE_CX, y0: SCORE_Y0, rowSpacing: SCORE_ROW, panelWidth: 220 },
    });
  }

  // ─── Multiplayer socket handlers ──────────────────────────────────────────

  _registerSocketHandlers() {
    // Server validated our answer
    socketClient.on('answerResult', (data) => {
      if (this._roundEnded) return;

      if (data.correct) {
        this._correct++;
        this._powerBar.addCorrect();
        this._showFeedback('✓ CORRECT', '#22BB44');
      } else {
        this._wrong++;
        this._powerBar.addIncorrect();
        const shown = (data.correctAnswers || []).join(' / ');
        this._showFeedback('✗ ' + (shown || 'WRONG'), '#CC3344');
        this.cameras.main.shake(200, 0.008);
      }

      this.time.delayedCall(1200, () => {
        this._questionIndex++;
        if (this._questionIndex >= this._rounds) {
          // Guard: if roundEnd arrived during the 1200ms feedback delay,
          // the victory screen is already showing — don't draw interim on top.
          if (!this._roundEnded) this._showInterimScreen();
        } else {
          this._showQuestion();
        }
      });
    });

    // Another player's score changed
    socketClient.on('scoreUpdate', (data) => {
      this._hud?.setScore(data.playerName, data.score);
    });

    // Round over — server has applied time bonuses and sent final scores
    socketClient.on('roundEnd', (data) => {
      this._roundEnded = true;
      this._hud?.setRoundEnded();
      this._showVictoryScreen(data.scores);
    });
  }

  // ─── Interim screen (player finished early, waiting for others) ───────────

  _showInterimScreen() {
    this._inputLocked = true;
    const n    = Math.min(this._players.length, 4);
    const panH = 60 + n * 40 + 20;
    const panY = 300;

    const panel = this.add.rectangle(GAME_CENTER_X, panY, 500, panH, 0x060c14, 0.97)
      .setStrokeStyle(2, 0x48C1C0, 1)
      .setDepth(20);

    const header = this.add.text(GAME_CENTER_X, panY - panH / 2 + 28, 'WAITING FOR OTHER PLAYERS...', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '13px',
      fontStyle:       'bold',
      color:           '#2a6a6a',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(21);

    const rowY0  = panY - panH / 2 + 58;
    const rows   = [];
    const sorted = [...this._players].sort((a, b) => b.score - a.score);

    sorted.slice(0, 4).forEach((p, i) => {
      const isMe = p.playerName === this._playerName;
      const y    = rowY0 + i * 40;
      rows.push(
        this.add.text(GAME_CENTER_X, y,
          (isMe ? '▶ ' : '  ') + p.playerName + '  —  PLAYING', {
          fontFamily: "'Syncopate', monospace",
          fontSize:   '13px',
          fontStyle:  'bold',
          color:      isMe ? '#88ffff' : '#48C1C0',
        }).setOrigin(0.5, 0.5).setDepth(21)
      );
    });

    this._interimPanel = { panel, header, rows };
  }

  // ─── Victory screen (final scores with medals) ───────────────────────────

  _showVictoryScreen(scores) {
    // Remove the interim waiting screen if it was shown
    if (this._interimPanel) {
      const { panel, header, rows } = this._interimPanel;
      panel.destroy();
      header.destroy();
      rows.forEach(r => r.destroy());
      this._interimPanel = null;
    }

    this._inputLocked = true;

    const n     = Math.min(scores.length, 4);
    const panH  = 90 + n * 46 + 60;
    const panCY = 300;

    this.add.rectangle(GAME_CENTER_X, panCY, 580, panH, 0x060c14, 0.97)
      .setStrokeStyle(2, 0x48C1C0, 1)
      .setDepth(20);

    this.add.text(GAME_CENTER_X, panCY - panH / 2 + 38, 'ROUND  OVER', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '26px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(21);

    const medals = ['1ST', '2ND', '3RD', '4TH'];
    const rowY0  = panCY - panH / 2 + 86;

    scores.slice(0, 4).forEach((p, i) => {
      const isMe = p.playerName === this._playerName;
      const y    = rowY0 + i * 46;
      const col  = i === 0 ? '#FFD700' : '#48C1C0';

      this.add.text(GAME_CENTER_X - 240, y, medals[i], {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '11px',
        fontStyle:  'bold',
        color:      col,
      }).setOrigin(0, 0.5).setDepth(21);

      this.add.text(GAME_CENTER_X - 185, y,
        (isMe ? '▶ ' : '') + p.playerName, {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '15px',
        fontStyle:  'bold',
        color:      isMe ? '#88ffff' : col,
      }).setOrigin(0, 0.5).setDepth(21);

      this.add.text(GAME_CENTER_X + 240, y, p.score + ' pts', {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '14px',
        fontStyle:  'bold',
        color:      col,
      }).setOrigin(1, 0.5).setDepth(21);
    });

    // Back to menu button
    const btnY = rowY0 + n * 46 + 20;
    const back = this.add.text(GAME_CENTER_X, btnY, '◀  BACK TO MENU', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '13px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true }).setDepth(21);

    back.on('pointerover', () => back.setColor('#88ffff'));
    back.on('pointerout',  () => back.setColor('#48C1C0'));
    back.on('pointerdown', () => {
      roomManager.leave();
      this.scene.stop('GameBeamScene');
      this.scene.start('MainScene');
    });
  }

  // ─── Return button ────────────────────────────────────────────────────────

  _addReturnButton() {
    const menuBtn = this.add.image(MENU_BTN_X, MENU_BTN_Y, 'menu-btn');
    menuBtn.setOrigin(0.5, 0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.setScale(MENU_BTN_SCALE);
    menuBtn.on('pointerdown', () => {
      // Multiplayer: leave the room cleanly before tearing down the scene
      if (this._isMultiplayer) roomManager.leave();
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
    // ── Multiplayer path: emit to server, wait for answerResult ──────────────
    if (this._isMultiplayer) {
      if (this._inputLocked || this._roundEnded) return;
      this._inputLocked = true;
      this._lastAnswer  = this._typedAnswer.trim();
      socketClient.emit('submitAnswer', {
        roomId:        this._roomId,
        questionIndex: this._questionIndex,
        answer:        this._lastAnswer,
      });
      return;
    }

    // ── Single-player path ────────────────────────────────────────────────────
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
    // ── Multiplayer: drive round-level countdown timer via shared HUD ─────────
    if (this._isMultiplayer) {
      this._hud?.update();
      return;
    }

    // ── Single-player per-question timer bar ─────────────────────────────────
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
