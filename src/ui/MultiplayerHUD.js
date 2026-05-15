/**
 * MultiplayerHUD — Shared multiplayer HUD used by JuggleScene, MultiChoiceScene,
 * and GameScene (Gap Fill multiplayer).
 *
 * Builds:
 *   • Large countdown timer (top-area), colour-coded as time runs out
 *   • Sorted live scoreboard on the left, with ▶ highlight for the local player
 *
 * Positions are passed in via cfg so each scene can place the HUD where it has space.
 *
 * Usage:
 *   const hud = new MultiplayerHUD(this, {
 *     players:    [{ playerName: 'Luke', score: 0 }, ...],
 *     playerName: 'Luke',                    // highlights this player with ▶
 *     duration:   60000,                     // ms; null = no timer rendered
 *     startTime:  serverTimestamp,
 *     timer:      { x: 687, y: 80 },         // omit to skip timer entirely
 *     scoreboard: { cx: 130, y0: 160 },      // omit to skip scoreboard
 *   });
 *
 *   // Per-frame:
 *   hud.update();
 *
 *   // On scoreUpdate socket event:
 *   hud.setScore(data.playerName, data.score);
 *
 *   // On roundEnd:
 *   hud.setRoundEnded();
 *
 *   // On scene shutdown:
 *   hud.destroy();
 */

const COL_SELF        = '#88ffff';
const COL_OTHER       = '#48C1C0';
const COL_TIMER_OK    = '#48C1C0';   // teal,  > 50% remaining
const COL_TIMER_WARN  = '#D4A017';   // amber, 20–50% remaining
const COL_TIMER_DANGER = '#CC3344';  // red,   < 20% remaining

export default class MultiplayerHUD {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} cfg
   * @param {Array<{playerName: string, score: number}>} cfg.players
   * @param {string} cfg.playerName       — local player's name (▶ highlight)
   * @param {number|null} cfg.duration    — round length in ms; null = no timer
   * @param {number} cfg.startTime        — server-issued start timestamp (ms)
   * @param {{x: number, y: number}}      [cfg.timer]      — omit to skip timer
   * @param {{cx: number, y0: number, rowSpacing?: number, panelWidth?: number}} [cfg.scoreboard]
   */
  constructor(scene, cfg) {
    this._scene      = scene;
    this._players    = cfg.players || [];
    this._playerName = cfg.playerName;
    this._duration   = cfg.duration || null;
    this._startTime  = cfg.startTime || null;
    this._roundEnded = false;

    this._gameObjects = [];   // tracked for destroy()
    this._timerText   = null;
    this._scoreTexts  = null;

    // ── Countdown timer ────────────────────────────────────────────────────
    if (this._duration && cfg.timer) {
      this._timerText = scene.add.text(cfg.timer.x, cfg.timer.y, '', {
        fontFamily:      "'Syncopate', monospace",
        fontSize:        '48px',
        fontStyle:       'bold',
        color:           COL_TIMER_OK,
        stroke:          '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5, 0.5);
      this._gameObjects.push(this._timerText);
    }

    // ── Scoreboard ─────────────────────────────────────────────────────────
    if (cfg.scoreboard) {
      const sb     = cfg.scoreboard;
      const cx     = sb.cx;
      const y0     = sb.y0;
      const row    = sb.rowSpacing || 36;
      const panelW = sb.panelWidth || 220;

      const n    = Math.min(this._players.length, 4);
      const panH = n * row + 50;
      const panY = y0 + (n - 1) * row / 2;

      const panel = scene.add.rectangle(cx, panY, panelW, panH, 0x060c14)
        .setStrokeStyle(1, 0x2a6a6a, 0.9);
      this._gameObjects.push(panel);

      const header = scene.add.text(cx, y0 - 26, 'SCORES', {
        fontFamily:    'monospace',
        fontSize:      '10px',
        color:         '#2a6a6a',
        letterSpacing: 3,
      }).setOrigin(0.5, 0.5);
      this._gameObjects.push(header);

      this._scoreTexts = [];
      for (let i = 0; i < n; i++) {
        const t = scene.add.text(cx, y0 + i * row, '', {
          fontFamily: "'Syncopate', monospace",
          fontSize:   '13px',
          fontStyle:  'bold',
          color:      COL_OTHER,
        }).setOrigin(0.5, 0.5);
        this._scoreTexts.push(t);
        this._gameObjects.push(t);
      }

      this._refreshScoreboard();
    }
  }

  /** Called every frame from scene.update(). Ticks the countdown timer. */
  update() {
    if (this._roundEnded) return;
    if (!this._timerText || !this._startTime || !this._duration) return;

    const remaining = Math.max(0, this._startTime + this._duration - Date.now());
    const secs      = Math.ceil(remaining / 1000);
    this._timerText.setText(String(secs));

    const pct = remaining / this._duration;
    if      (pct < 0.2) this._timerText.setColor(COL_TIMER_DANGER);
    else if (pct < 0.5) this._timerText.setColor(COL_TIMER_WARN);
    else                this._timerText.setColor(COL_TIMER_OK);
  }

  /** Apply a server scoreUpdate; redraws the scoreboard sorted by score. */
  setScore(playerName, score) {
    const p = this._players.find(pl => pl.playerName === playerName);
    if (p) p.score = score;
    this._refreshScoreboard();
  }

  /** Freeze the timer (call from roundEnd socket handler). */
  setRoundEnded() {
    this._roundEnded = true;
    if (this._timerText) this._timerText.setText('0');
  }

  /** Tear down all created game objects. Safe to call multiple times. */
  destroy() {
    for (const obj of this._gameObjects) {
      if (obj && obj.destroy) obj.destroy();
    }
    this._gameObjects = [];
    this._scoreTexts  = null;
    this._timerText   = null;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  _refreshScoreboard() {
    if (!this._scoreTexts) return;
    const sorted = [...this._players].sort((a, b) => b.score - a.score);
    sorted.slice(0, 4).forEach((p, i) => {
      const isMe  = p.playerName === this._playerName;
      const label = (isMe ? '▶ ' : '  ') + p.playerName + ':  ' + p.score;
      this._scoreTexts[i]?.setText(label).setColor(isMe ? COL_SELF : COL_OTHER);
    });
  }
}
