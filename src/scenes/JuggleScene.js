import * as Phaser from 'phaser';
import { PANEL_CX, MENU_BTN_X, MENU_BTN_Y, MENU_BTN_SCALE } from '../ui/gameScreenLayout';
import wordsets from '../assets/wordsets.json';
import socketClient from '../network/SocketClient';
import roomManager  from '../network/RoomManager';

// ─── Die grid constants ───────────────────────────────────────────────────────
const DIE_SIZE = 120;    // rendered px (square)
const DIE_STEP = 128;    // centre-to-centre spacing; gap = 8 px
const ROW_1_Y  = 195;
const ROW_2_Y  = ROW_1_Y + DIE_STEP;   // 323

// ─── Word sets loaded from wordsets.json ─────────────────────────────────────
// WORD_SET_5 and WORD_SET_6 are loaded dynamically in init()

// ─── Input row constants ────────────────────────────────────────────────────────
const INPUT_W      = 240;
const SUBMIT_W     = 160;
const INPUT_Y      = 425;
const INPUT_CX     = PANEL_CX - 206 + INPUT_W  / 2;   // PANEL_CX − 86
const SUBMIT_CX    = PANEL_CX + 206 - SUBMIT_W / 2;   // PANEL_CX + 126

// ─── Feedback & words box ──────────────────────────────────────────────────────
const FEEDBACK_Y   = 448;
const WORDS_BOX_W   = 672;
const WORDS_BOX_H   = 110;
const WORDS_BOX_Y   = 455 + WORDS_BOX_H / 2;   // 510
const WORDS_BOX_PAD = 8;

const FONT_STAGES = [
  { maxWords: 20, cols: 4, fontSize: '11px', lineHeight: 13 },
  { maxWords: 32, cols: 5, fontSize: '9px',  lineHeight: 11 },
  { maxWords: 40, cols: 6, fontSize: '8px',  lineHeight: 9  },
];

// ─── Multiplayer layout ───────────────────────────────────────────────────────
const SCORE_CX  = 310;   // centre-x of the live scoreboard (left column)
const SCORE_Y0  = 160;   // y-centre of the first player row
const SCORE_ROW = 36;    // row-to-row spacing

