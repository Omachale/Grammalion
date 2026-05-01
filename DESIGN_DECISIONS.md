# Grammalion Design Decisions

## Sentence Generation Strategy

**Decision**: Use Claude API to generate sentences on-demand, not local matrix-based generation.

**Rationale**: 
- Matrix approach (5 subjects × 10 verbs × 10 objects) produces semantically strange sentences and doesn't scale well with complexity.
- LLM generates contextually sensible, diverse sentences at acceptable cost ($0.02–0.03 per user session).
- More flexible for grammar point variations without manual data entry.

**Not Yet Implemented**: Integration with Claude API for live sentence generation.

---

## Sentence Caching (App-Level)

**Decision**: Cache generated sentences at the application level, not reliant on Claude API prompt caching.

**Strategy**:
- Maintain a pool of ~50 sentences per (CEFR level, grammar point) combination
- Serve all players requesting that combination from the cached pool
- Refresh pools daily or on-demand (e.g., weekly scheduled refresh)
- Each session: randomly select 30 from the pool for the user

**Benefits**:
- Cost reduction: ~$0.35/day (50 API calls) vs. $2/day per-request (~$10/month vs. $60/month)
- Instant delivery to players (no API latency)
- Players still see variety through random sampling

**Not Yet Implemented**: Cache storage, refresh scheduler, pool initialization.

---

## User Practice Flow

**Grammar Point Selection**: User chooses CEFR level + specific grammar point to practice (e.g., B1, "subject verb agreement").

**Sentence Modification**: Sentences are delivered from cache and modified in-app:
- Present simple tense
- Target verb omitted, shown in parentheses after a space
- Example: `"She ____ (eat) pizza."` → User types "eats"

**Buffer Management**: App maintains a buffer of 10–20 sentences in-memory:
- User works through sentences
- When buffer ≤20 remaining, fire async request for next batch
- Fetch from cache (instant) or trigger API call if pool exhausted

**Not Yet Implemented**: UI for grammar point selection, sentence rendering, user input handling, buffer logic.

---

## CEFR Levels & Grammar Points

**Scope** (to be defined):
- Which CEFR levels to support (A1–C2? A1–B2? Just B1–B2?)
- Which grammar points per level (e.g., B1: subject-verb agreement, present perfect, modal verbs, etc.)
- Estimated: 6–10 grammar points per level

**Not Yet Implemented**: Master list of grammar points and their CEFR mappings.

---

## Technical Stack

- **Frontend**: Phaser 4 (game engine)
- **API**: Claude API (sentence generation)
- **Storage**: TBD (sentences cache — database? JSON file? Redis?)
- **Server**: TBD (if needed for cache management and API calls)

**Not Yet Implemented**: Backend infrastructure for caching and API integration.

---

## API Cost Estimates

**Per-request approach** (if implemented naively):
- ~3 API calls per user session (30 sentences per batch)
- Cost per call: ~$0.007 (30 sentences at ~15 tokens each)
- 100 users/day: ~$2/day (~$60/month)

**App-level cache approach** (recommended):
- ~50 API calls/day to refresh pools across all grammar points
- Cost: ~$0.35/day (~$10/month)
- **Savings: ~83% reduction**

**Not Yet Implemented**: Actual API integration and cost tracking.

---

## Outstanding Questions

- Where to store cached sentence pools? (Database vs. file-based vs. in-memory?)
- How often to refresh pools? (Daily, weekly, on-demand?)
- Which grammar points to prioritize for MVP?
- Should the game track user progress/scoring?
- How many CEFR levels to support initially?
