'use strict';

require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const db        = require('./db');
const {
  createRoom, joinRoom, removePlayer,
  startGame, submitWord, submitAnswer, allPlayersFinished,
  endGame, resetRoom,
  getRoom, getRoomIdForSocket,
} = require('./rooms');

const PORT          = process.env.PORT          || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:8080';

// ─── Express + HTTP + Socket.io ───────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin:  CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// ── REST endpoints ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

app.get('/leaderboard', async (_req, res) => {
  const rows = await db.getLeaderboard(20);
  res.json(rows);
});

app.get('/player/:uuid/history', async (req, res) => {
  const rows = await db.getPlayerHistory(req.params.uuid, 20);
  res.json(rows);
});

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── createRoom ──────────────────────────────────────────────────────────────
  socket.on('createRoom', ({
    playerName, uuid,
    letterCount = 6, gameMode = 'juggle',
    grammar = null, task = null, questionCount = 5, timerOn = false,
  }) => {
    try {
      validateName(playerName);
      const room = createRoom(socket.id, playerName, uuid, letterCount, gameMode,
        { grammar, task, questionCount, timerOn });
      socket.join(room.roomId);
      socket.emit('roomCreated', serializeRoom(room));
      console.log(`[room] ${playerName} created ${room.roomId} (${room.gameMode})`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── joinRoom ────────────────────────────────────────────────────────────────
  socket.on('joinRoom', ({ roomId, playerName, uuid }) => {
    try {
      validateName(playerName);
      const room = joinRoom(roomId.toUpperCase().trim(), socket.id, playerName, uuid);
      socket.join(room.roomId);
      socket.emit('roomJoined', serializeRoom(room));
      // Notify others in the room
      socket.to(room.roomId).emit('playerJoined', {
        playerName,
        players: serializePlayers(room),
      });
      console.log(`[room] ${playerName} joined ${room.roomId}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── startGame (host only) ───────────────────────────────────────────────────
  socket.on('startGame', ({ roomId }) => {
    try {
      const room = getRoom(roomId);
      if (!room)                      throw new Error('Room not found.');
      if (room.hostId !== socket.id)  throw new Error('Only the host can start the game.');
      if (room.players.length < 2)    throw new Error('Need at least 2 players to start.');

      const result = startGame(roomId);

      if (room.gameMode === 'multichoice' || room.gameMode === 'gapfill') {
        const { questions, duration, startTime } = result;
        io.to(roomId).emit('roundStart', { questions, duration, startTime, gameMode: room.gameMode });
        console.log(`[game] Room ${roomId} started — ${room.gameMode} (${room.grammar}/${room.task}, ${room.questionCount}q, timerOn=${room.timerOn})`);
        // Only set timer if it's a timed round
        if (duration) setTimeout(() => endRound(roomId), duration);
      } else {
        const { letters, duration, startTime } = result;
        io.to(roomId).emit('roundStart', { letters, duration, startTime, gameMode: room.gameMode });
        console.log(`[game] Room ${roomId} started — "${letters}"`);
        setTimeout(() => endRound(roomId), duration);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── submitAnswer (Multichoice multiplayer) ──────────────────────────────────
  socket.on('submitAnswer', ({ roomId, questionIndex, answer }) => {
    try {
      if (typeof questionIndex !== 'number') throw new Error('Invalid question index.');
      if (!answer || typeof answer !== 'string') throw new Error('Invalid answer.');

      const result = submitAnswer(roomId, socket.id, questionIndex, answer);
      socket.emit('answerResult', result);

      // Broadcast updated score to everyone in the room
      const room   = getRoom(roomId);
      const player = room.players.find(p => p.socketId === socket.id);
      io.to(roomId).emit('scoreUpdate', {
        playerName: player.playerName,
        score:      player.score,
      });

      // End round immediately if all players have finished
      if (allPlayersFinished(roomId)) {
        endRound(roomId);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── submitWord ──────────────────────────────────────────────────────────────
  socket.on('submitWord', ({ roomId, word }) => {
    try {
      if (!word || typeof word !== 'string') throw new Error('Invalid word.');
      const clean  = word.toUpperCase().trim();
      const result = submitWord(roomId, socket.id, clean);

      // Tell this player the outcome
      socket.emit('wordResult', result);

      // Broadcast updated score to everyone in the room
      if (result.valid) {
        const room   = getRoom(roomId);
        const player = room.players.find(p => p.socketId === socket.id);
        io.to(roomId).emit('scoreUpdate', {
          playerName: player.playerName,
          score:      player.score,
          wordCount:  player.wordsFound.length,
        });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── playAgain (host only) ───────────────────────────────────────────────────
  socket.on('playAgain', ({ roomId }) => {
    try {
      const room = getRoom(roomId);
      if (!room)                     throw new Error('Room not found.');
      if (room.hostId !== socket.id) throw new Error('Only the host can reset the game.');
      if (room.status !== 'ended')   throw new Error('Game has not ended yet.');

      resetRoom(roomId);
      io.to(roomId).emit('roomReset', serializeRoom(room));
      console.log(`[game] Room ${roomId} reset for play-again`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── leaveRoom ───────────────────────────────────────────────────────────────
  socket.on('leaveRoom', ({ roomId }) => {
    handleLeave(socket, roomId);
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    const roomId = getRoomIdForSocket(socket.id);
    if (roomId) handleLeave(socket, roomId, true);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** End a round: broadcast final scores, persist to DB. */
async function endRound(roomId) {
  // Guard against double-fire (allPlayersFinished + setTimeout both calling this)
  const existing = getRoom(roomId);
  if (!existing || existing.status === 'ended') return;

  const room = endGame(roomId);  // marks status = 'ended', applies time bonuses
  if (!room) return;

  const scores = room.players
    .map(p => ({
      playerName: p.playerName,
      uuid:       p.uuid,
      score:      p.score,
      wordsFound: p.wordsFound || [],  // empty for Multichoice
    }))
    .sort((a, b) => b.score - a.score);

  io.to(roomId).emit('roundEnd', { scores });
  console.log(`[game] Room ${roomId} ended — winner: ${scores[0]?.playerName ?? 'nobody'}`);

  try {
    await db.saveSession(room, scores);
  } catch (err) {
    console.error('[db] saveSession failed:', err.message);
  }
}

/** Remove a player from their room and notify the room. */
function handleLeave(socket, roomId, disconnected = false) {
  const room = getRoom(roomId);
  if (!room) return;

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  const playerName = player.playerName;
  removePlayer(socket.id);
  socket.leave(roomId);

  const updatedRoom = getRoom(roomId);   // may be null if room was deleted
  socket.to(roomId).emit('playerLeft', {
    playerName,
    players: updatedRoom ? serializePlayers(updatedRoom) : [],
    newHostName: updatedRoom
      ? (updatedRoom.players.find(p => p.socketId === updatedRoom.hostId)?.playerName ?? null)
      : null,
  });

  console.log(`[room] ${playerName} left ${roomId}${disconnected ? ' (disconnected)' : ''}`);
}

/** Validate a display name: 1–20 chars, letters/numbers/spaces/hyphens. */
function validateName(name) {
  if (!name || typeof name !== 'string') throw new Error('Name is required.');
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) throw new Error('Name must be 1–20 characters.');
  if (!/^[\w\s\-]+$/.test(trimmed))              throw new Error('Name contains invalid characters.');
}

/** Strip internal fields before sending player list to clients. */
function serializePlayers(room) {
  return room.players.map(p => ({
    playerName: p.playerName,
    isHost:     p.socketId === room.hostId,
    score:      p.score,
    wordCount:  p.wordsFound ? p.wordsFound.length : (p.answeredCount || 0),
  }));
}

/** Serialize room metadata (sent on roomCreated / roomJoined). */
function serializeRoom(room) {
  return {
    roomId:        room.roomId,
    letterCount:   room.letterCount,
    gameMode:      room.gameMode,
    grammar:       room.grammar,
    task:          room.task,
    questionCount: room.questionCount,
    timerOn:       room.timerOn,
    players:       serializePlayers(room),
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`\nGrammalion server ready on port ${PORT}`);
    console.log(`Accepting connections from: ${CLIENT_ORIGIN}\n`);
  });
}).catch(err => {
  // db.init() itself swallows errors — this is a safety net
  console.error('Startup error:', err.message);
  process.exit(1);
});
