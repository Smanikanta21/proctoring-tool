import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureScheduler } from '../app/capture-scheduler.js';

test('requests evidence every 15 seconds and stops without leaking timers', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const send = t.mock.fn();
  const scheduler = createCaptureScheduler(send);
  scheduler.start();
  t.mock.timers.tick(14999);
  assert.equal(send.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.deepEqual(send.mock.calls[0].arguments, ['capture-request']);
  scheduler.stop();
  t.mock.timers.tick(30000);
  assert.equal(send.mock.callCount(), 1);
});

test('restarting monitoring replaces the previous capture schedule', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const send = t.mock.fn();
  const scheduler = createCaptureScheduler(send);
  scheduler.start();
  t.mock.timers.tick(10000);
  scheduler.start();
  t.mock.timers.tick(10000);
  assert.equal(send.mock.callCount(), 0);
  t.mock.timers.tick(5000);
  assert.equal(send.mock.callCount(), 1);
  scheduler.stop();
});
