/**
 * GameSelector.js — Shared game-configuration selector.
 *
 * Creates the five RotaryDials (Grammar, Task, CEFR, Rounds, Timer) at the
 * positions baked into the Background UI image.  Used by both MainScene
 * (single-player) and LobbyScene (multiplayer), so any change to dial
 * options or layout automatically applies to both.
 *
 * Usage:
 *   const sel = new GameSelector(scene, bgScale, bgXOffset, bgYOffset, {
 *     onChange: (selections) => { ... }
 *   });
 *   sel.update(delta);                            // call every frame
 *   sel.getSelections();                          // { grammar, task, cefr, rounds, timer }
 *   sel.isValid();                                // true when Start/Play should be active
 *   sel.restore(grammar, task, cefr, rounds, timer); // restore from scene-init data
 *   sel.setVisible(bool);                         // show/hide all dials
 *   sel.destroy();                                // clean up
 */

import RotaryDial from './RotaryDial';

// ── Background layout constants (match "Background UI.png") ──────────────────
const BG_IMG_W         = 1570;
const BG_IMG_H         = 868;
const DIAL_SOURCE_SIZE = 178;  // diameter of each dial hole in the source image

const DIAL_POS_ORIGINAL = {
  grammar: { x: 523, y: 220 },
  task:    { x: 775, y: 422 },
  cefr:    { x: 1050, y: 224 },
  rounds:  { x: 1043, y: 624 },
  timer:   { x: 528,  y: 620 },
};

// ── Which task types have content for each grammar point ─────────────────────
// Exported so LobbyScene can validate which grammar+task combinations are
// available for multiplayer without duplicating this map.
export const COMPATIBLE = {
  'Present Simple':         new Set(['Gap Fill', 'Multichoice', 'Wheel']),
  'Present Continuous':     new Set(['Gap Fill', 'Wheel']),
  'Past Simple':            new Set(['Gap Fill', 'Wheel']),
  'Past Continuous':        new Set(['Wheel']),
  'Present Perfect Simple': new Set(['Wheel']),
  'Past Perfect Simple':    new Set(['Wheel']),
  'Verb Patterns':          new Set(['Gap Fill', 'Multichoice']),
};

const ROUNDS_NORMAL = ['5', '10', '15'];
const ROUNDS_WHEEL  = [
  '5 Rounds', '8 Rounds', '10 Rounds',
  '8 Mistakes', '5 Mistakes', '3 Mistakes', '2 Mistakes', '1 Mistake',
];
const ROUNDS_JUGGLE = ['5 Letters', '6 Letters', '7 Letters'];

// ─────────────────────────────────────────────────────────────────────────────

