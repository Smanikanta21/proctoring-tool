import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExamWindowLock } from '../app/exam-window.js';

function createWindow(initial = {}) {
  const state = { kiosk: false, minimizable: true, movable: true, destroyed: false, ...initial };
  const window = { isDestroyed: () => state.destroyed };
  for (const key of ['kiosk', 'minimizable', 'movable']) {
    const method = key[0].toUpperCase() + key.slice(1);
    window[`is${method}`] = () => state[key];
    window[`set${method}`] = (value) => {
      state[key] = value;
    };
  }
  return { window, state };
}

test('exam lock restricts the native window and restores its original settings exactly once', () => {
  const { window, state } = createWindow({ movable: false });
  const lock = createExamWindowLock(() => window);
  lock.enter();
  lock.enter();
  assert.deepEqual(state, { kiosk: true, minimizable: false, movable: false, destroyed: false });
  lock.release();
  lock.release();
  assert.deepEqual(state, { kiosk: false, minimizable: true, movable: false, destroyed: false });
  lock.enter();
  lock.release();
  assert.equal(state.kiosk, false);
});

test('a failed restriction restores the window and can be retried', () => {
  const { window, state } = createWindow();
  const lock = createExamWindowLock(() => window);
  const setMovable = window.setMovable;
  window.setMovable = (value) => {
    if (!value) throw new Error('Unavailable');
    setMovable(value);
  };
  assert.throws(() => lock.enter(), /Unavailable/);
  assert.equal(state.kiosk, false);
  assert.equal(state.minimizable, true);
  window.setMovable = setMovable;
  lock.enter();
  assert.equal(state.kiosk, true);
  lock.release();
});

test('lock handles a destroyed window and a replacement window', () => {
  let current = createWindow();
  const lock = createExamWindowLock(() => current.window);
  lock.enter();
  current.state.destroyed = true;
  assert.throws(() => lock.enter(), /unavailable/);
  lock.release();
  current = createWindow();
  lock.enter();
  assert.equal(current.state.kiosk, true);
  lock.release();
  assert.equal(current.state.kiosk, false);
});
