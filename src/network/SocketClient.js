/**
 * SocketClient.js — singleton Socket.io connection
 *
 * Import this wherever you need to talk to the server.
 * Only one socket connection exists for the whole app.
 *
 * Usage:
 *   import socketClient from '../network/SocketClient';
 *   socketClient.connect();
 *   socketClient.emit('createRoom', { ... });
 *   socketClient.on('roomCreated', (data) => { ... });
 */

import { io } from 'socket.io-client';

/* global __SERVER_URL__ */
const SERVER_URL = (typeof __SERVER_URL__ !== 'undefined')
  ? __SERVER_URL__
  : 'http://localhost:3000';

class SocketClient {
  constructor() {
    this._socket    = null;
    this._uuid      = this._getOrCreateUuid();
  }

  // ── Player identity ─────────────────────────────────────────────────────────

  /**
   * Returns a stable UUID for this browser, creating one if needed.
   * This persists across sessions (stored in localStorage).
   * When accounts are added later, this UUID links guest history to the account.
   */
  _getOrCreateUuid() {
    let uuid = localStorage.getItem('grammalion_uuid');
    if (!uuid) {
      uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      localStorage.setItem('grammalion_uuid', uuid);
    }
    return uuid;
  }

  get uuid()      { return this._uuid; }
  get connected() { return this._socket?.connected ?? false; }
  get socket()    { return this._socket; }

  // ── Connection ──────────────────────────────────────────────────────────────

  connect() {
    if (this._socket?.connected) return this._socket;

    this._socket = io(SERVER_URL, {
      transports:       ['websocket'],
      reconnection:     true,
      reconnectionDelay: 1000,
    });

    this._socket.on('connect', () => {
      console.log(`[socket] Connected to ${SERVER_URL} (id: ${this._socket.id})`);
    });
    this._socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnected: ${reason}`);
    });
    this._socket.on('connect_error', (err) => {
      console.warn(`[socket] Connection error: ${err.message}`);
    });

    return this._socket;
  }

  disconnect() {
    this._socket?.disconnect();
    this._socket = null;
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  emit(event, data) {
    if (!this._socket?.connected) {
      console.warn(`[socket] Cannot emit "${event}" — not connected`);
      return;
    }
    this._socket.emit(event, data);
  }

  on(event, handler) {
    this._socket?.on(event, handler);
  }

  off(event, handler) {
    this._socket?.off(event, handler);
  }

  /** Remove all listeners for an event (useful when a scene shuts down). */
  offAll(event) {
    this._socket?.removeAllListeners(event);
  }
}

// Export as singleton — one connection for the whole app
export default new SocketClient();
