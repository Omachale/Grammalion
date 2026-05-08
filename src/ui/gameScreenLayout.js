/**
 * Shared layout constants for all game scenes.
 * All game scenes import these values to maintain consistent UI positioning.
 *
 * PANEL_CX  — horizontal centre of the Display4 content panel (x = 312 + 750/2 = 687).
 *             Use this whenever you need to centre anything on the game screen.
 * Design resolution: 1374 × 768 (= Display4 native size). Phaser Scale.FIT
 * CSS-scales the canvas to any window while keeping these coordinates correct.
 */

export const PANEL_CX = 687;   // visual centre of the Display4 content area (= 1374/2)

export const POWER_BAR_X     = 397;   // 132 + (590 * 0.90 / 2) — centre at old right edge
export const POWER_BAR_Y     = 385;
export const POWER_BAR_SCALE = 0.90;

export const MENU_BTN_X     = 1222;   // 1207 + 15
export const MENU_BTN_Y     = 590;
export const MENU_BTN_SCALE = 0.5;
