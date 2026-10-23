// Keep native presentation restrictions scoped to the lifetime of an exam.
export function createExamWindowLock(getWindow) {
  let previous;

  function release() {
    if (!previous) return;
    const { window, kiosk, minimizable, movable } = previous;
    previous = null;
    if (window.isDestroyed()) return;
    window.setKiosk(kiosk);
    window.setMinimizable(minimizable);
    window.setMovable(movable);
  }

  return {
    enter() {
      const window = getWindow();
      if (!window || window.isDestroyed()) throw new Error('Exam window is unavailable.');
      if (previous?.window === window) return;
      release();
      previous = {
        window,
        kiosk: window.isKiosk(),
        minimizable: window.isMinimizable(),
        movable: window.isMovable(),
      };
      try {
        window.setKiosk(true);
        window.setMinimizable(false);
        window.setMovable(false);
      } catch (error) {
        release();
        throw error;
      }
    },
    release,
  };
}
