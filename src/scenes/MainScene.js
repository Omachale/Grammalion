import * as Phaser from 'phaser';
import RotaryDial from '../ui/RotaryDial';
import StartButton from '../ui/StartButton';

// ─── Background scaling ──────────────────────────────────────────────────────
// Source image: 1570×868 (right edge trimmed).  Canvas size is dynamic (responsive).
//
// Scale to fit the FULL WIDTH (no horizontal cropping):
//   BG_SCALE   = canvasWidth / 1570
//   scaledH    = 868 × BG_SCALE
//   BG_Y_OFF   = (canvasHeight − scaledH) / 2  (letterbox top & bottom)
//
// For any original point (ox, oy) in the image:
//   gameX = ox × BG_SCALE
//   gameY = oy × BG_SCALE + BG_Y_OFF
//
// Dial-hole centroids (original image coordinates):
//   Grammar Point (523, 220)
//   CEFR Level   (1050, 224)
//   Task Type     (775, 422)
//   Timer         (528, 620)
//   Rounds       (1043, 624)
//
// Dial image source: 178 px diameter in original image

const BG_IMG_W  = 1570;
const BG_IMG_H  = 868;
const DIAL_SOURCE_SIZE = 178;  // diameter in original image

// Original image dial-hole positions (unchanged)
const DIAL_POS_ORIGINAL = {
  grammar: { x: 523, y: 220 },
  task:    { x: 775, y: 422 },
  cefr:    { x: 1050, y: 224 },
  rounds:  { x: 1043, y: 624 },
  timer:   { x: 528, y: 620 },
};

// Dynamically calculated during create()
let BG_SCALE = 1;
let BG_Y_OFF = 0;
let DIAL_SIZE = 178;
let DIAL_POS = { ...DIAL_POS_ORIGINAL };  // will be overwritten

// Which task types have sentence data for each grammar point
const COMPATIBLE = {
  'Present Simple':        new Set(['Gap Fill', 'Multichoice', 'Wheel']),
  'Present Continuous':    new Set(['Gap Fill', 'Wheel']),
  'Past Simple':           new Set(['Gap Fill', 'Wheel']),
  'Past Continuous':       new Set(['Wheel']),
  'Present Perfect Simple': new Set(['Wheel']),
  'Past Perfect Simple':    new Set(['Wheel']),
  'Verb Patterns':         new Set(['Gap Fill', 'Multichoice']),
};

