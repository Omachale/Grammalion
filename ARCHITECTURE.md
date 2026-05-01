# Grammalion Game Architecture

## Project Overview

**Grammalion** is a Phaser 4-based HTML5 browser game for English grammar and vocabulary learning. Players select a grammar topic, difficulty level, task type, timer mode, and round count, then play one of several mini-game modes to answer questions or build words.

**Current Focus**: Juggle mode (word-building with letter dice) is fully implemented with 22 word sets, random selection, dynamic letter shuffling, and responsive UI.

---

## Technology Stack

- **Engine**: Phaser 4 (game framework)
- **Build Tool**: Webpack 5 with CopyPlugin
- **Language**: JavaScript ES6+
- **Styling**: Inline Phaser config (no CSS)
- **Fonts**: Google Fonts (Syncopate for UI text; monospace for labels)
- **Scale Mode**: Responsive (RESIZE) — canvas scales with window

---

## Game Architecture Overview

### Scene Flow

```
MainScene (home screen with dial selection)
    ↓ (player selects grammar + task + CEFR + timer + rounds, clicks Start)
GameBeamScene (transition animation + data forwarding)
    ↓
Target Scene (one of: GameScene, MultiChoiceScene, JuggleScene, WheelScene, etc.)
    ↓ (play game, return via Menu button)
MainScene (game paused, ready for next selection)
```

### Key Scenes

| Scene | Purpose | Status |
|---|---|---|
| **MainScene** | Home screen with 5 rotary dials for selection | ✓ Complete |
| **GameBeamScene** | Transition animation + data routing to target scene | ✓ Complete |
| **JuggleScene** | Word-building with letter dice (NEW, expanded) | ✓ Complete |
| **GameScene** | Gap-fill / sentence completion | ✓ Exists |
| **MultiChoiceScene** | Multiple choice questions | ✓ Exists |
| **WheelScene** | Spinning wheel game mode | ✓ Exists |
| **ReorderScene** | Sentence reordering | ✓ Exists |
| **CorrectionScene** | Error identification | ✓ Exists |
| **ResultsScene** | End-of-game summary | ✓ Exists |
| **ScanLineScene** | Legacy/unused | - |

---

## Core Mechanics: Juggle Mode

### Overview

Players click or press letter keys to build words from a set of 5 or 6 dice. Each letter can only be used once. Valid words earn points and are displayed in a found-words box. The game supports 11 different 5-letter sets and 11 different 6-letter sets, randomly selected on each game start with freshly shuffled letters.

### How Juggle Works

1. **Selection**: Player selects "Juggle" on Grammar dial → Rounds dial shows "5 Letters" or "6 Letters"
2. **Game Start**: Pressing Start launches `GameBeamScene` with target="JuggleScene"
3. **Initialization** (in `JuggleScene.init()`):
   - Parse `data.rounds` to determine 5 or 6 letter mode
   - Randomly select one of 11 word sets for that length
   - Shuffle the letters of the selected set
   - Store the word list
4. **Dice Creation** (in `JuggleScene.create()`):
   - Build die positions dynamically using `_buildDiePositions()` based on shuffled letters
   - Create interactive die images (red initially, green when selected)
   - Attach click and keyboard listeners
5. **Gameplay**:
   - Player clicks a die or presses its letter key → die turns green, letter appends to input field
   - Each die can only be selected once per round
   - BACKSPACE removes the last-selected letter and resets that die
   - ENTER submits the word for validation
6. **Validation**:
   - Valid word (in word list) → green feedback, word added to found-words box, dice reset
   - Invalid word → red feedback + camera shake, dice reset
   - Already-found word → gold "ALREADY FOUND!" feedback, dice reset
7. **Found-Words Box**:
   - Displays all submitted valid words
   - Text size shrinks in 3 stages as word count grows (4→5→6 columns)
   - Shows running count (e.g., "WORDS FOUND 7/24")
8. **Exit**: Menu button (top-right) stops both JuggleScene and GameBeamScene, returns to MainScene

### Word Sets

