import * as Phaser from 'phaser';
import BeamScene from './scenes/BeamScene';

document.fonts.ready.then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#000000',
    scene: [BeamScene],
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
});