const ROUNDS_NORMAL  = ['5', '10', '15'];
const ROUNDS_WHEEL   = ['5 Rounds', '8 Rounds', '10 Rounds', '8 Mistakes', '5 Mistakes', '3 Mistakes', '2 Mistakes', '1 Mistake'];
const ROUNDS_JUGGLE  = ['5 Letters', '6 Letters', '7 Letters'];

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  init(data) {
    this._restoreGrammar = data.grammar || null;
    this._restoreTask    = data.task    || null;
    this._restoreCefr    = data.cefr    || null;
    this._restoreRounds  = data.rounds  != null ? String(data.rounds) : null;
    this._restoreTimer   = data.timer   || null;
  }

  preload() {
    this.load.image('bg',        'assets/images/game/Background UI.png');
    this.load.image('dial',      'assets/images/game/cropped_circle_image.png');
    this.load.image('start-img', 'assets/images/game/Start.png');
  }

  create() {
    // ── Calculate dynamic scaling based on actual canvas size ────────────────
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;
    // Contain: scale to fit within canvas without any cropping
    const bgScaleX = canvasWidth / BG_IMG_W;
    const bgScaleY = canvasHeight / BG_IMG_H;
    const bgScale = Math.min(bgScaleX, bgScaleY);
    const scaledImageWidth  = BG_IMG_W * bgScale;
    const scaledImageHeight = BG_IMG_H * bgScale;
    const bgXOffset = (canvasWidth  - scaledImageWidth)  / 2;
    const bgYOffset = (canvasHeight - scaledImageHeight) / 2;
    const dialSize = Math.round(DIAL_SOURCE_SIZE * bgScale);

    // Recalculate dial positions based on dynamic scale
    const dialPos = {};
    for (const key in DIAL_POS_ORIGINAL) {
      const orig = DIAL_POS_ORIGINAL[key];
      dialPos[key] = {
        x: Math.round(bgXOffset + orig.x * bgScale),
        y: Math.round(bgYOffset + orig.y * bgScale),
      };
    }

    // Update global variables for use below
    BG_SCALE = bgScale;
    BG_Y_OFF = bgYOffset;
    DIAL_SIZE = dialSize;
    DIAL_POS = dialPos;

    // ── Background ───────────────────────────────────────────────────────────
    // Scale to fill canvas width; image is letterboxed vertically
    this.add.image(canvasWidth / 2, canvasHeight / 2, 'bg').setScale(bgScale);

    // ── Shared scan-line tile texture ────────────────────────────────────────
    // 1×5 tile: 4 px transparent + 1 px semi-opaque dark line.
    // Created once per session; skip if it already exists (scene restart).
    if (!this.textures.exists('dial-scanlines')) {
      const slGfx = this.make.graphics({ add: false });
      slGfx.fillStyle(0x000000, 0);
      slGfx.fillRect(0, 0, 1, 4);
      slGfx.fillStyle(0x000000, 0.38);
      slGfx.fillRect(0, 4, 1, 1);
      slGfx.generateTexture('dial-scanlines', 1, 5);
      slGfx.destroy();
    }

    // ── Dials ────────────────────────────────────────────────────────────────
    const p = DIAL_POS;

    this.grammarDial = new RotaryDial(this, p.grammar.x, p.grammar.y, {
      label:    '',   // label baked into background image
      dialSize: DIAL_SIZE,
      options:  ['Present Simple', 'Present Continuous', 'Past Simple', 'Past Continuous', 'Present Perfect Simple', 'Past Perfect Simple', 'Verb Patterns', 'Juggle'],
      onChange: (val) => { this._selections.grammar = val; this._checkCompatibility(); },
    });

    this.taskDial = new RotaryDial(this, p.task.x, p.task.y, {
      label:    '',
      dialSize: DIAL_SIZE,
      options:  ['Gap Fill', 'Multichoice', 'Wheel'],
      onChange: (val) => { this._selections.task = val; this._checkCompatibility(); },
    });

    this.cefrDial = new RotaryDial(this, p.cefr.x, p.cefr.y, {
      label:    '',
      dialSize: DIAL_SIZE,
      options:  ['A1', 'A2', 'B1', 'B2', 'C1'],
      onChange: (val) => { this._selections.cefr = val; },
    });

    this.roundsDial = new RotaryDial(this, p.rounds.x, p.rounds.y, {
      label:    '',
      dialSize: DIAL_SIZE,
      options:  ROUNDS_NORMAL,
      onChange: (val) => { this._selections.rounds = val; },
    });

    this.timerDial = new RotaryDial(this, p.timer.x, p.timer.y, {
      label:    '',
      dialSize: DIAL_SIZE,
      options:  ['Off', 'Slow', 'Medium', 'Fast'],
      onChange: (val) => { this._selections.timer = val; },
    });

    // ── Rounds-dial mode flags ────────────────────────────────────────────────
    this._roundsInWheelMode  = false;
    this._roundsInJuggleMode = false;

    // ── Selection state (initialised from dial defaults) ─────────────────────
    this._selections = {
      grammar: this.grammarDial.getValue(),
      task:    this.taskDial.getValue(),
      cefr:    this.cefrDial.getValue(),
      rounds:  this.roundsDial.getValue(),
      timer:   this.timerDial.getValue(),
    };

    // ── Restore previous selections if any ───────────────────────────────────
    if (this._restoreGrammar !== null) {
      if (this._restoreTask === 'Wheel') {
        this._roundsInWheelMode = true;
        this.roundsDial.setOptions(ROUNDS_WHEEL);
      }

      [
        { dial: this.grammarDial, value: this._restoreGrammar },
        { dial: this.taskDial,    value: this._restoreTask    },
        { dial: this.cefrDial,    value: this._restoreCefr    },
        { dial: this.roundsDial,  value: this._restoreRounds  },
        { dial: this.timerDial,   value: this._restoreTimer   },
      ].forEach(({ dial, value }) => {
        if (value === null) return;
        const idx = dial._options.indexOf(value);
        if (idx >= 0) dial.setIndex(idx);
      });

      this._selections.grammar = this.grammarDial.getValue();
      this._selections.task    = this.taskDial.getValue();
      this._selections.cefr    = this.cefrDial.getValue();
      this._selections.rounds  = this.roundsDial.getValue();
      this._selections.timer   = this.timerDial.getValue();
    }

    // ── Start button ─────────────────────────────────────────────────────────
    // Positioned below the Task Type dial, centred between Timer and Rounds dials
    // Original image coordinates: Timer (528, 620), Rounds (1043, 624), Task Type (775, 422)
    // Button at horizontal centre of Timer-Rounds line, below orange indicator
    const buttonOrigX = (528 + 1043) / 2;  // ~785.5
    const buttonOrigY = 670;  // below the indicator line
    const buttonX = Math.round(bgXOffset + buttonOrigX * bgScale);
    const buttonY = Math.round(bgYOffset + buttonOrigY * bgScale);
    this._flipSwitch = new StartButton(this, buttonX, buttonY, {
      scale: 1/3,
      onActivate: () => {
        // Disable the Start button — will be re-enabled when returning to MainScene
        this._flipSwitch.setEnabled(false);

        const { grammar, task, cefr, timer } = this._selections;
        const rawRounds = this._selections.rounds;

        if (grammar === 'Juggle') {
          this.scene.run('GameBeamScene', {
            targetScene: 'JuggleScene',
            grammar, task, cefr, timer,
            rounds: rawRounds,   // '5 Letters' or '6 Letters'
          });
          return;
        }

        if (task === 'Wheel') {
          const num       = parseInt(rawRounds, 10);
          const wheelMode = rawRounds.includes('Rounds') ? 'total' : 'mistakes';
          this.scene.run('GameBeamScene', {
            targetScene: 'WheelScene',
            grammar, task, cefr, timer, wheelMode, wheelValue: num
          });
        } else {
          const rounds = parseInt(rawRounds, 10) || 5;
          let targetScene;
          if      (task === 'Multichoice') targetScene = 'MultiChoiceScene';
          else if (task === 'Correction')  targetScene = 'CorrectionScene';
          else if (task === 'Reorder')     targetScene = 'ReorderScene';
          else                             targetScene = 'GameScene';
          this.scene.run('GameBeamScene', { targetScene, grammar, task, cefr, rounds, timer });
        }
      },
    });

    // ── Play Online button ────────────────────────────────────────────────────
    // Bottom-right corner; always visible, launches the multiplayer lobby.
    // Routes through GameBeamScene (same animation as single-player games).
    const onlineBtn = this.add.text(canvasWidth - 20, canvasHeight - 20, '▶  PLAY ONLINE', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '13px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    onlineBtn.on('pointerover',  () => onlineBtn.setColor('#88ffff'));
    onlineBtn.on('pointerout',   () => onlineBtn.setColor('#48C1C0'));
    onlineBtn.on('pointerdown',  () => {
      this._flipSwitch.setEnabled(false);
      this.scene.run('GameBeamScene', { targetScene: 'LobbyScene' });
    });

    // ── Compatibility check ───────────────────────────────────────────────────
    this._checkCompatibility();

    // ── Re-enable Start button when returning from a game ───────────────────
    this.events.on('wake', () => {
      this._flipSwitch.setEnabled(true);
    });

  }

  _checkCompatibility() {
    const { grammar, task } = this._selections;
    const isJuggle = grammar === 'Juggle';

    // ── Switch rounds dial between Juggle / Normal / Wheel modes ─────────────
    if (isJuggle !== this._roundsInJuggleMode) {
      this._roundsInJuggleMode = isJuggle;
      if (isJuggle) {
        this._roundsInWheelMode = false;   // clear wheel flag when entering Juggle
        this.roundsDial.setOptions(ROUNDS_JUGGLE);
      } else {
        this.roundsDial.setOptions(ROUNDS_NORMAL);
      }
      this._selections.rounds = this.roundsDial.getValue();
    }

    // ── Juggle: task dial disabled, Start always enabled ─────────────────────
    if (isJuggle) {
      this.taskDial.setDisabled(true);
      this._flipSwitch.setEnabled(true);
      return;
    }

    // ── Normal grammar points ─────────────────────────────────────────────────
    const valid = (COMPATIBLE[grammar] || new Set()).has(task);
    this.taskDial.setDisabled(!valid);
    this._flipSwitch.setEnabled(valid);

    const isWheel = task === 'Wheel';
    if (isWheel !== this._roundsInWheelMode) {
      this._roundsInWheelMode = isWheel;
      this.roundsDial.setOptions(isWheel ? ROUNDS_WHEEL : ROUNDS_NORMAL);
      this._selections.rounds = this.roundsDial.getValue();
    }
  }

  update(_time, delta) {
    // Drive the dial rotation animation for all five dials every frame.
    // Each dial advances its own angle state based on elapsed ms (delta).
    this.grammarDial.update(delta);
    this.taskDial.update(delta);
    this.cefrDial.update(delta);
    this.roundsDial.update(delta);
    this.timerDial.update(delta);
  }
}
