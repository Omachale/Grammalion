import * as Phaser from 'phaser';
import GameSelector from '../ui/GameSelector';
import StartButton  from '../ui/StartButton';

// Background image native dimensions (needed to compute scale / offsets here
// as well as inside GameSelector, which also reads them from its own copy).
const BG_IMG_W = 1570;
const BG_IMG_H = 868;

export default class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  // ── Scene lifecycle ────────────────────────────────────────────────────────

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
    // ── Background scaling ────────────────────────────────────────────────────
    // Contain-fit the background image; derive offsets used by GameSelector
    // and the Start button position.
    const canvasWidth  = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;
    const bgScale      = Math.min(canvasWidth / BG_IMG_W, canvasHeight / BG_IMG_H);
    const scaledW      = BG_IMG_W * bgScale;
    const scaledH      = BG_IMG_H * bgScale;
    const bgXOffset    = (canvasWidth  - scaledW) / 2;
    const bgYOffset    = (canvasHeight - scaledH) / 2;

    // ── Background image ──────────────────────────────────────────────────────
    this.add.image(canvasWidth / 2, canvasHeight / 2, 'bg').setScale(bgScale);

    // ── Scan-line tile texture (consumed by RotaryDial inside GameSelector) ───
    // Created once per session; the guard prevents recreation on scene restart.
    if (!this.textures.exists('dial-scanlines')) {
      const slGfx = this.make.graphics({ add: false });
      slGfx.fillStyle(0x000000, 0);
      slGfx.fillRect(0, 0, 1, 4);
      slGfx.fillStyle(0x000000, 0.38);
      slGfx.fillRect(0, 4, 1, 1);
      slGfx.generateTexture('dial-scanlines', 1, 5);
      slGfx.destroy();
    }

    // ── Game selector (five rotary dials) ─────────────────────────────────────
    // GameSelector owns all dial state, compatibility logic, and rounds-mode
    // switching.  MainScene only needs to react to validity changes in order
    // to enable/disable the Start button.
    this._selector = new GameSelector(this, bgScale, bgXOffset, bgYOffset, {
      onChange: () => {
        if (this._flipSwitch) {
          this._flipSwitch.setEnabled(this._selector.isValid());
        }
      },
    });

    // ── Restore previous selections (returning from a game scene) ─────────────
    if (this._restoreGrammar !== null) {
      this._selector.restore(
        this._restoreGrammar,
        this._restoreTask,
        this._restoreCefr,
        this._restoreRounds,
        this._restoreTimer,
      );
    }

    // ── Start button ──────────────────────────────────────────────────────────
    // Positioned below the Task Type dial, centred between Timer and Rounds.
    // Original image coordinates: Timer (528, 620), Rounds (1043, 624).
    const buttonOrigX = (528 + 1043) / 2;  // ≈ 785.5
    const buttonOrigY = 670;
    const buttonX = Math.round(bgXOffset + buttonOrigX * bgScale);
    const buttonY = Math.round(bgYOffset + buttonOrigY * bgScale);

    this._flipSwitch = new StartButton(this, buttonX, buttonY, {
      scale: 1 / 3,
      onActivate: () => {
        this._flipSwitch.setEnabled(false);

        const { grammar, task, cefr, timer, rounds: rawRounds } =
          this._selector.getSelections();

        if (grammar === 'Juggle') {
          this.scene.run('GameBeamScene', {
            targetScene: 'JuggleScene',
            grammar, task, cefr, timer,
            rounds: rawRounds,   // '5 Letters' | '6 Letters' | '7 Letters'
          });
          return;
        }

        if (task === 'Wheel') {
          const num       = parseInt(rawRounds, 10);
          const wheelMode = rawRounds.includes('Rounds') ? 'total' : 'mistakes';
          this.scene.run('GameBeamScene', {
            targetScene: 'WheelScene',
            grammar, task, cefr, timer, wheelMode, wheelValue: num,
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

    // Apply initial enabled state from current dial selections
    this._flipSwitch.setEnabled(this._selector.isValid());

    // ── Play Online button ────────────────────────────────────────────────────
    // Bottom-right corner; always visible; launches the multiplayer lobby.
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

    // ── Re-enable Start when returning from a game via scene.wake ────────────
    this.events.on('wake', () => {
      this._flipSwitch.setEnabled(this._selector.isValid());
    });
  }

  update(_time, delta) {
    this._selector.update(delta);
  }
}
