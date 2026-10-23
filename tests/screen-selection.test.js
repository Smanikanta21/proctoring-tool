import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreenSelection } from '../app/screen-selection.js';

test('capture requires explicit selection and consumes it once', async () => {
  const screens = [{ id: 'screen:1' }, { id: 'screen:2' }];
  const selection = createScreenSelection(async () => screens);
  assert.equal(await selection.consume(), undefined);
  await selection.select('screen:2');
  assert.equal(await selection.consume(), screens[1]);
  assert.equal(await selection.consume(), undefined);
});

test('invalid, cancelled, or disconnected displays never fall back to another screen', async () => {
  let screens = [{ id: 'screen:1' }, { id: 'screen:2' }];
  const selection = createScreenSelection(async () => screens);
  await selection.select('screen:1');
  await assert.rejects(selection.select('window:1'), /no longer available/);
  assert.equal(await selection.consume(), undefined);
  await assert.rejects(selection.select(undefined), /Select an entire screen/);
  await selection.select('screen:1');
  await selection.select(null);
  assert.equal(await selection.consume(), undefined);
  await selection.select('screen:2');
  screens = [screens[0]];
  assert.equal(await selection.consume(), undefined);
});

test('cancelling a pending native selection prevents it from becoming usable later', async () => {
  let resolve;
  const selection = createScreenSelection(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = selection.select('screen:1');
  await selection.select(null);
  resolve([{ id: 'screen:1' }]);
  await pending;
  assert.equal(await selection.consume(), undefined);
});