#### Structure
Each word set is an object with:
- `letters`: string of 5 or 6 base letters (e.g., "SHINE")
- `words`: Set of all valid words (3+ letters) formable from those letters

#### 5-Letter Sets (11 total)
| # | Letters | Example Valid Words |
|---|---------|---|
| 1 | SHINE | SHINE, HENS, SINE, SHIN, HEN, HIS, SHE, SIN, ... |
| 2 | STORE | STORE, TORE, SORE, ROSE, ROTE, ROTS, SET, ... |
| 3 | HEART | HEART, EARTH, HATER, HARE, HATE, HEAT, ... |
| 4 | STEAL | STEAL, STALE, LEAST, TALES, ELATE, ... |
| 5 | STONE | STONE, TONES, ONSET, NOTES, TONE, NOTE, ... |
| 6 | RATES | RATES, STARE, TEARS, TARES, RATE, SATE, ... |
| 7 | PAINT | PAINT, PANT, PAIN, PINT, ANTI, PIN, PAN, ... |
| 8 | NOTES | NOTES, TONES, STONE, NOTE, TONE, ONES, ... |
| 9 | DEALT | DEALT, DELTA, DEAL, LEAD, LATE, DALE, ... |
| 10 | SHIRT | SHIRT, HIST, HITS, THIS, HIT, HIS, SIT, ... |
| 11 | PLANT | PLANT, PLANS, PANT, PLAN, SLAT, ANTS, ... |

#### 6-Letter Sets (11 total)
| # | Letters | Example Valid Words |
|---|---------|---|
| 1 | FINALS | FINALS, FAILS, FINAL, FLANS, NAILS, SLAIN, SNAIL, ... |
| 2 | STREAM | STREAM, STEAMS, MASTER, SMEAR, STEAM, TEAMS, ... |
| 3 | STRAND | STRAND, DARTS, RANTS, STAND, SAND, DRAT, RANT, ... |
| 4 | POSTER | POSTER, STORE, PORTS, SPORT, PROSE, PORES, ... |
| 5 | STOLEN | STOLEN, TOLES, NOTES, TONES, STONE, STOLE, ... |
| 6 | MASTER | MASTER, STREAM, TEAMS, MATES, TRAMS, SMART, ... |
| 7 | PRIEST | PRIEST, PRIES, STRIP, TRIPS, TIRES, SPIRE, ... |
| 8 | TRADES | TRADES, TREAD, TRADE, DARTS, DRAT, READS, ... |
| 9 | THREAD | THREAD, TREAD, DREAD, HATRED, HATER, HEART, ... |
| 10 | CHARTS | CHARTS, CHART, CHATS, CARTS, CRASH, TRASH, ... |
| 11 | HEARTS | HEARTS, HEART, HARTS, HATES, HATER, EARTH, ... |

#### Word List Criteria
- **Permissive but reasonable**: Include common 3+ letter English words
- **Exclude obscure**: No technical jargon, archaic terms, or words most people wouldn't know
- **Variety**: Each set chosen to have 15–30+ valid sub-words for replayability

---

## File Structure

### Source Root: `src/`

