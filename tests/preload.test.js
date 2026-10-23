import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';

function loadBridge(invoke = async () => 'saved.jpg') {
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = invoke;
  let bridge;
  vm.runInNewContext(readFileSync(new URL('../app/preload.js', import.meta.url), 'utf8'), {
    require: () => ({
      ipcRenderer,
      contextBridge: {
        exposeInMainWorld: (_name, value) => {
          bridge = value;
        },
      },
    }),
  });
  return { bridge, ipcRenderer };
}

test('subscriptions discard Electron events and remove only their own listeners', () => {
  const { bridge, ipcRenderer } = loadBridge();
  const received = [];
  const unsubscribe = bridge.onCaptureRequest((value) => received.push(value));
  ipcRenderer.emit('capture-request', { privilegedEvent: true });
  assert.deepEqual(received, [undefined]);
  unsubscribe();
  ipcRenderer.emit('capture-request', {});
  assert.equal(received.length, 1);
  assert.equal(ipcRenderer.listenerCount('capture-request'), 0);
});

test('snapshot calls return the IPC promise and propagate failures', async () => {
  const calls = [];
  const { bridge } = loadBridge(async (...args) => {
    calls.push(args);
    if (args[0] === 'store-screen-snapshot') throw new Error('Disk full');
    return 'saved.jpg';
  });
  const bytes = new Uint8Array([1, 2]);
  assert.equal(await bridge.saveCameraSnapshot(bytes), 'saved.jpg');
  assert.deepEqual(calls[0], ['store-camera-snapshot', bytes]);
  await assert.rejects(bridge.saveScreenSnapshot(bytes), /Disk full/);
});
