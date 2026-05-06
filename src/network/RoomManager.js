/**
 * RoomManager.js — room state store + helper actions
 *
 * Sits between scenes and SocketClient.
 * Scenes call RoomManager methods; RoomManager emits socket events and
 * keeps a local copy of room state so scenes can read it without querying
 * the server.
 *
 * Usage (in a scene):
 *   import roomManager from '../network/RoomManager';
 *   roomManager.setPlayer('Luke', socketClient.uuid);
 *   roomManager.create(6);          // create a 6-letter room
 *   roomManager.join('AX7KQ2');     // join by code
 */

import socketClient from './SocketClient';

class RoomManager {
  constructor() {
    this.reset();
  }

  // ── State ───────────────────────────────────────────────────────────────────

  reset() {
    this.roomId      = null;
    this.players     = [];     // [{ playerName, isHost, score, wordCount }]
    this.isHost      = false;
    this.letterCount = 6;
    this.playerName  = null;
    this.uuid        = null;
  }

  // ── Setup ───────────────────────────────────────────────────────────────────

  /** Call this before create/join to set the player's identity. */
  setPlayer(playerName, uuid) {
    this.playerName = playerName;
    this.uuid       = uuid;
  }

  // ── Actions (emit to server) ────────────────────────────────────────────────

  create(letterCount = 6) {
    this.letterCount = letterCount;
    socketClient.emit('createRoom', {
      playerName:  this.playerName,
      uuid:        this.uuid,
      letterCount: this.letterCount,
    });
  }

  join(roomId) {
    socketClient.emit('joinRoom', {
      roomId,
      playerName: this.playerName,
      uuid:       this.uuid,
    });
  }

  leave() {
    if (this.roomId) {
      socketClient.emit('leaveRoom', { roomId: this.roomId });
    }
    this.reset();
  }

  startGame() {
    socketClient.emit('startGame', { roomId: this.roomId });
  }

  submitWord(word) {
    socketClient.emit('submitWord', { roomId: this.roomId, word });
  }

  // ── State updaters (called by LobbyScene when socket events arrive) ─────────

  onRoomCreated(data) {
    this.roomId      = data.roomId;
    this.players     = data.players;
    this.letterCount = data.letterCount;
    this.isHost      = true;
  }

  onRoomJoined(data) {
    this.roomId      = data.roomId;
    this.players     = data.players;
    this.letterCount = data.letterCount;
    this.isHost      = false;
  }

  onPlayerListUpdate(players) {
    this.players = players;
  }

  onRoomReset(data) {
    this.players     = data.players;
    this.letterCount = data.letterCount;
  }
}

// Export as singleton
export default new RoomManager();