export default class JuggleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JuggleScene' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT  — Random selection + letter shuffling
  // ═══════════════════════════════════════════════════════════════════════════

  init(data) {
    const raw = data.rounds || '6 Letters';
    this._letterCount = raw.startsWith('5') ? 5 : 6;

    // Store multiplayer context (used by create() and _submitWord())
    this._isMultiplayer = !!data.isMultiplayer;
    this._roomId        = data.roomId    || null;
    this._playerName    = data.playerName || null;
    this._duration      = data.duration  || null;
    this._startTime     = data.startTime || null;
    this._players       = (data.players  || []).map(p => ({ playerName: p.playerName, score: 0 }));
    this._roundEnded    = false;

    // Parse word sets and convert arrays to Sets
    const WORD_SET_5 = wordsets.WORD_SET_5.map(set => ({
      letters: set.letters,
      words: new Set(set.words)
    }));
    const WORD_SET_6 = wordsets.WORD_SET_6.map(set => ({
      letters: set.letters,
      words: new Set(set.words)
    }));

    if (data.letters) {
      // ── Multiplayer: server provided the shuffled letters ─────────────────
      // Find the matching word set by sorting both letter strings and comparing.
      // e.g. server sends "ENIHS" → sorted "EHINS" matches "SHINE" sorted "EHINS"
      this._letters = data.letters.toUpperCase();
      const sortedProvided = this._letters.split('').sort().join('');
      const pool    = this._letterCount === 5 ? WORD_SET_5 : WORD_SET_6;
      const matching = pool.find(s => s.letters.split('').sort().join('') === sortedProvided);
      this._wordList = matching ? matching.words : new Set();
    } else {
      // ── Single player: pick a random set and shuffle ──────────────────────
      const wordSets    = this._letterCount === 5 ? WORD_SET_5 : WORD_SET_6;
      const selectedSet = wordSets[Math.floor(Math.random() * wordSets.length)];
      this._letters     = this._shuffleString(selectedSet.letters);
      this._wordList    = selectedSet.words;
    }
  }

  _shuffleString(str) {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRELOAD
  // ═══════════════════════════════════════════════════════════════════════════

  preload() {
    this.load.image('menu-btn', 'assets/images/game/Menu.png');
    this.load.image('display4', 'assets/images/game/Display4.png');

    // Preload all 26 letters to support any word set composition
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const l of allLetters) {
      this.load.image(`die-${l}-red`,   `assets/images/juggle/${l}R.png`);
      this.load.image(`die-${l}-green`, `assets/images/juggle/${l}G.png`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  create() {
    const cw = this.cameras.main.width;
    const ch = this.cameras.main.height;

    // ── State ─────────────────────────────────────────────────────────────────
    this._word           = '';
    this._selectionOrder = [];
    this._foundWords     = [];

    // ── Background: Display4 image ────────────────────────────────────────────
    const displayFrame = this.textures.getFrame('display4');
    const displayScale = Math.min(cw / displayFrame.realWidth, ch / displayFrame.realHeight);
    this.add.image(cw / 2, ch / 2, 'display4').setScale(displayScale);

    // ── Menu / back button ────────────────────────────────────────────────────
    const menuBtn = this.add.image(MENU_BTN_X, MENU_BTN_Y, 'menu-btn')
      .setScale(MENU_BTN_SCALE)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      this.scene.stop('GameBeamScene');
      this.scene.start('MainScene');
    });

    // ── Dice: dynamically positioned based on shuffled letters ────────────────
    const diePositions = this._buildDiePositions(this._letters, this._letterCount);
    this._dice = diePositions.map(({ letter, x, y }) => {
      const image = this.add.image(x, y, `die-${letter}-red`)
        .setDisplaySize(120, 120)
        .setOrigin(0.5, 0.5);

      const die = { letter, selected: false, image };

      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => this._selectDie(die));
      image.on('pointerover', () => { if (!die.selected) image.setAlpha(0.82); });
      image.on('pointerout',  () => image.setAlpha(1));

      return die;
    });

    // ── Instruction text ──────────────────────────────────────────────────────
    this.add.text(PANEL_CX, INPUT_Y - 22,
      'CLICK OR PRESS KEY  •  ENTER TO SUBMIT  •  BACKSPACE TO UNDO',
      {
        fontFamily:    'monospace',
        fontSize:      '10px',
        color:         '#2a6a6a',
        letterSpacing: 2,
      }
    ).setOrigin(0.5, 0.5);

    // ── Word-input panel ──────────────────────────────────────────────────────
    this.add.rectangle(INPUT_CX, INPUT_Y, INPUT_W, 40, 0x0a0f1a)
      .setStrokeStyle(2, 0x48c1c0, 0.8);

    this._wordText = this.add.text(INPUT_CX, INPUT_Y, '_', {
      fontFamily: "'Syncopate', monospace",
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#48C1C0',
    }).setOrigin(0.5, 0.5);

    // ── Submit button ─────────────────────────────────────────────────────────
    this._buildSubmitButton();

    // ── Feedback text ─────────────────────────────────────────────────────────
    this._feedbackText = this.add.text(PANEL_CX, FEEDBACK_Y, '', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '16px',
      fontStyle:       'bold',
      color:           '#22BB44',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // ── Found-words box ───────────────────────────────────────────────────────
    this.add.rectangle(PANEL_CX, WORDS_BOX_Y, WORDS_BOX_W, WORDS_BOX_H, 0x060c14)
      .setStrokeStyle(1, 0x2a6a6a, 0.9);

    this._foundHeaderText = this.add.text(
      PANEL_CX,
      WORDS_BOX_Y - WORDS_BOX_H / 2 + 9,
      `WORDS FOUND  0 / ${this._wordList.size}`,
      {
        fontFamily:    'monospace',
        fontSize:      '10px',
        color:         '#2a6a6a',
        letterSpacing: 2,
      }
    ).setOrigin(0.5, 0.5);

    this._foundWordsContainer = [];

    // ── Keyboard ──────────────────────────────────────────────────────────────
    this._keyHandler = (e) => {
      const key = e.key.toUpperCase();
      if (key === 'ENTER')     { this._submitWord(); return; }
      if (key === 'BACKSPACE') { this._backspace();  return; }
      const die = this._dice.find(d => d.letter === key);
      if (die) this._selectDie(die);
    };
    this.input.keyboard.on('keydown', this._keyHandler);

    // ── Clean up on shutdown ──────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this._keyHandler);
      if (this._isMultiplayer) {
        ['wordResult', 'scoreUpdate', 'roundEnd'].forEach(e => socketClient.offAll(e));
      }
    });

    // ── Multiplayer: live scoreboard + timer + socket handlers ────────────────
    if (this._isMultiplayer) {
      this._createMultiplayerUI();
      this._registerSocketHandlers();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC DIE POSITIONING
  // ═══════════════════════════════════════════════════════════════════════════

  _buildDiePositions(letters, count) {
    const positions = [];
    if (count === 5) {
      // 3 top + 2 staggered bottom
      for (let i = 0; i < 3; i++) {
        positions.push({
          letter: letters[i],
          x: PANEL_CX - DIE_STEP + i * DIE_STEP,
          y: ROW_1_Y,
        });
      }
      positions.push({
        letter: letters[3],
        x: PANEL_CX - DIE_STEP / 2,
        y: ROW_2_Y,
      });
      positions.push({
        letter: letters[4],
        x: PANEL_CX + DIE_STEP / 2,
        y: ROW_2_Y,
      });
    } else {
      // 3×2 aligned grid
      for (let i = 0; i < 6; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        positions.push({
          letter: letters[i],
          x: PANEL_CX - DIE_STEP + col * DIE_STEP,
          y: ROW_1_Y + row * DIE_STEP,
        });
      }
    }
    return positions;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT BUTTON
  // ═══════════════════════════════════════════════════════════════════════════

  _buildSubmitButton() {
    const bg = this.add.rectangle(SUBMIT_CX, INPUT_Y, SUBMIT_W, 40, 0x1a3a3a)
      .setStrokeStyle(2, 0x48c1c0, 1)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(SUBMIT_CX, INPUT_Y, 'SUBMIT', {
      fontFamily: "'Syncopate', monospace",
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#48C1C0',
    }).setOrigin(0.5, 0.5);

    bg.on('pointerdown',  () => this._submitWord());
    bg.on('pointerover',  () => { bg.setFillStyle(0x2a5555); label.setColor('#88ffff'); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x1a3a3a); label.setColor('#48C1C0'); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIE SELECTION & JIGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  _selectDie(die) {
    if (die.selected) return;
    die.selected = true;
    this._word += die.letter;
    this._selectionOrder.push(die);
    die.image.setTexture(`die-${die.letter}-green`);
    die.image.setAlpha(1);
    this._refreshWordDisplay();
    this._jiggle(die);
  }

  _jiggle(die) {
    this.tweens.killTweensOf(die.image);
    die.image.setAngle(0);
    this.tweens.add({
      targets:  die.image,
      angle:    -12,
      duration: 60,
      yoyo:     true,
      repeat:   2,
      ease:     'Sine.easeInOut',
      onComplete: () => die.image.setAngle(0),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKSPACE
  // ═══════════════════════════════════════════════════════════════════════════

  _backspace() {
    if (!this._selectionOrder.length) return;
    const die = this._selectionOrder.pop();
    this._word = this._word.slice(0, -1);
    die.selected = false;
    die.image.setTexture(`die-${die.letter}-red`);
    die.image.setAngle(0);
    this._refreshWordDisplay();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORD DISPLAY
  // ═══════════════════════════════════════════════════════════════════════════

  _refreshWordDisplay() {
    this._wordText.setText(this._word.length ? this._word : '_');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMISSION & VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  _submitWord() {
    if (!this._word.length) return;

    if (this._isMultiplayer) {
      // ── Multiplayer: send to server; result comes back via wordResult ────────
      if (this._roundEnded) return;
      socketClient.emit('submitWord', { roomId: this._roomId, word: this._word });
      this._resetDice();
      return;
    }

    // ── Single-player: validate locally ─────────────────────────────────────
    if (this._foundWords.includes(this._word)) {
      this._showFeedback('ALREADY FOUND!', '#D4A017');
    } else if (this._wordList.has(this._word)) {
      this._foundWords.push(this._word);
      this._showFeedback('✓ ' + this._word, '#22BB44');
      this._updateFoundPanel();
    } else {
      this._showFeedback('✗ NOT A WORD', '#CC3344');
      this.cameras.main.shake(200, 0.008);
    }

    this._resetDice();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DICE RESET
  // ═══════════════════════════════════════════════════════════════════════════

  _resetDice() {
    this._word           = '';
    this._selectionOrder = [];
    for (const die of this._dice) {
      die.selected = false;
      die.image.setTexture(`die-${die.letter}-red`);
      die.image.setAngle(0);
      die.image.setAlpha(1);
    }
    this._refreshWordDisplay();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOUND-WORDS PANEL — 3-stage column layout inside box
  // ═══════════════════════════════════════════════════════════════════════════

  _updateFoundPanel() {
    const count = this._foundWords.length;

    this._foundHeaderText.setText(`WORDS FOUND  ${count} / ${this._wordList.size}`);

    this._foundWordsContainer.forEach(t => t.destroy());
    this._foundWordsContainer = [];

    const stage    = FONT_STAGES.find(s => count <= s.maxWords) || FONT_STAGES[FONT_STAGES.length - 1];
    const { cols, fontSize, lineHeight } = stage;

    const boxLeft  = PANEL_CX - WORDS_BOX_W / 2 + WORDS_BOX_PAD;
    const boxTop   = WORDS_BOX_Y - WORDS_BOX_H / 2 + 18;
    const colWidth = (WORDS_BOX_W - WORDS_BOX_PAD * 2) / cols;

    this._foundWords.forEach((word, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const tx  = boxLeft + col * colWidth + colWidth / 2;
      const ty  = boxTop  + row * lineHeight + lineHeight / 2;

      const t = this.add.text(tx, ty, word, {
        fontFamily: "'Syncopate', monospace",
        fontSize,
        fontStyle:  'bold',
        color:      '#22BB44',
      }).setOrigin(0.5, 0.5);

      this._foundWordsContainer.push(t);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  _showFeedback(msg, color) {
    this.tweens.killTweensOf(this._feedbackText);
    this._feedbackText.setText(msg).setColor(color).setAlpha(1);
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets:  this._feedbackText,
        alpha:    0,
        duration: 400,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FRAME UPDATE — countdown timer (multiplayer only)
  // ═══════════════════════════════════════════════════════════════════════════

  update() {
    if (!this._isMultiplayer || !this._startTime || !this._duration || this._roundEnded) return;

    const remaining = Math.max(0, this._startTime + this._duration - Date.now());
    const secs      = Math.ceil(remaining / 1000);

    if (this._timerText) {
      this._timerText.setText(String(secs));
      const pct = remaining / this._duration;
      if      (pct < 0.2) this._timerText.setColor('#CC3344');  // red  < 6 s
      else if (pct < 0.5) this._timerText.setColor('#D4A017');  // amber < 15 s
      else                this._timerText.setColor('#48C1C0');  // teal
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER UI — scoreboard + countdown timer
  // ═══════════════════════════════════════════════════════════════════════════

  _createMultiplayerUI() {
    // ── Countdown timer (top-centre of content area) ─────────────────────────
    this._timerText = this.add.text(PANEL_CX, 100, '30', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '48px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5);

    // ── Scoreboard panel (left column) ───────────────────────────────────────
    const n    = Math.min(this._players.length, 4);
    const panH = n * SCORE_ROW + 50;
    const panY = SCORE_Y0 + (n - 1) * SCORE_ROW / 2;

    this.add.rectangle(SCORE_CX, panY, 210, panH, 0x060c14)
      .setStrokeStyle(1, 0x2a6a6a, 0.9);

    this.add.text(SCORE_CX, SCORE_Y0 - 26, 'SCORES', {
      fontFamily:    'monospace',
      fontSize:      '10px',
      color:         '#2a6a6a',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5);

    this._scoreTexts = [];
    for (let i = 0; i < n; i++) {
      this._scoreTexts.push(
        this.add.text(SCORE_CX, SCORE_Y0 + i * SCORE_ROW, '', {
          fontFamily: "'Syncopate', monospace",
          fontSize:   '13px',
          fontStyle:  'bold',
          color:      '#48C1C0',
        }).setOrigin(0.5, 0.5)
      );
    }

    this._updateScoreboard();
  }

  // ── Redraw scoreboard rows, sorted by score descending ──────────────────────
  _updateScoreboard() {
    if (!this._scoreTexts) return;
    const sorted = [...this._players].sort((a, b) => b.score - a.score);
    sorted.slice(0, 4).forEach((p, i) => {
      const isMe  = p.playerName === this._playerName;
      const label = (isMe ? '▶ ' : '  ') + p.playerName + ':  ' + p.score;
      this._scoreTexts[i]?.setText(label).setColor(isMe ? '#88ffff' : '#48C1C0');
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCKET HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  _registerSocketHandlers() {
    socketClient.on('wordResult',  (data) => this._handleWordResult(data));
    socketClient.on('scoreUpdate', (data) => this._handleScoreUpdate(data));
    socketClient.on('roundEnd',    (data) => this._handleRoundEnd(data));
  }

  /** Server tells us whether our submitted word was valid. */
  _handleWordResult(data) {
    if (data.valid) {
      this._foundWords.push(data.word);
      this._showFeedback('✓ ' + data.word, '#22BB44');
      this._updateFoundPanel();
    } else if (data.alreadyFound) {
      this._showFeedback('ALREADY FOUND!', '#D4A017');
    } else {
      this._showFeedback('✗ NOT A WORD', '#CC3344');
      this.cameras.main.shake(200, 0.008);
    }
  }

  /** Server broadcasts a player's new score. */
  _handleScoreUpdate(data) {
    const p = this._players.find(pl => pl.playerName === data.playerName);
    if (p) p.score = data.score;
    this._updateScoreboard();
  }

  /** Server says time is up — lock the game and show results. */
  _handleRoundEnd(data) {
    this._roundEnded = true;
    // Disable all dice so no further clicks register
    for (const die of this._dice) {
      die.image.disableInteractive();
    }
    this._showVictoryScreen(data.scores);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VICTORY SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  _showVictoryScreen(scores) {
    const n     = Math.min(scores.length, 4);
    const panH  = 90 + n * 46 + 60;   // header + rows + button area
    const panCY = ROW_1_Y + panH / 2 - 10;

    // Dark panel
    this.add.rectangle(PANEL_CX, panCY, 580, panH, 0x060c14, 0.97)
      .setStrokeStyle(2, 0x48C1C0, 1)
      .setDepth(20);

    // "ROUND OVER" heading
    this.add.text(PANEL_CX, panCY - panH / 2 + 38, 'ROUND  OVER', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '26px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(21);

    // Player rows
    const medals  = ['1ST', '2ND', '3RD', '4TH'];
    const rowY0   = panCY - panH / 2 + 86;

    scores.slice(0, 4).forEach((p, i) => {
      const isMe = p.playerName === this._playerName;
      const y    = rowY0 + i * 46;
      const col  = i === 0 ? '#FFD700' : '#48C1C0';

      // Rank badge
      this.add.text(PANEL_CX - 240, y, medals[i], {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '11px',
        fontStyle:  'bold',
        color:      col,
      }).setOrigin(0, 0.5).setDepth(21);

      // Player name (with arrow for "you")
      this.add.text(PANEL_CX - 185, y,
        (isMe ? '▶ ' : '') + p.playerName, {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '15px',
        fontStyle:  'bold',
        color:      isMe ? '#88ffff' : col,
      }).setOrigin(0, 0.5).setDepth(21);

      // Score
      this.add.text(PANEL_CX + 240, y, p.score + ' pts', {
        fontFamily: "'Syncopate', monospace",
        fontSize:   '14px',
        fontStyle:  'bold',
        color:      col,
      }).setOrigin(1, 0.5).setDepth(21);
    });

    // "BACK TO MENU" button
    const btnY   = rowY0 + n * 46 + 18;
    const btnBg  = this.add.rectangle(PANEL_CX, btnY, 300, 44, 0x1a3a3a)
      .setStrokeStyle(2, 0x48C1C0, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    const btnLbl = this.add.text(PANEL_CX, btnY, 'BACK TO MENU', {
      fontFamily: "'Syncopate', monospace",
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#48C1C0',
    }).setOrigin(0.5, 0.5).setDepth(22);

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x2a5555); btnLbl.setColor('#88ffff'); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x1a3a3a); btnLbl.setColor('#48C1C0'); });
    btnBg.on('pointerdown', () => {
      roomManager.leave();
      this.scene.stop('GameBeamScene');
      this.scene.start('MainScene');
    });
  }
}
