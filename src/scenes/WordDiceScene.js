import * as Phaser from 'phaser';

// ─── Word list (temporary prototype data — delete when integrating real dictionary) ──
const WORD_LIST = new Set(['DEAF', 'FADE', 'ACE', 'CAB']);

// ─── Letters used in this prototype ──────────────────────────────────────────────────
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Die positions: one loose row, slight Y variation for visual interest ─────────────
const DIE_POSITIONS = [
  { letter: 'A', x: 212, y: 280 },
  { letter: 'B', x: 322, y: 295 },
  { letter: 'C', x: 432, y: 272 },
  { letter: 'D', x: 542, y: 290 },
  { letter: 'E', x: 652, y: 278 },
  { letter: 'F', x: 762, y: 292 },
];

const DIE_DISPLAY_SIZE = 110;   // rendered px (square)
const INSTRUCTION_Y    = 405;
const INPUT_Y          = 460;
const FEEDBACK_Y       = 530;

export default class WordDiceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WordDiceScene' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRELOAD
  // ═══════════════════════════════════════════════════════════════════════════

  preload() {
    // Test: load the background to verify asset loading works
    this.load.image('test-bg', 'assets/images/game/Background UI.webp');

    // Load each die image pair explicitly
    this.load.image('die-A-red',   'assets/images/dice/AR.png');
    this.load.image('die-A-green', 'assets/images/dice/AG.png');
    this.load.image('die-B-red',   'assets/images/dice/BR.png');
    this.load.image('die-B-green', 'assets/images/dice/BG.png');
    this.load.image('die-C-red',   'assets/images/dice/CR.png');
    this.load.image('die-C-green', 'assets/images/dice/CG.png');
    this.load.image('die-D-red',   'assets/images/dice/DR.png');
    this.load.image('die-D-green', 'assets/images/dice/DG.png');
    this.load.image('die-E-red',   'assets/images/dice/ER.png');
    this.load.image('die-E-green', 'assets/images/dice/EG.png');
    this.load.image('die-F-red',   'assets/images/dice/FR.png');
    this.load.image('die-F-green', 'assets/images/dice/FG.png');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  create() {
    // ── State ────────────────────────────────────────────────────────────────
    this._word           = '';          // current word being built
    this._selectionOrder = [];          // die objects in the order they were selected

    // ── Background ────────────────────────────────────────────────────────────
    this.add.rectangle(512, 384, 1024, 768, 0x1a1a2e).setOrigin(0.5, 0.5);

    // ── TEST: Try loading the background image ──────────────────────────────
    this.add.image(512, 384, 'test-bg').setScale(0.1).setAlpha(0.5);

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(512, 80, 'WORD BUILDER', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '28px',
      fontStyle:       'bold',
      color:           '#cc44ff',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    this.add.text(512, 120, 'PROTOTYPE  —  A · B · C · D · E · F', {
      fontFamily:    'monospace',
      fontSize:      '12px',
      color:         '#556677',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5);

    // ── Dice ─────────────────────────────────────────────────────────────────
    this._dice = DIE_POSITIONS.map(({ letter, x, y }) => {
      const image = this.add.image(x, y, `die-${letter}-red`)
        .setDisplaySize(DIE_DISPLAY_SIZE, DIE_DISPLAY_SIZE)
        .setOrigin(0.5, 0.5);

      const die = { letter, selected: false, image, baseX: x, baseY: y };

      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', () => this._selectDie(die));
      image.on('pointerover', () => { if (!die.selected) image.setAlpha(0.82); });
      image.on('pointerout',  () => image.setAlpha(1));

      return die;
    });

    // ── Instruction label ─────────────────────────────────────────────────────
    this.add.text(512, INSTRUCTION_Y,
      'CLICK A LETTER OR PRESS KEY  •  ENTER TO SUBMIT  •  BACKSPACE TO UNDO',
      {
        fontFamily:    'monospace',
        fontSize:      '12px',
        color:         '#2a6a6a',
        letterSpacing: 2,
      }
    ).setOrigin(0.5, 0.5);

    // ── Word display ──────────────────────────────────────────────────────────
    // Panel behind the word text
    const panelW = 500;
    const panelH = 60;
    this.add.rectangle(512, INPUT_Y, panelW, panelH, 0x0a0f1a)
      .setStrokeStyle(2, 0x48c1c0, 0.8);

    this._wordText = this.add.text(512, INPUT_Y, '_', {
      fontFamily: "'Syncopate', monospace",
      fontSize:   '28px',
      fontStyle:  'bold',
      color:      '#48C1C0',
    }).setOrigin(0.5, 0.5);

    // ── Feedback text ─────────────────────────────────────────────────────────
    this._feedbackText = this.add.text(512, FEEDBACK_Y, '', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '22px',
      fontStyle:       'bold',
      color:           '#22BB44',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // ── Submit button ─────────────────────────────────────────────────────────
    this._buildSubmitButton();

    // ── Keyboard ──────────────────────────────────────────────────────────────
    this.input.keyboard.on('keydown', (e) => {
      const key = e.key.toUpperCase();
      if (key === 'ENTER')     { this._submitWord(); return; }
      if (key === 'BACKSPACE') { this._backspace();  return; }
      const die = this._dice.find(d => d.letter === key);
      if (die) this._selectDie(die);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT BUTTON
  // ═══════════════════════════════════════════════════════════════════════════

  _buildSubmitButton() {
    const btnX = 512;
    const btnY = FEEDBACK_Y + 60;
    const btnW = 160;
    const btnH = 42;

    const bg = this.add.rectangle(btnX, btnY, btnW, btnH, 0x1a3a3a)
      .setStrokeStyle(2, 0x48c1c0, 1)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(btnX, btnY, 'SUBMIT', {
      fontFamily: "'Syncopate', monospace",
      fontSize:   '14px',
      fontStyle:  'bold',
      color:      '#48C1C0',
    }).setOrigin(0.5, 0.5);

    bg.on('pointerdown',  () => this._submitWord());
    bg.on('pointerover',  () => { bg.setFillStyle(0x2a5555); label.setColor('#88ffff'); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x1a3a3a); label.setColor('#48C1C0'); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIE SELECTION
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
    // Cancel any in-progress jiggle first
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

    if (WORD_LIST.has(this._word)) {
      this._showFeedback('✓ ' + this._word, '#22BB44');
    } else {
      this._showFeedback('✗ NOT A WORD', '#CC3344');
      this.cameras.main.shake(200, 0.008);
    }

    this._resetDice();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
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
}
