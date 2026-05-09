'use strict';

// ─── Word sets (single source of truth: shared with client) ──────────────────
const wordsetData = require('../src/assets/wordsets.json');

// Pre-build Sets for O(1) lookup
const WORD_SET_5 = wordsetData.WORD_SET_5.map(s => ({
  letters: s.letters,
  words:   new Set(s.words),
}));
const WORD_SET_6 = wordsetData.WORD_SET_6.map(s => ({
  letters: s.letters,
  words:   new Set(s.words),
}));
const WORD_SET_7 = wordsetData.WORD_SET_7.map(s => ({
  letters: s.letters,
  words:   new Set(s.words),
}));

// ─── In-memory state ──────────────────────────────────────────────────────────
const rooms = new Map();          // roomId  → room object
const socketToRoom = new Map();   // socketId → roomId  (for fast disconnect lookup)

// ─── Constants ────────────────────────────────────────────────────────────────
const ROUND_DURATION_MS = 30_000; // 30 seconds
const ROOM_ID_CHARS     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I ambiguity

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRoomId() {
  let id;
  do {
    id = Array.from({ length: 6 }, () =>
      ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)]
    ).join('');
  } while (rooms.has(id));
  return id;
}

function shuffleString(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function makePlayer(socketId, playerName, uuid) {
  return {
    socketId,
    playerName,
    uuid,
    score:      0,
    wordsFound: [],   // array of strings in submission order
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new room. Returns the room object.
 */
function createRoom(socketId, playerName, uuid, letterCount = 6) {
  const roomId = generateRoomId();
  const player = makePlayer(socketId, playerName, uuid);

  const room = {
    roomId,
    hostId:      socketId,
    status:      'waiting',       // 'waiting' | 'playing' | 'ended'
    letterCount: letterCount === 5 ? 5 : letterCount === 7 ? 7 : 6,
    wordSet:     null,            // populated on startGame
    letters:     null,            // shuffled letters string, populated on startGame
    startTime:   null,
    duration:    ROUND_DURATION_MS,
    players:     [player],
  };

  rooms.set(roomId, room);
  socketToRoom.set(socketId, roomId);
  return room;
}

/**
 * Add a player to an existing room. Returns the room object.
 * Throws if room not found, full (>8), or already playing.
 */
function joinRoom(roomId, socketId, playerName, uuid) {
  const room = rooms.get(roomId);
  if (!room)                     throw new Error(`Room "${roomId}" not found.`);
  if (room.status !== 'waiting') throw new Error('This game has already started.');
  if (room.players.length >= 8)  throw new Error('Room is full (max 8 players).');

  // Reject duplicate display names in the same room
  if (room.players.some(p => p.playerName === playerName)) {
    throw new Error(`Name "${playerName}" is already taken in this room.`);
  }

  const player = makePlayer(socketId, playerName, uuid);
  room.players.push(player);
  socketToRoom.set(socketId, roomId);
  return room;
}

/**
 * Remove a player from their room by socketId.
 * Returns the roomId they were in, or null.
 * Promotes a new host if the old one left.
 * Deletes the room if it becomes empty.
 */
function removePlayer(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;

  socketToRoom.delete(socketId);
  const room = rooms.get(roomId);
  if (!room) return roomId;

  room.players = room.players.filter(p => p.socketId !== socketId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return roomId;
  }

  // Promote first remaining player to host if host left
  if (room.hostId === socketId) {
    room.hostId = room.players[0].socketId;
  }

  return roomId;
}

/**
 * Pick a word set, shuffle letters, mark room as playing.
 * Returns { letters, duration, startTime }.
 * Throws if room not found or already started.
 */
function startGame(roomId) {
  const room = rooms.get(roomId);
  if (!room)                     throw new Error('Room not found.');
  if (room.status !== 'waiting') throw new Error('Game already started.');

  const pool = room.letterCount === 5 ? WORD_SET_5
             : room.letterCount === 7 ? WORD_SET_7
             : WORD_SET_6;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  room.wordSet   = selected;
  room.letters   = shuffleString(selected.letters);
  room.startTime = Date.now();
  room.status    = 'playing';

  // Reset all player scores (in case of play-again)
  for (const p of room.players) {
    p.score      = 0;
    p.wordsFound = [];
  }

  return {
    letters:   room.letters,
    duration:  room.duration,
    startTime: room.startTime,
  };
}

/**
 * Validate and record a word submission.
 * Returns { word, valid, alreadyFound, score }.
 * Throws if room not found or not playing.
 */
function submitWord(roomId, socketId, word) {
  const room = rooms.get(roomId);
  if (!room)                     throw new Error('Room not found.');
  if (room.status !== 'playing') throw new Error('No game in progress.');

  const player = room.players.find(p => p.socketId === socketId);
  if (!player) throw new Error('Player not in room.');

  // Already found by this player?
  if (player.wordsFound.includes(word)) {
    return { word, valid: false, alreadyFound: true, score: player.score };
  }

  // Valid word for this round's set?
  if (room.wordSet.words.has(word)) {
    player.wordsFound.push(word);
    player.score += 1;   // 1 point per word (extend later for length-based scoring)
    return { word, valid: true, alreadyFound: false, score: player.score };
  }

  return { word, valid: false, alreadyFound: false, score: player.score };
}

/**
 * Mark room as ended. Returns the room (for score extraction).
 */
function endGame(roomId) {
  const room = rooms.get(roomId);
  if (room) room.status = 'ended';
  return room;
}

/**
 * Reset a room back to waiting state (play-again).
 * New host can call startGame again.
 */
function resetRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.status    = 'waiting';
  room.wordSet   = null;
  room.letters   = null;
  room.startTime = null;
  return room;
}

/** Get a room by id (read-only reference). */
function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

/** Get the roomId a socket is currently in. */
function getRoomIdForSocket(socketId) {
  return socketToRoom.get(socketId) || null;
}

module.exports = {
  createRoom,
  joinRoom,
  removePlayer,
  startGame,
  submitWord,
  endGame,
  resetRoom,
  getRoom,
  getRoomIdForSocket,
};
