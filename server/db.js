'use strict';

/**
 * db.js — PostgreSQL persistence layer
 *
 * Designed to degrade gracefully: if DATABASE_URL is not set (local dev without
 * a database), all functions become no-ops so the game server still works.
 *
 * Schema (auto-created on init):
 *   players       — one row per UUID (ephemeral in Phase 1; gains auth in Phase 5)
 *   game_sessions — one row per room/round played
 *   session_scores — one row per player per session
 */

const { Pool } = require('pg');

let pool = null;
let dbAvailable = false;

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS players (
    uuid         UUID        PRIMARY KEY,
    display_name VARCHAR(32) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id           SERIAL      PRIMARY KEY,
    room_id      VARCHAR(8)  NOT NULL,
    mode         VARCHAR(32) NOT NULL DEFAULT 'juggle',
    letter_count INT,
    letters      VARCHAR(6),
    started_at   TIMESTAMPTZ NOT NULL,
    ended_at     TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS session_scores (
    id           SERIAL   PRIMARY KEY,
    session_id   INT      NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_uuid  UUID     NOT NULL REFERENCES players(uuid)     ON DELETE CASCADE,
    words_found  TEXT[]   NOT NULL DEFAULT '{}',
    score        INT      NOT NULL DEFAULT 0
  );
`;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Connect to the database and ensure schema exists.
 * Resolves even if DATABASE_URL is missing — server runs without persistence.
 */
async function init() {
  if (!process.env.DATABASE_URL) {
    console.log('[db] DATABASE_URL not set — running without persistence.');
    return;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },   // required for Render-hosted Postgres
    });

    await pool.query(SCHEMA_SQL);
    dbAvailable = true;
    console.log('[db] Connected and schema ready.');
  } catch (err) {
    console.error('[db] Connection failed — running without persistence:', err.message);
    pool = null;
  }
}

// ─── Upsert a player ──────────────────────────────────────────────────────────

/**
 * Insert player if not already known (uuid is the key).
 * Safe to call repeatedly — uses ON CONFLICT DO NOTHING.
 */
async function upsertPlayer(uuid, displayName) {
  if (!dbAvailable) return;
  try {
    await pool.query(
      `INSERT INTO players (uuid, display_name)
       VALUES ($1, $2)
       ON CONFLICT (uuid) DO NOTHING`,
      [uuid, displayName]
    );
  } catch (err) {
    console.error('[db] upsertPlayer error:', err.message);
  }
}

// ─── Save a completed session ─────────────────────────────────────────────────

/**
 * Persist a finished round.
 *
 * @param {object} room   — room object from rooms.js
 * @param {Array}  scores — sorted array of { playerName, uuid, score, wordsFound }
 */
async function saveSession(room, scores) {
  if (!dbAvailable) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert all players first
    for (const s of scores) {
      await client.query(
        `INSERT INTO players (uuid, display_name)
         VALUES ($1, $2)
         ON CONFLICT (uuid) DO NOTHING`,
        [s.uuid, s.playerName]
      );
    }

    // Insert game session
    const sessionRes = await client.query(
      `INSERT INTO game_sessions (room_id, mode, letter_count, letters, started_at)
       VALUES ($1, 'juggle', $2, $3, to_timestamp($4 / 1000.0))
       RETURNING id`,
      [room.roomId, room.letterCount, room.letters, room.startTime]
    );
    const sessionId = sessionRes.rows[0].id;

    // Insert per-player scores
    for (const s of scores) {
      await client.query(
        `INSERT INTO session_scores (session_id, player_uuid, words_found, score)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, s.uuid, s.wordsFound, s.score]
      );
    }

    await client.query('COMMIT');
    console.log(`[db] Session ${sessionId} saved (room ${room.roomId}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db] saveSession error:', err.message);
  } finally {
    client.release();
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * Top N scores of all time (by word count).
 * Returns array of { display_name, score, words_found, played_at }.
 */
async function getLeaderboard(limit = 10) {
  if (!dbAvailable) return [];
  try {
    const res = await pool.query(
      `SELECT p.display_name, ss.score, ss.words_found,
              gs.ended_at AS played_at
       FROM session_scores ss
       JOIN players       p  ON p.uuid = ss.player_uuid
       JOIN game_sessions gs ON gs.id  = ss.session_id
       ORDER BY ss.score DESC, gs.ended_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (err) {
    console.error('[db] getLeaderboard error:', err.message);
    return [];
  }
}

/**
 * Recent sessions for a player UUID.
 */
async function getPlayerHistory(uuid, limit = 20) {
  if (!dbAvailable) return [];
  try {
    const res = await pool.query(
      `SELECT ss.score, ss.words_found, gs.letters,
              gs.letter_count, gs.ended_at AS played_at
       FROM session_scores ss
       JOIN game_sessions gs ON gs.id = ss.session_id
       WHERE ss.player_uuid = $1
       ORDER BY gs.ended_at DESC
       LIMIT $2`,
      [uuid, limit]
    );
    return res.rows;
  } catch (err) {
    console.error('[db] getPlayerHistory error:', err.message);
    return [];
  }
}

module.exports = { init, upsertPlayer, saveSession, getLeaderboard, getPlayerHistory };
