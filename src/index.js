import * as Phaser from 'phaser';
import config from './config';

// document.fonts.ready resolves too early with font-display:swap — the queue
// drains before the font is actually usable by the canvas 2D API.
// document.fonts.load() waits for the specific variant Phaser renders with,
// so canvas text uses Syncopate from frame 1 rather than snapping on first
// interaction.  The .catch() keeps the game starting even if the CDN fails.
document.fonts.load("bold 20px 'Syncopate'")
  .catch(() => {})
  .then(() => {
    new Phaser.Game(config);
  });
