/**
 * LobbyScene.js — Multiplayer lobby
 *
 * Mounts a plain HTML form as an absolute overlay on top of the Phaser canvas.
 * This avoids Phaser's DOM container system (which differs between Phaser versions).
 *
 * Flow:
 *   1. Player enters a display name
 *   2. They create a new room OR join one with a 6-character code
 *   3. Everyone sees the live player list
 *   4. Host clicks START — all players launch JuggleScene with the same letters
 */

import * as Phaser from 'phaser';
import socketClient      from '../network/SocketClient';
import roomManager       from '../network/RoomManager';
import GameSelector, { COMPATIBLE } from '../ui/GameSelector';

// ── Lobby form HTML ───────────────────────────────────────────────────────────

const LOBBY_HTML = `
<style>
  #gl-lobby * { box-sizing: border-box; margin: 0; padding: 0; }
  #gl-lobby input { caret-color: #48C1C0; }
  #gl-lobby input::placeholder { color: #2a6a6a; }
  #gl-lobby input:focus { outline: 2px solid #88ffff; outline-offset: 0; }
  #gl-lobby button { transition: filter 0.1s; }
  #gl-lobby button:not(:disabled):hover { filter: brightness(1.3); }
  #gl-lobby button:not(:disabled):active { transform: scale(0.97); }
</style>

<div id="gl-lobby" style="
  width: 440px;
  background: rgba(6,12,20,0.97);
  border: 2px solid #48C1C0;
  padding: 28px 28px 18px;
  font-family: Syncopate, monospace;
  color: #48C1C0;
  max-height: 90vh;
  overflow-y: auto;
">

  <!-- ── Name-entry panel ──────────────────────────────────────────── -->
  <div id="name-panel">
    <div style="font-size:10px;letter-spacing:3px;color:#2a6a6a;margin-bottom:10px;">
      YOUR DISPLAY NAME
    </div>
    <input id="name-input" type="text" maxlength="20" placeholder="e.g. PLAYER1"
      autocomplete="off" spellcheck="false"
      style="
        width:100%;background:#0a0f1a;border:2px solid #48C1C0;
        color:#48C1C0;font-family:Syncopate,monospace;
        font-size:18px;font-weight:bold;padding:10px 12px;
        text-transform:uppercase;display:block;margin-bottom:20px;
      ">
    <button id="create-btn" style="
        width:100%;background:#1a3a3a;border:2px solid #48C1C0;
        color:#48C1C0;font-family:Syncopate,monospace;
        font-size:13px;font-weight:bold;padding:13px;
        cursor:pointer;letter-spacing:2px;display:block;margin-bottom:14px;
      ">
      CREATE ROOM
    </button>
    <div style="font-size:10px;letter-spacing:2px;color:#2a6a6a;text-align:center;margin-bottom:12px;">
      — OR JOIN EXISTING —
    </div>
    <div style="display:flex;gap:8px;">
      <input id="code-input" type="text" maxlength="8" placeholder="ROOM CODE"
        autocomplete="off" spellcheck="false"
        style="
          flex:1;background:#0a0f1a;border:2px solid #2a6a6a;
          color:#48C1C0;font-family:Syncopate,monospace;
          font-size:15px;font-weight:bold;padding:10px 12px;
          text-transform:uppercase;
        ">
      <button id="join-btn" style="
          background:#1a3a3a;border:2px solid #48C1C0;
          color:#48C1C0;font-family:Syncopate,monospace;
          font-size:12px;font-weight:bold;padding:10px 14px;
          cursor:pointer;letter-spacing:1px;white-space:nowrap;
        ">
        JOIN
      </button>
    </div>
    <button id="back-html-btn" style="
        width:100%;background:#1a3a3a;border:2px solid #48C1C0;
        color:#48C1C0;font-family:Syncopate,monospace;
        font-size:12px;font-weight:bold;padding:10px 14px;
        cursor:pointer;letter-spacing:1px;display:block;margin-top:10px;
      ">
      ◀  BACK
    </button>
    <div id="name-error" style="
        color:#CC3344;font-size:11px;letter-spacing:1px;
        margin-top:10px;min-height:16px;
      "></div>
  </div>

  <!-- ── Room panel (shown after create/join) ──────────────────────── -->
  <div id="room-panel" style="display:none;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:10px;letter-spacing:3px;color:#2a6a6a;margin-bottom:6px;">
        ROOM CODE — share with friends
      </div>
      <div id="room-code-display" style="
          font-size:38px;font-weight:bold;letter-spacing:12px;color:#48C1C0;padding:8px 0;
        "></div>
    </div>

    <div style="font-size:10px;letter-spacing:3px;color:#2a6a6a;margin-bottom:8px;">
      PLAYERS IN ROOM
    </div>
    <div id="player-list" style="
        min-height:70px;margin-bottom:18px;
        border:1px solid #1a4a4a;padding:8px;background:#060c14;
      "></div>

    <div id="host-controls" style="display:none;margin-bottom:12px;">
      <button id="start-btn" disabled style="
          width:100%;background:#0a2020;
          border:2px solid #2a6a6a;color:#2a6a6a;
          font-family:Syncopate,monospace;font-size:14px;font-weight:bold;
          padding:14px;cursor:not-allowed;letter-spacing:2px;
        ">
        START GAME
      </button>
      <div id="start-hint" style="
          font-size:10px;color:#2a6a6a;text-align:center;margin-top:6px;letter-spacing:1px;
        ">
        Need at least 2 players to start
      </div>
    </div>

    <div id="guest-controls" style="display:none;margin-bottom:12px;">
      <div style="
          font-size:11px;color:#2a6a6a;text-align:center;
          letter-spacing:2px;padding:12px;border:1px solid #1a4a4a;
        ">
        Waiting for host to start...
      </div>
    </div>

    <div id="starting-msg" style="display:none;margin-bottom:12px;">
      <div style="
          font-size:16px;font-weight:bold;color:#22BB44;text-align:center;
          letter-spacing:3px;padding:14px;border:2px solid #22BB44;
        ">
        STARTING!
      </div>
    </div>

    <button id="leave-btn" style="
        width:100%;background:#0a0f1a;
        border:1px solid #CC3344;color:#CC3344;
        font-family:Syncopate,monospace;font-size:11px;
        padding:10px;cursor:pointer;letter-spacing:1px;
      ">
      LEAVE ROOM
    </button>
  </div>

  <div id="conn-status" style="
      font-size:9px;letter-spacing:2px;color:#1a4a4a;
      text-align:center;margin-top:14px;
    ">
    CONNECTING...
  </div>
</div>
`;