export default class GameSelector {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} bgScale    Scale factor applied to the background image.
   * @param {number} bgXOffset  Horizontal offset of the scaled background.
   * @param {number} bgYOffset  Vertical offset of the scaled background.
   * @param {object} [options]
   * @param {function} [options.onChange]  Called with current selections object
   *   whenever any dial changes value.
   */
  constructor(scene, bgScale, bgXOffset, bgYOffset, options = {}) {
    this._scene    = scene;
    this._onChange = options.onChange || null;
    const timerOptions = options.timerOptions || ['Off', 'Slow', 'Medium', 'Fast'];

    const dialSize = Math.round(DIAL_SOURCE_SIZE * bgScale);

    // Translate original image coordinates → canvas coordinates
    const p = {};
    for (const key in DIAL_POS_ORIGINAL) {
      const orig = DIAL_POS_ORIGINAL[key];
      p[key] = {
        x: Math.round(bgXOffset + orig.x * bgScale),
        y: Math.round(bgYOffset + orig.y * bgScale),
      };
    }

    // ── Rounds-dial mode tracking ─────────────────────────────────────────────
    this._roundsInWheelMode  = false;
    this._roundsInJuggleMode = false;

    // ── Create the five dials ─────────────────────────────────────────────────
    this.grammarDial = new RotaryDial(scene, p.grammar.x, p.grammar.y, {
      label: '', dialSize,
      options: [
        'Present Simple', 'Present Continuous', 'Past Simple',
        'Past Continuous', 'Present Perfect Simple', 'Past Perfect Simple',
        'Verb Patterns', 'Juggle',
      ],
      onChange: (val) => {
        this._selections.grammar = val;
        this._checkCompatibility();
        if (this._onChange) this._onChange({ ...this._selections });
      },
    });

    this.taskDial = new RotaryDial(scene, p.task.x, p.task.y, {
      label: '', dialSize,
      options: ['Gap Fill', 'Multichoice', 'Wheel'],
      onChange: (val) => {
        this._selections.task = val;
        this._checkCompatibility();
        if (this._onChange) this._onChange({ ...this._selections });
      },
    });

    this.cefrDial = new RotaryDial(scene, p.cefr.x, p.cefr.y, {
      label: '', dialSize,
      options: ['A1', 'A2', 'B1', 'B2', 'C1'],
      onChange: (val) => {
        this._selections.cefr = val;
        if (this._onChange) this._onChange({ ...this._selections });
      },
    });

    this.roundsDial = new RotaryDial(scene, p.rounds.x, p.rounds.y, {
      label: '', dialSize,
      options: ROUNDS_NORMAL,
      onChange: (val) => {
        this._selections.rounds = val;
        if (this._onChange) this._onChange({ ...this._selections });
      },
    });

    this.timerDial = new RotaryDial(scene, p.timer.x, p.timer.y, {
      label: '', dialSize,
      options: timerOptions,
      onChange: (val) => {
        this._selections.timer = val;
        if (this._onChange) this._onChange({ ...this._selections });
      },
    });

    // ── Initialise selection state from dial defaults ─────────────────────────
    this._selections = {
      grammar: this.grammarDial.getValue(),
      task:    this.taskDial.getValue(),
      cefr:    this.cefrDial.getValue(),
      rounds:  this.roundsDial.getValue(),
      timer:   this.timerDial.getValue(),
    };

    // Set initial disabled/mode state (no external notification needed)
    this._checkCompatibility();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** @returns {{ grammar, task, cefr, rounds, timer }} */
  getSelections() { return { ...this._selections }; }

  /**
   * True if the current grammar+task combination has playable content
   * (or if grammar is 'Juggle', which is always playable).
   */
  isValid() {
    const { grammar, task } = this._selections;
    if (grammar === 'Juggle') return true;
    return (COMPATIBLE[grammar] || new Set()).has(task);
  }

  /**
   * Restore a previous set of selections (e.g. returning from a game).
   *
   * Sets the rounds-dial options BEFORE calling setIndex so the restored
   * value is guaranteed to exist in the options array — fixing a subtle
   * ordering bug in the original MainScene restore path for Juggle mode.
   *
   * @param {string|null} grammar
   * @param {string|null} task
   * @param {string|null} cefr
   * @param {string|null} rounds
   * @param {string|null} timer
   */
  restore(grammar, task, cefr, rounds, timer) {
    if (grammar === null && task === null) return;

    // Pre-set rounds-dial options to match the mode we're restoring into,
    // so the subsequent setIndex call finds the value in the options array.
    if (grammar === 'Juggle') {
      this._roundsInJuggleMode = true;
      this._roundsInWheelMode  = false;
      this.roundsDial.setOptions(ROUNDS_JUGGLE);
    } else if (task === 'Wheel') {
      this._roundsInWheelMode  = true;
      this._roundsInJuggleMode = false;
      this.roundsDial.setOptions(ROUNDS_WHEEL);
    }

    [
      { dial: this.grammarDial, value: grammar },
      { dial: this.taskDial,    value: task    },
      { dial: this.cefrDial,    value: cefr    },
      { dial: this.roundsDial,  value: rounds  },
      { dial: this.timerDial,   value: timer   },
    ].forEach(({ dial, value }) => {
      if (value == null) return;
      const idx = dial._options.indexOf(String(value));
      if (idx >= 0) dial.setIndex(idx);
    });

    // Read back actual values (setIndex is silent — no onChange fired)
    this._selections = {
      grammar: this.grammarDial.getValue(),
      task:    this.taskDial.getValue(),
      cefr:    this.cefrDial.getValue(),
      rounds:  this.roundsDial.getValue(),
      timer:   this.timerDial.getValue(),
    };

    // Re-apply compatibility state (task disabled, rounds mode, etc.)
    this._checkCompatibility();
  }

  /** Drive dial rotation animations. Call from the scene's update(). */
  update(delta) {
    this.grammarDial.update(delta);
    this.taskDial.update(delta);
    this.cefrDial.update(delta);
    this.roundsDial.update(delta);
    this.timerDial.update(delta);
  }

  /** Show or hide all five dials. */
  setVisible(bool) {
    this.grammarDial.setVisible(bool);
    this.taskDial.setVisible(bool);
    this.cefrDial.setVisible(bool);
    this.roundsDial.setVisible(bool);
    this.timerDial.setVisible(bool);
  }

  /** Tear down all dial graphics and associated timers. */
  destroy() {
    this.grammarDial.destroy();
    this.taskDial.destroy();
    this.cefrDial.destroy();
    this.roundsDial.destroy();
    this.timerDial.destroy();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Update dial states (options / disabled) to match current selections.
   * Never fires the external onChange — callers decide when to notify.
   */
  _checkCompatibility() {
    const { grammar, task } = this._selections;
    const isJuggle = grammar === 'Juggle';

    // Switch rounds dial between Juggle / Normal / Wheel option sets
    if (isJuggle !== this._roundsInJuggleMode) {
      this._roundsInJuggleMode = isJuggle;
      if (isJuggle) {
        this._roundsInWheelMode = false;
        this.roundsDial.setOptions(ROUNDS_JUGGLE);
      } else {
        this.roundsDial.setOptions(ROUNDS_NORMAL);
      }
      this._selections.rounds = this.roundsDial.getValue();
    }

    if (isJuggle) {
      this.taskDial.setDisabled(true);
      return;
    }

    const valid = (COMPATIBLE[grammar] || new Set()).has(task);
    this.taskDial.setDisabled(!valid);

    const isWheel = task === 'Wheel';
    if (isWheel !== this._roundsInWheelMode) {
      this._roundsInWheelMode = isWheel;
      this.roundsDial.setOptions(isWheel ? ROUNDS_WHEEL : ROUNDS_NORMAL);
      this._selections.rounds = this.roundsDial.getValue();
    }
  }
}