```
src/
├── index.js                    # Entry point (waits for fonts, starts Phaser)
├── index.html                  # Main game HTML
├── prototype.js                # A-F prototype entry point
├── prototype.html              # A-F prototype HTML
├── dice.js                     # Standalone dice demo entry point
├── dice.html                   # Standalone dice demo HTML
├── config.js                   # Phaser game config (scene list, canvas size, etc.)
│
├── scenes/
│   ├── MainScene.js            # Home screen with 5 dials + start button
│   ├── GameBeamScene.js        # Transition + data routing
│   ├── JuggleScene.js          # ⭐ Word-building game (22 word sets, random selection)
│   ├── GameScene.js            # Gap-fill template (example)
│   ├── MultiChoiceScene.js     # Multiple choice template
│   ├── WheelScene.js           # Spinning wheel game
│   ├── ReorderScene.js         # Sentence reorder
│   ├── CorrectionScene.js      # Error identification
│   ├── ResultsScene.js         # End-of-game summary
│   ├── ScanLineScene.js        # Legacy
│   ├── WordDiceScene.js        # Standalone A-F word-building (prototype)
│   └── Archive/                # Old/unused scenes
│
├── ui/
│   ├── gameScreenLayout.js     # Shared constants: PANEL_CX, MENU_BTN_X/Y/SCALE, POWER_BAR_*
│   ├── RotaryDial.js           # 5-option spinning dial with glitch-in animation
│   ├── StartButton.js          # Flip-switch start button
│   ├── PowerBar.js             # Power meter (used in some game scenes)
│   ├── ScoreDial.js            # Score display (used in some game scenes)
│   ├── ScoreVial.js            # Alternative score display
│   ├── FlipSwitch.js           # Base flip-switch component
│   └── countdown.js            # Timer countdown
│
├── data/
│   └── sentences.js            # Sentence database for non-Juggle game scenes
│
└── assets/
    └── images/
        ├── game/               # Shared game assets
        │   ├── Background UI.png       # Main background
        │   ├── Display*.png            # Display panels (Display, Display2–6, Display4)
        │   ├── Menu.png                # Menu/back button
        │   ├── Start.png               # Start button image
        │   ├── Power*.png              # Power meter assets
        │   ├── Blue Cells*.png         # UI cell graphics
        │   ├── Red Cells.png           # UI cell graphics
        │   ├── Review.png              # Review screen asset
        │   ├── cropped_circle_image.png# Dial image
        │   └── ...
        ├── juggle/             # Letter dice for Juggle mode (A–Z, red & green)
        │   ├── AR.png, AG.png  # A red/green
        │   ├── BR.png, BG.png  # B red/green
        │   ├── ... (A–Z × 2 variants = 52 images)
        │   └── ZR.png, ZG.png  # Z red/green
        ├── dice/               # Letter dice for A-F prototype (old location)
        │   └── ...
        └── Discard/            # Unused/old assets
            └── ...
```

### Output: `public/`

```
public/
├── index.html              # Built main game
├── prototype.html          # Built prototype
├── dice.html               # Built dice demo
├── bundle.js               # Phaser + MainScene bundle (~1.4 MB)
├── prototype.js            # Phaser + WordDiceScene (~1.3 MB)
├── dice.js                 # Phaser + standalone dice (~1.3 MB)
└── assets/                 # Auto-copied by CopyPlugin
    └── images/
        ├── game/
        ├── juggle/
        ├── dice/
        └── Discard/
```

---

## Layout System

### Shared Constants: `src/ui/gameScreenLayout.js`

```javascript
export const PANEL_CX = 870;          // visual centre of Display4 content area
export const POWER_BAR_X = 315;       // power meter X (left side)
export const POWER_BAR_Y = 385;       // power meter Y
export const POWER_BAR_SCALE = 0.90;  // power meter scale
export const MENU_BTN_X = 1390;       // menu button X (top-right)
export const MENU_BTN_Y = 590;        // menu button Y
export const MENU_BTN_SCALE = 0.5;    // menu button scale
```

**PANEL_CX = 870** is the critical constant: the horizontal centre of the game content area. All game elements (dice, input fields, buttons) are centred around this point.

### JuggleScene Layout

```
Canvas: 1024 × 768

Display4 background: scaled to fit

Top-right: Menu button (MENU_BTN_X, MENU_BTN_Y) = (1390, 590)

Dice area:
  ROW_1_Y = 195   ← Top row of dice
  ROW_2_Y = 323   ← Bottom row (or staggered for 5-letter)
  
  5-letter: 3 top + 2 staggered brick
  6-letter: 3×2 aligned grid

Instruction text: y = INPUT_Y - 22 = 403

Input field + Submit button (both at INPUT_Y = 425):
  Input: center at INPUT_CX = 784, width 240, height 40
  Submit: center at SUBMIT_CX = 956, width 160, height 40
  (symmetrically placed around PANEL_CX with 12 px gap)

Feedback text: y = 448 (brief flash, transient)

Words-found box: center at WORDS_BOX_Y = 510
  Size: 672 × 110 px
  Header: "WORDS FOUND X/Y" at top
  Content: 3-stage column layout (4→5→6 columns as words grow)
```