// ─────────────────────────────────────────────────────────────────────────────

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this._overlay = null;
    this._el      = {};
  }

  // ── Preload ────────────────────────────────────────────────────────────────

  preload() {
    this.load.image('rooms-btn', 'assets/images/game/Rooms.jpg');
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  create() {
    const cw = this.cameras.main.width;
    const ch = this.cameras.main.height;

    // ── Background UI + game-selector dials ──────────────────────────────────
    // Compute the same contain-fit scale that MainScene uses so the dials
    // land exactly in their dial-hole artwork.
    const BG_IMG_W  = 1570;
    const BG_IMG_H  = 868;
    const bgScale   = Math.min(cw / BG_IMG_W, ch / BG_IMG_H);
    const bgXOffset = (cw - BG_IMG_W * bgScale) / 2;
    const bgYOffset = (ch - BG_IMG_H * bgScale) / 2;

    // Added FIRST so that the title text and back button (added next) render
    // on top of the background image rather than being hidden behind it.
    this._bgImage = this.add.image(cw / 2, ch / 2, 'bg').setScale(bgScale);

    // Scan-line tile texture (created once; survives scene restarts).
    if (!this.textures.exists('dial-scanlines')) {
      const slGfx = this.make.graphics({ add: false });
      slGfx.fillStyle(0x000000, 0);
      slGfx.fillRect(0, 0, 1, 4);
      slGfx.fillStyle(0x000000, 0.38);
      slGfx.fillRect(0, 4, 1, 1);
      slGfx.generateTexture('dial-scanlines', 1, 5);
      slGfx.destroy();
    }

    // ── Title (above background) ───────────────────────────────────────────────
    this.add.text(cw / 2, 54, 'MULTIPLAYER', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '26px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    // ── Single Player button (bottom-right; mirrors "Play Online" in MainScene) ──
    const backBtn = this.add.text(cw - 20, ch - 20, '◀  SINGLE PLAYER', {
      fontFamily:      "'Syncopate', monospace",
      fontSize:        '13px',
      fontStyle:       'bold',
      color:           '#48C1C0',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover',  () => backBtn.setColor('#88ffff'));
    backBtn.on('pointerout',   () => backBtn.setColor('#48C1C0'));
    backBtn.on('pointerdown',  () => this._leaveAndGoBack());

    this._selector = new GameSelector(this, bgScale, bgXOffset, bgYOffset, {
      timerOptions: ['Off', 'On'],
    });

    // ── ROOMS button — image-based button, opens the create/join overlay on demand
    this._roomsBtn = this.add.image(
      Math.round(bgXOffset + 775 * bgScale),
      Math.round(bgYOffset + 170 * bgScale),
      'rooms-btn'
    ).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    // Scale to roughly match the visual prominence of the start button
    this._roomsBtn.setScale(0.45);
    this._roomsBtn.on('pointerover',  () => this._roomsBtn.setAlpha(0.8));
    this._roomsBtn.on('pointerout',   () => this._roomsBtn.setAlpha(1.0));
    this._roomsBtn.on('pointerdown',  () => this._showRoomsOverlay());

    // ── Connect to server ─────────────────────────────────────────────────────
    socketClient.connect();
    this._registerSocketHandlers();
    if (socketClient.connected) {
      this._setConnStatus('CONNECTED  ●', '#22BB44');
    }

    // ── Cleanup on scene shutdown ─────────────────────────────────────────────
    this.events.once('shutdown', () => this._cleanup());
  }

  // ── HTML overlay ───────────────────────────────────────────────────────────

  _mountOverlay() {
    // Use position:fixed so the overlay covers the full viewport without
    // touching the canvas parent's CSS (which would cause a layout reflow
    // and make Phaser recalculate canvas bounds, shifting the game content).
    this._overlay = document.createElement('div');
    this._overlay.id = 'grammalion-lobby-overlay';
    Object.assign(this._overlay.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      width:          '100vw',
      height:         '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         '100',
      pointerEvents:  'none',   // pass mouse-through to Phaser for empty areas
    });

    this._overlay.innerHTML = LOBBY_HTML;
    document.body.appendChild(this._overlay);

    // The form itself must receive pointer events
    const form = this._overlay.querySelector('#gl-lobby');
    form.style.pointerEvents = 'auto';

    // Stop keyboard events from reaching Phaser while typing
    this._overlay.addEventListener('keydown', e => e.stopPropagation(), true);
    this._overlay.addEventListener('keyup',   e => e.stopPropagation(), true);

    // Cache references to all interactive elements
    const q = id => this._overlay.querySelector(`#${id}`);
    this._el = {
      nameInput:     q('name-input'),
      codeInput:     q('code-input'),
      createBtn:     q('create-btn'),
      joinBtn:       q('join-btn'),
      backHtmlBtn:   q('back-html-btn'),
      nameError:     q('name-error'),
      namePanel:     q('name-panel'),
      roomPanel:     q('room-panel'),
      roomCode:      q('room-code-display'),
      playerList:    q('player-list'),
      hostControls:  q('host-controls'),
      guestControls: q('guest-controls'),
      startBtn:      q('start-btn'),
      startHint:     q('start-hint'),
      startingMsg:   q('starting-msg'),
      leaveBtn:      q('leave-btn'),
      connStatus:    q('conn-status'),
    };

    // Button click listeners
    this._el.createBtn.addEventListener(  'click', () => this._handleCreate());
    this._el.joinBtn.addEventListener(    'click', () => this._handleJoin());
    this._el.startBtn.addEventListener(   'click', () => this._handleStart());
    this._el.leaveBtn.addEventListener(   'click', () => this._handleLeaveRoom());
    this._el.backHtmlBtn.addEventListener('click', () => this._hideRoomsOverlay());

    // Allow pressing Enter in either input
    this._el.nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._handleCreate();
    });
    this._el.codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._handleJoin();
    });
  }

  // ── Rooms overlay show / hide ──────────────────────────────────────────────

  /** Open the create/join overlay. Lazy-mounts it on first call. */
  _showRoomsOverlay() {
    if (!this._overlay) this._mountOverlay();
    this._overlay.style.display = 'flex';
    if (this._roomsBtn) this._roomsBtn.setVisible(false);
  }

  /** Close the overlay and return to the dials view. */
  _hideRoomsOverlay() {
    if (this._overlay) this._overlay.style.display = 'none';
    if (this._bgImage)  this._bgImage.setVisible(true);
    if (this._selector) this._selector.setVisible(true);
    if (this._roomsBtn) this._roomsBtn.setVisible(true);
  }

  /** Leave the current server room and return to the name-entry panel. */
  _handleLeaveRoom() {
    roomManager.leave();
    // Restore the background and dials (hidden by _showRoomPanel)
    if (this._bgImage)  this._bgImage.setVisible(true);
    if (this._selector) this._selector.setVisible(true);
    // Back to name panel inside the overlay (ROOMS button stays hidden —
    // the overlay is still open so the player can create or join again)
    if (this._el.roomPanel)   this._el.roomPanel.style.display   = 'none';
    if (this._el.namePanel)   this._el.namePanel.style.display   = 'block';
    if (this._el.startingMsg) this._el.startingMsg.style.display = 'none';
    this._setBusy(false);
    this._showError('');
  }

  // ── Button handlers ────────────────────────────────────────────────────────

  _handleCreate() {
    if (!socketClient.connected) {
      this._showError('Not connected to server — check the server is running.');
      return;
    }
    const { grammar, task, rounds, timer } = this._selector.getSelections();
    const isJuggle      = grammar === 'Juggle';
    const isMultichoice = task === 'Multichoice' &&
                          (COMPATIBLE[grammar] || new Set()).has('Multichoice');

    if (!isJuggle && !isMultichoice) {
      this._showError('Not available online yet.');
      return;
    }

    const name = this._validateName();
    if (!name) return;

    roomManager.setPlayer(name, socketClient.uuid);

    if (isJuggle) {
      const letterCount = parseInt(rounds, 10);  // '5 Letters' → 5
      roomManager.create(letterCount, 'juggle');
    } else {
      const questionCount = parseInt(rounds, 10);  // 5, 10, or 15
      const timerOn       = timer !== 'Off';        // 'On' → timed round; 'Off' → finish-to-end
      roomManager.create(0, 'multichoice', { grammar, task, questionCount, timerOn });
    }

    this._setBusy(true);
  }

  _handleJoin() {
    const name = this._validateName();
    if (!name) return;
    const code = this._el.codeInput.value.trim().toUpperCase();
    if (!code) { this._showError('Enter a room code.'); return; }
    roomManager.setPlayer(name, socketClient.uuid);
    roomManager.join(code);
    this._setBusy(true);
  }

  _handleStart() {
    if (this._el.startBtn.disabled) return;
    roomManager.startGame();
    this._el.startBtn.disabled     = true;
    this._el.startBtn.textContent  = 'STARTING...';
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  _validateName() {
    const raw = this._el.nameInput.value.trim().toUpperCase();
    if (!raw)            { this._showError('Please enter your name.');          return null; }
    if (raw.length > 20) { this._showError('Name too long (max 20 chars).');    return null; }
    this._showError('');
    return raw;
  }

  _showError(msg) { if (this._el.nameError) this._el.nameError.textContent = msg; }
  _setBusy(b)     {
    if (!this._el.createBtn) return;
    this._el.createBtn.disabled = b;
    this._el.joinBtn.disabled   = b;
  }

  _setConnStatus(text, color) {
    if (!this._el.connStatus) return;
    this._el.connStatus.textContent = text;
    this._el.connStatus.style.color = color;
  }

  // ── Socket handlers ────────────────────────────────────────────────────────

  _registerSocketHandlers() {
    // Purge any stale handlers from a previous scene lifecycle before adding fresh ones
    ['connect','disconnect','roomCreated','roomJoined',
     'playerJoined','playerLeft','roundStart','roomReset','error',
    ].forEach(e => socketClient.offAll(e));

    socketClient.on('connect',    () => this._setConnStatus('CONNECTED  ●', '#22BB44'));
    socketClient.on('disconnect', () => this._setConnStatus('DISCONNECTED  ○', '#CC3344'));

    socketClient.on('roomCreated', (data) => {
      roomManager.onRoomCreated(data);
      this._setBusy(false);
      this._showRoomPanel(data.roomId, data.players, true);
    });

    socketClient.on('roomJoined', (data) => {
      roomManager.onRoomJoined(data);
      this._setBusy(false);
      this._showRoomPanel(data.roomId, data.players, false);
    });

    socketClient.on('playerJoined', (data) => {
      roomManager.onPlayerListUpdate(data.players);
      this._updatePlayerList(data.players);
      this._updateStartButton(data.players);
    });

    socketClient.on('playerLeft', (data) => {
      roomManager.onPlayerListUpdate(data.players);
      this._updatePlayerList(data.players);
      this._updateStartButton(data.players);
      // Promote to host if applicable
      if (data.newHostName === roomManager.playerName) {
        roomManager.isHost = true;
        this._el.hostControls.style.display  = 'block';
        this._el.guestControls.style.display = 'none';
        this._updateStartButton(data.players);
      }
    });

    socketClient.on('roundStart', (data) => this._onRoundStart(data));
    socketClient.on('roomReset',  (data) => {
      roomManager.onRoomReset(data);
      this._updatePlayerList(data.players);
      this._updateStartButton(data.players);
      this._el.startingMsg.style.display = 'none';
    });

    socketClient.on('error', (data) => {
      this._setBusy(false);
      this._showError(data.message || 'Something went wrong.');
    });
  }

  // ── Room panel UI ──────────────────────────────────────────────────────────

  _showRoomPanel(roomId, players, isHost) {
    // Hide game-selector UI — player no longer needs to change settings
    if (this._bgImage)  this._bgImage.setVisible(false);
    if (this._selector) this._selector.setVisible(false);
    if (this._roomsBtn) this._roomsBtn.setVisible(false);

    this._el.namePanel.style.display = 'none';
    this._el.roomPanel.style.display = 'block';
    this._el.roomCode.textContent    = roomId;
    this._updatePlayerList(players);

    this._el.hostControls.style.display  = isHost ? 'block' : 'none';
    this._el.guestControls.style.display = isHost ? 'none'  : 'block';

    if (isHost) this._updateStartButton(players);
  }

  _updatePlayerList(players) {
    this._el.playerList.innerHTML = players.map(p => `
      <div style="
        display:flex;justify-content:space-between;
        padding:5px 4px;font-size:12px;letter-spacing:1px;
        border-bottom:1px solid #0a2020;
      ">
        <span>${p.isHost ? '★ ' : ''}${p.playerName}</span>
        <span style="color:#2a6a6a;font-size:10px;">${p.isHost ? 'HOST' : 'PLAYER'}</span>
      </div>
    `).join('');
  }

  _updateStartButton(players) {
    if (!roomManager.isHost) return;
    const enough = players.length >= 2;
    const btn    = this._el.startBtn;

    btn.disabled = !enough;
    btn.style.background  = enough ? '#1a3a3a' : '#0a2020';
    btn.style.borderColor = enough ? '#48C1C0' : '#2a6a6a';
    btn.style.color       = enough ? '#48C1C0' : '#2a6a6a';
    btn.style.cursor      = enough ? 'pointer' : 'not-allowed';
    this._el.startHint.textContent = enough
      ? `${players.length} players ready — press START!`
      : 'Need at least 2 players to start';
  }

  // ── Round start → launch game ──────────────────────────────────────────────

  _onRoundStart(data) {
    this._el.startingMsg.style.display   = 'block';
    this._el.hostControls.style.display  = 'none';
    this._el.guestControls.style.display = 'none';

    this.time.delayedCall(800, () => {
      this._cleanup();

      const { letterCount, roomId, playerName, players } = roomManager;
      const gameMode  = data.gameMode || roomManager.gameMode;  // server-authoritative; roomManager as fallback
      const roundsStr = `${letterCount} Letters`;

      if (gameMode === 'juggle') {
        // Run JuggleScene alongside GameBeamScene (which keeps providing the
        // Display4 background), exactly like the single-player path does.
        this.scene.run('JuggleScene', {
          letters:       data.letters,
          rounds:        roundsStr,
          duration:      data.duration,
          startTime:     data.startTime,
          isMultiplayer: true,
          roomId,
          playerName,
          players,
        });
      } else if (gameMode === 'multichoice') {
        this.scene.run('MultiChoiceScene', {
          questions:     data.questions,
          grammar:       roomManager.grammar,
          rounds:        roomManager.questionCount,
          timer:         roomManager.timerOn ? 'On' : 'Off',
          duration:      data.duration,
          startTime:     data.startTime,
          isMultiplayer: true,
          roomId,
          playerName,
          players,
        });
      }

      this.scene.stop('LobbyScene');
    });
  }

  // ── Leave ──────────────────────────────────────────────────────────────────

  _leaveAndGoBack() {
    roomManager.leave();
    this._cleanup();
    // Stop the GameBeamScene background, then return to MainScene
    this.scene.stop('GameBeamScene');
    this.scene.start('MainScene');
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(_time, delta) {
    if (this._selector) this._selector.update(delta);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  _cleanup() {
    // Tear down game-selector Phaser objects
    if (this._selector) {
      this._selector.destroy();
      this._selector = null;
    }

    // Remove HTML overlay
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
      this._overlay = null;
    }
    // Remove socket listeners to prevent memory leaks / stale handlers
    [
      'connect','disconnect','roomCreated','roomJoined',
      'playerJoined','playerLeft','roundStart','roomReset','error',
    ].forEach(e => socketClient.offAll(e));
  }
}
