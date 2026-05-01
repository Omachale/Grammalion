/**
 * startCountdown(scene, callback)
 *
 * Displays a 3 → 2 → 1 countdown centred on screen with a dim overlay.
 * Total duration ≈ 2 seconds (660ms per number).
 * Calls `callback` when the countdown finishes.
 */
export function startCountdown(scene, callback) {
  const W = 1024;
  const H = 768;

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.65);
  overlay.fillRect(0, 0, W, H);

  // Number text — starts invisible and small
  const numText = scene.add.text(W / 2, H / 2, '', {
    fontSize:   '128px',
    color:      '#D4A017',
    fontFamily: 'monospace',
    fontStyle:  'bold',
  }).setOrigin(0.5, 0.5).setAlpha(0).setScale(0.2);

  // Recursive step function: shows n, then calls itself with n-1
  const step = (n) => {
    if (n === 0) {
      overlay.destroy();
      numText.destroy();
      callback();
      return;
    }

    numText.setText(String(n)).setAlpha(1).setScale(0.2);

    // Scale in
    scene.tweens.add({
      targets:  numText,
      scale:    1,
      alpha:    1,
      duration: 180,
      ease:     'Back.easeOut',
      onComplete: () => {
        // Hold, then scale out + fade
        scene.time.delayedCall(320, () => {
          scene.tweens.add({
            targets:  numText,
            scale:    2.2,
            alpha:    0,
            duration: 160,
            ease:     'Cubic.easeIn',
            onComplete: () => step(n - 1),
          });
        });
      },
    });
  };

  step(3);
}
