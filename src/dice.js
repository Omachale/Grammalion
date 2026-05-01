import * as Phaser from 'phaser';
import WordDiceScene from './scenes/WordDiceScene';

new Phaser.Game({
  type:            Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  scene:           [WordDiceScene],
  scale: {
    mode:       Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