---

## Key Components

### 1. RotaryDial (`src/ui/RotaryDial.js`)

A rotatable dial with `N` options. Used on MainScene for:
- Grammar point (8 options)
- Task type (3 options)
- CEFR level (5 options)
- Rounds (varies by game type)
- Timer (4 options)

**Features:**
- Circular hit zone for accurate clicks
- Rotation animation (rise to peak, hold, fall) on option change
- Glitch-in text transition (alpha flicker with jitter) when option changes
- Scanline overlay (animated scrolling pattern)
- Optional label (baked into background in some cases)

### 2. StartButton (`src/ui/StartButton.js`)

A flip-switch style start button. Fires `onActivate` callback when clicked.

### 3. PowerBar, ScoreDial, CountDown

Various UI components used in different game scenes. Not critical for Juggle.

### 4. MainScene Dials & Compatibility Logic

**Dials:**
- `grammarDial`: 8 options including "Juggle"
- `taskDial`: 3 options (Gap Fill, Multichoice, Wheel)
- `cefrDial`: 5 options (A1–C1)
- `roundsDial`: 3–8 options depending on mode
- `timerDial`: 4 options (Off, Slow, Medium, Fast)

**Compatibility Matrix (MainScene):**
```javascript
const COMPATIBLE = {
  'Present Simple':        new Set(['Gap Fill', 'Multichoice', 'Wheel']),
  'Present Continuous':    new Set(['Gap Fill', 'Wheel']),
  'Past Simple':           new Set(['Gap Fill', 'Wheel']),
  'Past Continuous':       new Set(['Wheel']),
  'Present Perfect Simple': new Set(['Wheel']),
  'Past Perfect Simple':    new Set(['Wheel']),
  'Verb Patterns':         new Set(['Gap Fill', 'Multichoice']),
  'Juggle':                // Special case: task dial disabled, always enabled
};
```

**Rounds by Mode:**
```javascript
const ROUNDS_NORMAL = ['5', '10', '15'];
const ROUNDS_WHEEL = ['5 Rounds', '8 Rounds', '10 Rounds', '8 Mistakes', '5 Mistakes', '3 Mistakes', '2 Mistakes', '1 Mistake'];
const ROUNDS_JUGGLE = ['5 Letters', '6 Letters'];
```

---

## Scene Communication Flow

### MainScene → GameBeamScene → JuggleScene

1. **MainScene.create()**
   - Initializes dials with default or saved selections
   - Calls `_checkCompatibility()` to grey out incompatible options
   - StartButton configured to fire on click

2. **StartButton.onActivate()**
   - Gathers `{ grammar, task, cefr, timer, rounds }`
   - Calls `this.scene.run('GameBeamScene', { targetScene: 'JuggleScene', ... })`

3. **GameBeamScene**
   - Receives all data in `this._sceneData`
   - Plays transition animation (if implemented)
   - Forwards data to target scene:
     ```javascript
     const { targetScene, grammar, task, cefr, rounds, timer } = this._sceneData;
     this.scene.run(targetScene, { grammar, task, cefr, rounds, timer });
     ```

4. **JuggleScene.init(data)**
   - Extracts `data.rounds` ("5 Letters" or "6 Letters")
   - Sets `this._letterCount` (5 or 6)
   - Randomly selects a word set
   - Shuffles letters
   - Stores word list

5. **JuggleScene.create()**
   - Builds die positions via `_buildDiePositions(letters, count)`
   - Creates UI (input, button, box)
   - Attaches keyboard/mouse listeners

6. **Menu Button (JuggleScene)**
   ```javascript
   menuBtn.on('pointerdown', () => {
     this.scene.stop('GameBeamScene');
     this.scene.stop();  // stops JuggleScene
   });
   ```
   - Stops both GameBeamScene and JuggleScene
   - MainScene remains active (was paused, not stopped)
   - MainScene wakes up and re-enables StartButton

