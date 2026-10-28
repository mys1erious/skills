// "Watch": the lesson's five camera shots with captions, then hand back to the reader.
export function createWatch({ stage, ui }) {
  let run = null;

  async function play(scene, content) {
    if (run) return;
    const shots = scene.shots();
    let cancelled = false;
    let wake = () => {};
    run = { cancel() { cancelled = true; wake(); } };
    // holds use real time even in still mode: still mode removes motion, not the pauses
    const hold = (s) => new Promise((r) => { wake = r; setTimeout(r, s * 1000); });
    try {
      for (let i = 0; i < shots.length && !cancelled; i++) {
        ui.caption(content.watch[i], i, shots.length);
        const shot = shots[i];
        const entered = shot.enter?.();
        await Promise.all([stage.flyTo(shot.pose ? shot.pose() : stage.readingPose(), 1.3), entered]);
        if (!cancelled) await hold(i === shots.length - 1 ? 1.4 : 2.6);
      }
    } finally {
      ui.caption(null);
      if (cancelled) await shots.at(-1).enter?.();
      await stage.flyTo(stage.readingPose(), 0.9);
      run = null;
    }
  }

  return { play, cancel: () => run?.cancel(), get playing() { return !!run; } };
}
