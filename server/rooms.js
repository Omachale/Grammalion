'use strict';

// ─── Word sets (single source of truth: shared with client) ──────────────────
const wordsetData = require('../src/assets/wordsets.json');

// ─── Multichoice question pools ───────────────────────────────────────────────
const { QUESTION_POOLS } = require('./questions');

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

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
function createRoom(socketId, playerName, uuid, letterCount = 6, gameMode = 'juggle', options = {}) {
  const roomId = generateRoomId();
  const player = makePlayer(socketId, playerName, uuid);

  const room = {
    roomId,
    hostId:        socketId,
    status:        'waiting',       // 'waiting' | 'playing' | 'ended'
    gameMode:      gameMode,        // 'juggle' | 'multichoice' | 'gapfill' | future modes
    letterCount:   letterCount === 5 ? 5 : letterCount === 7 ? 7 : 6,
    wordSet:       null,            // populated on startGame (juggle)
    letters:       null,            // shuffled letters string (juggle)
    questions:     null,            // populated on startGame (multichoice)
    grammar:       options.grammar       || null,
    task:          options.task          || null,
    questionCount: options.questionCount || 5,
    timerOn:       options.timerOn       || false,
    startTime:     null,
    duration:      ROUND_DURATION_MS,
    players:       [player],
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

  room.startTime = Date.now();
  room.status    = 'playing';

  if (room.gameMode === 'multichoice' || room.gameMode === 'gapfill') {
    // ── Multichoice / Gap Fill: select questions, set round-level timer ─────
    const key  = `${room.grammar}|${room.task}`;
    const pool = QUESTION_POOLS[key] || [];
    if (pool.length === 0) throw new Error(`No questions available for "${key}".`);
    room.questions = shuffleArray(pool).slice(0, room.questionCount);
    room.duration  = room.timerOn ? room.questionCount * 6000 : null;

    // Reset all player state
    for (const p of room.players) {
      p.score         = 0;
      p.answeredCount = 0;
      p.finishTime    = null;
    }

    return {
      questions:  room.questions,
      duration:   room.duration,
      startTime:  room.startTime,
    };
  }

  // ── Juggle: pick a word set, shuffle letters ─────────────────────────────
  const pool = room.letterCount === 5 ? WORD_SET_5
             : room.letterCount === 7 ? WORD_SET_7
             : WORD_SET_6;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  room.wordSet   = selected;
  room.letters   = shuffleString(selected.letters);
  room.duration  = ROUND_DURATION_MS;

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
 * Validate and record an answer for Multichoice or Gap Fill multiplayer.
 * Both modes use the same slash-separated answer format
 * (e.g. "to study/studying" → matches either).
 * Returns { correct, correctAnswers, finished, score }.
 * Throws if room not found, not playing, or wrong gameMode.
 */
function submitAnswer(roomId, socketId, questionIndex, answer) {
  const room = rooms.get(roomId);
  if (!room)                      throw new Error('Room not found.');
  if (room.status !== 'playing')  throw new Error('No game in progress.');
  if (!['multichoice', 'gapfill'].includes(room.gameMode)) {
    throw new Error('Not a question-based room.');
  }

  const player = room.players.find(p => p.socketId === socketId);
  if (!player) throw new Error('Player not in room.');

  const q = room.questions[questionIndex];
  if (!q)  throw new Error('Invalid question index.');

  // Case-insensitive comparison: Gap Fill players type the answer, so case may differ.
  // Multichoice options are already lowercase so this is a no-op for that mode.
  const correctAnswers = q.answer.split('/').map(s => s.trim());
  const typed          = (answer || '').trim().toLowerCase();
  const correct        = correctAnswers.some(a => a.toLowerCase() === typed);

  if (correct) player.score += 1;
  player.answeredCount = (player.answeredCount || 0) + 1;

  const finished = player.answeredCount >= room.questionCount;
  if (finished && !player.finishTime) {
    player.finishTime = Date.now();  // used for time-bonus calculation at round end
  }

  return { correct, correctAnswers, finished, score: player.score };
}

/**
 * Check whether all players in a Multichoice room have finished.
 */
function allPlayersFinished(roomId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  return room.players.every(p => (p.answeredCount || 0) >= room.questionCount);
}

/**
 * Mark room as ended. For Multichoice, applies time bonuses before returning.
 * Returns the room (for score extraction).
 */
function endGame(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.status = 'ended';

  // Apply time bonuses for Multichoice / Gap Fill timed rounds
  if (['multichoice', 'gapfill'].includes(room.gameMode) && room.timerOn && room.startTime && room.duration) {
    const roundEnd = room.startTime + room.duration;
    for (const p of room.players) {
      if (p.finishTime && p.finishTime < roundEnd) {
        const remainingMs = roundEnd - p.finishTime;
        const bonus       = Math.floor(remainingMs / 10000);
        p.score          += Math.max(0, bonus);
      }
      // Players who didn't finish get no time bonus (score stays as-is)
    }
  }

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
  submitAnswer,
  allPlayersFinished,
  endGame,
  resetRoom,
  getRoom,
  getRoomIdForSocket,
};
