/**
 * NeonFrame.js — SVG neon-rim overlay for the Multiplayer lobby.
 *
 * Mounts a position:fixed SVG element over the Phaser canvas and traces two
 * concentric neon-blue rounded rectangles once (400 ms), holds the full glow
 * (1 400 ms), then freezes permanently — leaving a blue frame visible while
 * the player is in the lobby.
 *
 * The SVG is removed from the DOM when destroy() is called (e.g. when
 * returning to MainScene or launching a game scene).
 *
 * Coordinate space: 1570 × 868 px (same as Background UI.png).
 * The SVG scales to fit any viewport with the same formula used everywhere
 * else in the game: Math.min(cw / 1570, ch / 868).
 *
 * Usage:
 *   const frame = new NeonFrame();
 *   frame.mount();      // appends SVG to document.body
 *   frame.playOnce();   // starts the trace animation
 *   frame.destroy();    // stops animation + removes SVG
 */

const SVG_NS  = 'http://www.w3.org/2000/svg';
const FRAME_W = 1570;
const FRAME_H = 868;

// ── Calibrated geometry with per-corner cubic Beziers ───────────────────────
// Each corner has independent X and Y extent and tension (0.55 ≈ circular arc)
const state = {
  oL: 263, oR: 1287, oT: 5, oB: 846,
  iIn: 14,
  aTrace: 0.4,
  corners: {
    TL: { x: 140, y: 140, t: 0.55 },
    TR: { x: 140, y: 140, t: 0.55 },
    BR: { x: 168, y: 175, t: 0.55 },
    BL: { x: 170, y: 200, t: 0.55 },
  }
};

// ── Path builders (cubic Bezier per corner) ────────────────────────────────

// Outer ring, counter-clockwise from the bottom-right edge
function outerPathCCW(s) {
  const { oL: L, oR: R, oT: T, oB: B } = s;
  const c = s.corners;
  return [
    `M ${R} ${B - c.BR.y}`,
    `L ${R} ${T + c.TR.y}`,
    `C ${R} ${T + c.TR.y*(1-c.TR.t)}, ${R - c.TR.x*(1-c.TR.t)} ${T}, ${R - c.TR.x} ${T}`,
    `L ${L + c.TL.x} ${T}`,
    `C ${L + c.TL.x*(1-c.TL.t)} ${T}, ${L} ${T + c.TL.y*(1-c.TL.t)}, ${L} ${T + c.TL.y}`,
    `L ${L} ${B - c.BL.y}`,
    `C ${L} ${B - c.BL.y*(1-c.BL.t)}, ${L + c.BL.x*(1-c.BL.t)} ${B}, ${L + c.BL.x} ${B}`,
    `L ${R - c.BR.x} ${B}`,
    `C ${R - c.BR.x*(1-c.BR.t)} ${B}, ${R} ${B - c.BR.y*(1-c.BR.t)}, ${R} ${B - c.BR.y}`,
    `Z`
  ].join(' ');
}