---

## Random Word Set Selection & Letter Shuffling

### Selection Logic (JuggleScene.init)

```javascript
init(data) {
  const raw = data.rounds || '6 Letters';
  this._letterCount = raw.startsWith('5') ? 5 : 6;

  // Randomly pick one of 11 word sets for the selected length
  const wordSets = this._letterCount === 5 ? WORD_SET_5 : WORD_SET_6;
  const selectedSet = wordSets[Math.floor(Math.random() * wordSets.length)];

  // Shuffle letters
  this._letters = this._shuffleString(selectedSet.letters);
  this._wordList = selectedSet.words;
}

_shuffleString(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}
```

**Behavior:**
- Same set can appear multiple times (1 in 11 chance each game)
- Each appearance has independent letter shuffle
- Example: "SHINE" might be "ESIHN" on first play, "ENIHS" on second play

---

## Dynamic Die Positioning

### Function: `_buildDiePositions(letters, count)`

**Input:**
- `letters`: shuffled string (e.g., "ESIHN" or "INSFLA")
- `count`: 5 or 6

**Output:**
- Array of `{ letter, x, y }` objects in order of the shuffled string

**5-Letter Layout (Brick Pattern):**
```
Row 1: positions 0, 1, 2 spaced DIE_STEP (128px) apart, centred at PANEL_CX
       x = PANEL_CX - 128 + 0*128,  PANEL_CX + 0*128,  PANEL_CX + 128
Row 2: positions 3, 4 staggered at midpoints
       x = PANEL_CX - 64,  PANEL_CX + 64
       (centred under gaps between top dice)
```

**6-Letter Layout (3×2 Grid):**
```
Row 1: positions 0, 1, 2 at x = PANEL_CX - 128, PANEL_CX, PANEL_CX + 128
Row 2: positions 3, 4, 5 at same x, but y = ROW_2_Y
```

---

## Build & Development

### Build Command
```bash
npm run build
```

**Output:**
- `public/bundle.js` (main game)
- `public/prototype.js` (A-F prototype)
- `public/dice.js` (standalone dice demo)
- `public/assets/` (auto-copied)

**Webpack Config:**
- Entry points: `src/index.js`, `src/prototype.js`, `src/dice.js`
- CopyPlugin copies `src/assets/` → `public/assets/`
- Phaser bundled into each entry point (~1.3 MB each)

### Dev Server (if configured)
```bash
npm run dev
# or check package.json for exact command
```

### Font Loading

**index.js:**
```javascript
document.fonts.load("bold 20px 'Syncopate'")
  .catch(() => {})
  .then(() => {
    new Phaser.Game(config);
  });
```

This ensures the Syncopate web font is fully loaded before Phaser creates canvas text, preventing the "text starts small, then snaps to larger size" glitch.

---

## Game Mechanics Summary

### Juggle Mode Flow

1. Player selects "Juggle" on home screen
2. Chooses 5 or 6 letter mode
3. Game starts with randomly selected + shuffled word set
4. Click dice or press letter keys to build words
5. ENTER to submit, BACKSPACE to undo last letter
6. Valid words earn display in found-words box
7. Play until satisfied, Menu button returns home
8. On next play, may get same set (re-shuffled) or different set

### Word Validation

- **Input**: Player-submitted word (string of 1–6 letters)
- **Check**: Is it in `this._wordList` Set?
- **Valid**: Add to found-words, show green "✓ {WORD}", update box
- **Invalid**: Show red "✗ NOT A WORD", shake camera
- **Duplicate**: Show gold "ALREADY FOUND!", no increment
- **Reset**: All dice return to red, input field clears

### Found-Words Box Stages

| Words | Columns | Font | Line-height | Rows Used |
|---|---|---|---|---|
| 1–20 | 4 | 11px | 13px | ≤5 |
| 21–32 | 5 | 9px | 11px | ≤7 |
| 33–40 | 6 | 8px | 9px | ≤7 |

---

## Known Limitations & Future Enhancements

