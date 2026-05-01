import * as Phaser from 'phaser';
import MainScene         from './scenes/MainScene';
import GameBeamScene     from './scenes/GameBeamScene';
import GameScene         from './scenes/GameScene';
import MultiChoiceScene  from './scenes/MultiChoiceScene';
import ResultsScene      from './scenes/ResultsScene';
import CorrectionScene   from './scenes/CorrectionScene';
import ReorderScene      from './scenes/ReorderScene';
import WheelScene        from './scenes/WheelScene';
import ScanLineScene     from './scenes/ScanLineScene';
import JuggleScene       from './scenes/JuggleScene';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#1a1a2e',
  scene: [MainScene, GameBeamScene, GameScene, MultiChoiceScene, ResultsScene, CorrectionScene, ReorderScene, WheelScene, ScanLineScene, JuggleScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

export default config;