// Inner ring, clockwise from the bottom-right edge.
// Inset by iIn on every side; per-corner X/Y reduced by iIn to stay parallel.
function innerPathCW(s) {
  const iIn = s.iIn;
  const L = s.oL + iIn, R = s.oR - iIn, T = s.oT + iIn, B = s.oB - iIn;
  const c0 = s.corners;
  const c = {
    TL: { x: Math.max(0, c0.TL.x - iIn), y: Math.max(0, c0.TL.y - iIn), t: c0.TL.t },
    TR: { x: Math.max(0, c0.TR.x - iIn), y: Math.max(0, c0.TR.y - iIn), t: c0.TR.t },
    BR: { x: Math.max(0, c0.BR.x - iIn), y: Math.max(0, c0.BR.y - iIn), t: c0.BR.t },
    BL: { x: Math.max(0, c0.BL.x - iIn), y: Math.max(0, c0.BL.y - iIn), t: c0.BL.t },
  };
  return [
    `M ${R} ${B - c.BR.y}`,
    `C ${R} ${B - c.BR.y*(1-c.BR.t)}, ${R - c.BR.x*(1-c.BR.t)} ${B}, ${R - c.BR.x} ${B}`,
    `L ${L + c.BL.x} ${B}`,
    `C ${L + c.BL.x*(1-c.BL.t)} ${B}, ${L} ${B - c.BL.y*(1-c.BL.t)}, ${L} ${B - c.BL.y}`,
    `L ${L} ${T + c.TL.y}`,
    `C ${L} ${T + c.TL.y*(1-c.TL.t)}, ${L + c.TL.x*(1-c.TL.t)} ${T}, ${L + c.TL.x} ${T}`,
    `L ${R - c.TR.x} ${T}`,
    `C ${R - c.TR.x*(1-c.TR.t)} ${T}, ${R} ${T + c.TR.y*(1-c.TR.t)}, ${R} ${T + c.TR.y}`,
    `L ${R} ${B - c.BR.y}`,
    `Z`
  ].join(' ');
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────

export default class NeonFrame {
  constructor() {
    this._overlay        = null;  // wrapper div
    this._svg            = null;  // the <svg> element
    this._nodes          = [];    // [{ el, len, baseOpacity }]
    this._textLayerEls   = [];    // [textEl, textEl, textEl] for glow/mid/core
    this._textBBox       = null;  // measured { x, width, height } after font load
    this._textRevealRect = null;  // clip rect element for text reveal animation
    this._rafId          = null;
    this._frozen         = false;
    this._resizeHandler  = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Append the SVG overlay to document.body (idempotent). */
  mount() {
    if (this._overlay) return;

    // ── Outer wrapper — pointer-events:none so it doesn't block Phaser ────────
    this._overlay = document.createElement('div');
    Object.assign(this._overlay.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100vw',
      height:        '100vh',
      overflow:      'hidden',
      pointerEvents: 'none',
      zIndex:        '50',   // above canvas (0), below lobby form (100)
    });

    // ── SVG element ───────────────────────────────────────────────────────────
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${FRAME_W} ${FRAME_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    Object.assign(svg.style, {
      position:        'absolute',
      top:             '0',
      left:            '0',
      width:           `${FRAME_W}px`,
      height:          `${FRAME_H}px`,
      transformOrigin: '0 0',
      overflow:        'visible',
    });

    // ── SVG defs: two-pass Gaussian glow filter + text reveal clip ─────────────
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <style>
        .nf-neon-text { font-family: 'Syncopate', monospace, sans-serif; font-weight: 700; font-size: 34px;
                        letter-spacing: 0.02em; text-anchor: middle; dominant-baseline: middle; }
        .nf-neon-text.glow { fill: #0a4d96; stroke: #0a4d96; stroke-width: 5; paint-order: stroke; opacity: .9; filter: url(#nf-neonGlow); }
        .nf-neon-text.mid  { fill: #2f7fcc; stroke: #2f7fcc; stroke-width: 1.5; paint-order: stroke; filter: url(#nf-neonGlow); }
        .nf-neon-text.core { fill: #d9ecff; filter: url(#nf-neonGlow); }
      </style>
      <filter id="nf-neonGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6"  result="blur1"/>
        <feGaussianBlur stdDeviation="14" in="SourceGraphic" result="blur2"/>
        <feMerge>
          <feMergeNode in="blur2"/>
          <feMergeNode in="blur1"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <clipPath id="nf-textReveal">
        <rect id="nf-textRevealRect" x="615" y="40" width="0" height="80"/>
      </clipPath>
    `;
    svg.appendChild(defs);

    // Cache the clip rect for animation
    this._textRevealRect = svg.querySelector('#nf-textRevealRect');

    // ── Build the 3-layer ring paths ──────────────────────────────────────────
    // Each ring has glow (blurred wide), mid (main colour), core (bright thin)
    const dOuter = outerPathCCW(state);
    const dInner = innerPathCW(state);

    const ringSpec = [
      //  d       stroke       width   baseOpacity  group
      [dOuter, '#0a4d96', 14,  0.9,  'outer'],  // outer glow
      [dOuter, '#2f7fcc',  6,  1.0,  'outer'],  // outer mid
      [dOuter, '#b6d8f5',  2.2, 1.0, 'outer'],  // outer core
      [dInner, '#0a4d96', 11,  0.9,  'inner'],  // inner glow
      [dInner, '#2f7fcc',  5,  1.0,  'inner'],  // inner mid
      [dInner, '#b6d8f5',  1.8, 1.0, 'inner'],  // inner core
    ];

    const outerGroup = document.createElementNS(SVG_NS, 'g');
    outerGroup.setAttribute('filter', 'url(#nf-neonGlow)');
    const innerGroup = document.createElementNS(SVG_NS, 'g');
    innerGroup.setAttribute('filter', 'url(#nf-neonGlow)');

    this._nodes = [];
    for (const [d, color, sw, baseOpacity, group] of ringSpec) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill',              'none');
      path.setAttribute('stroke',            color);
      path.setAttribute('stroke-width',      String(sw));
      path.setAttribute('stroke-linecap',    'round');
      path.setAttribute('stroke-linejoin',   'round');
      path.style.opacity = String(baseOpacity);
      (group === 'outer' ? outerGroup : innerGroup).appendChild(path);
      this._nodes.push({ el: path, baseOpacity });
    }

    svg.appendChild(outerGroup);
    svg.appendChild(innerGroup);

    // ── Title text (3-layer neon) with left-to-right reveal ───────────────────
    const textGroup = document.createElementNS(SVG_NS, 'g');
    textGroup.setAttribute('clip-path', 'url(#nf-textReveal)');

    // Three-layer neon text: glow → mid → core
    const textLayers = [
      { className: 'glow', text: 'MULTIPLAYER' },
      { className: 'mid',  text: 'MULTIPLAYER' },
      { className: 'core', text: 'MULTIPLAYER' },
    ];

    this._textLayerEls = [];
    for (const { className, text } of textLayers) {
      const textEl = document.createElementNS(SVG_NS, 'text');
      textEl.setAttribute('x', '785');  // ~centre of frame (1570 / 2)
      textEl.setAttribute('y', '70');   // top area, below top edge
      textEl.setAttribute('class', `nf-neon-text ${className}`);
      textEl.textContent = text;
      textGroup.appendChild(textEl);
      this._textLayerEls.push(textEl);
    }

    svg.appendChild(textGroup);
    this._overlay.appendChild(svg);
    document.body.appendChild(this._overlay);
    this._svg = svg;

    // ── Cache path lengths for dasharray (requires DOM insertion first) ────────
    for (const node of this._nodes) {
      const len = node.el.getTotalLength();
      node.len = len;
      node.el.style.strokeDasharray  = String(len);
      node.el.style.strokeDashoffset = String(len);  // fully hidden
    }

    // ── Measure text bbox for clip animation ──────────────────────────────────
    // Wait for fonts to load, then measure the actual text width
    if (this._textLayerEls.length > 0) {
      document.fonts.ready.then(() => {
        const coreText = this._textLayerEls[2];  // Use core layer for measurement
        try {
          const bbox = coreText.getBBox();
          this._textBBox = { x: bbox.x, width: bbox.width, height: bbox.height };
          // Expand clip rect height to cover all text layers
          if (this._textRevealRect) {
            this._textRevealRect.setAttribute('height', String(bbox.height + 20));
          }
        } catch (e) {
          // getBBox may fail if font rendering is deferred; use fallback
          this._textBBox = { x: 615, width: 340, height: 40 };
        }
      });
    } else {
      this._textBBox = null;
    }

    // ── Scale to fit viewport ─────────────────────────────────────────────────
    this._fit();
    this._resizeHandler = () => this._fit();
    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * Run the trace animation once:
   *   400 ms  — paths draw in with easeInOutCubic
   *   1 400 ms — hold at full opacity
   *   then freeze (never fade, never loop)
   *
   * Safe to call multiple times; ignored if already running or frozen.
   */
  playOnce() {
    if (!this._overlay || this._frozen || this._rafId !== null) return;

    const TRACE_MS = 400;
    const HOLD_MS  = 1400;

    let startTs = null;

    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const t = ts - startTs;

      if (t < TRACE_MS) {
        // Trace phase
        const progress = easeInOutCubic(t / TRACE_MS);
        for (const { el, len, baseOpacity } of this._nodes) {
          el.style.strokeDashoffset = String(len * (1 - progress));
          el.style.opacity          = String(baseOpacity);
        }
        // Animate text reveal: left-to-right during trace
        if (this._textRevealRect && this._textBBox) {
          const revealWidth = this._textBBox.width * progress;
          this._textRevealRect.setAttribute('width', String(revealWidth));
        }
        this._rafId = requestAnimationFrame(step);

      } else if (t < TRACE_MS + HOLD_MS) {
        // Hold phase — ensure fully drawn each tick (avoids float rounding)
        for (const { el, baseOpacity } of this._nodes) {
          el.style.strokeDashoffset = '0';
          el.style.opacity          = String(baseOpacity);
        }
        // Keep text fully revealed during hold
        if (this._textRevealRect && this._textBBox) {
          this._textRevealRect.setAttribute('width', String(this._textBBox.width));
        }
        this._rafId = requestAnimationFrame(step);

      } else {
        // Freeze — fully drawn, stop the loop
        for (const { el, baseOpacity } of this._nodes) {
          el.style.strokeDashoffset = '0';
          el.style.opacity          = String(baseOpacity);
        }
        // Keep text fully revealed in frozen state
        if (this._textRevealRect && this._textBBox) {
          this._textRevealRect.setAttribute('width', String(this._textBBox.width));
        }
        this._rafId  = null;
        this._frozen = true;
      }
    };

    this._rafId = requestAnimationFrame(step);
  }

  /** Stop animation and remove the SVG from the DOM. */
  destroy() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay        = null;
    this._svg            = null;
    this._nodes          = [];
    this._textLayerEls   = [];
    this._textBBox       = null;
    this._textRevealRect = null;
    this._frozen         = false;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _fit() {
    if (!this._svg) return;
    const scale = Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H);
    const xOff  = (window.innerWidth  - FRAME_W * scale) / 2;
    const yOff  = (window.innerHeight - FRAME_H * scale) / 2;
    this._svg.style.transform = `translate(${xOff}px, ${yOff}px) scale(${scale})`;
  }
}