### Current State
- ✓ Juggle mode fully implemented with 22 word sets
- ✓ Random selection + dynamic shuffling
- ✓ Responsive layout (scales with window)
- ✓ All 26 letters preloaded (supports any set)
- ✓ 3-stage dynamic font sizing

### Possible Enhancements
1. **Sound effects** (valid word beep, invalid buzz, etc.)
2. **Scoring system** (points per word length, bonus for 6-letter words)
3. **Difficulty levels** (restrict to words of certain lengths or frequencies)
4. **Multiplayer** (timed head-to-head, shared board)
5. **Analytics** (track which words are hardest to find)
6. **More word sets** (add 10+ more per length for variety)
7. **Hint system** (reveal a valid word)
8. **Undo stack** (redo after backspace, within reason)

---

## Quick Reference: Key Files to Modify

| Task | File | Key Functions |
|---|---|---|
| Add new word sets | `src/scenes/JuggleScene.js` | `WORD_SET_5`, `WORD_SET_6` |
| Change layout | `src/scenes/JuggleScene.js` | `_buildDiePositions()`, constants |
| Adjust dials | `src/scenes/MainScene.js` | `_checkCompatibility()`, dial options |
| Modify fonts | `src/ui/RotaryDial.js`, `src/index.js` | `TEXT_STYLE`, `document.fonts.load()` |
| Change canvas size | `src/config.js` | `width`, `height` |
| Add new scene | `src/scenes/{NewScene}.js` + `src/config.js` | Scene class, scene array |
| Adjust home screen layout | `src/scenes/MainScene.js` | Dial positions, button position |
| Tweak UI spacing | `src/ui/gameScreenLayout.js` | `PANEL_CX`, `MENU_BTN_*`, `POWER_BAR_*` |

---

## Testing Checklist for Juggle Mode

- [ ] Select "Juggle" on home screen
- [ ] Task dial disables
- [ ] Rounds dial shows "5 Letters" / "6 Letters"
- [ ] Click Start with 5 Letters → loads with brick pattern
- [ ] Click Start with 6 Letters → loads with 3×2 grid
- [ ] Play again (same length) → different set (1/11 chance same, re-shuffled)
- [ ] Letters are randomly shuffled each game (verify visually)
- [ ] Clicking dice highlights them green and appends letter
- [ ] Pressing letter key has same effect
- [ ] BACKSPACE removes last letter and resets die to red
- [ ] Valid word submission → green feedback + word in box
- [ ] Invalid word → red feedback + camera shake
- [ ] Duplicate word → gold feedback, no re-count
- [ ] Found-words box text shrinks when word count crosses stages
- [ ] Found-words count updates ("WORDS FOUND X/Y")
- [ ] Menu button returns to home (StartButton re-enabled, ready for next game)
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in dev tools

---

## Version History

| Date | Changes |
|---|---|
| 2026-04-29 | Implemented 22 word sets with random selection, dynamic shuffling, dynamic positioning. Fixed font loading issue with `document.fonts.load()`. Tightened layout (reduced dice gap 60%, positioned input+submit horizontally, replaced side panel with box below). |
| Earlier | Base Juggle scene with 2 hardcoded word sets (SHINE, FINALS). MainScene dials + compatibility logic. GameBeamScene routing. UI components. Asset folder structure. |

---

## How to Continue Development

1. **Read this file** (ARCHITECTURE.md) to understand the structure
2. **Examine** `src/scenes/JuggleScene.js` (the most complex scene)
3. **Check** `src/scenes/MainScene.js` to understand dial/compatibility logic
4. **Refer to** `src/ui/gameScreenLayout.js` for layout constants
5. **Build and test**: `npm run build`, then open `public/index.html` in browser
6. **Modify** specific scenes or functions as needed (see Quick Reference table above)
7. **For new features**, follow the existing pattern: define constants at top, use shared layout values, attach event listeners in create()

---

## Contact & Notes

This document is current as of **April 29, 2026**. The game is a work in progress. Update this file when adding new scenes, modifying layout, or expanding word sets.

Questions about specific systems? Refer to the corresponding scene file and its inline comments.
