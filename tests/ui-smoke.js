import { app, BrowserWindow, desktopCapturer, nativeImage } from 'electron';
import { registerExamIpc } from '../app/ipc.js';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const createApp = require('../backend/app');
const createStore = require('../backend/store');
const directory = mkdtempSync(path.join(tmpdir(), 'athena-ui-test-'));
const artifacts = path.join(tmpdir(), 'athena-ui-review');
mkdirSync(artifacts, { recursive: true });
app.setPath('userData', directory);
const questions = JSON.parse(
  readFileSync(path.resolve('backend/data/questions.json'), 'utf8'),
).slice(0, 2);
writeFileSync(path.join(directory, 'questions.json'), JSON.stringify(questions));
const store = createStore(directory);
let window;
let server;
let monitoring;
let exitRequests = 0;
let kiosk = false;
const kioskTransitions = [];
const evaluate = (expression) => window.webContents.executeJavaScript(expression);
const click = (label) =>
  evaluate(
    `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`,
  );
const selectDisplay = () =>
  evaluate('document.querySelector(\'[aria-label="Select Test display"]\').click()');
const confirmShare = async () => {
  await waitFor(
    "Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Share entire screen' && !button.disabled)",
  );
  await click('Share entire screen');
};
const choose = (index) => evaluate(`document.querySelectorAll('.option-btn')[${index}].click()`);
const evidence = async (name) =>
  writeFileSync(
    path.join(artifacts, `${name}.png`),
    (await window.webContents.capturePage()).toPNG(),
  );

async function waitFor(expression) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`UI condition timed out: ${expression}`);
}

async function installMediaMocks() {
  await evaluate(`
    window.testState = { fullscreen: null, stoppedTracks: 0, offline: false, failSubmission: true, answerCalls: 0 };
    const fakeStream = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 200;
      const context = canvas.getContext('2d');
      context.fillStyle = '#dde6df'; context.fillRect(0, 0, 320, 200);
      context.fillStyle = '#95a99c'; context.beginPath(); context.arc(160, 80, 30, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.ellipse(160, 170, 65, 50, 0, 0, Math.PI * 2); context.fill();
      const stream = canvas.captureStream(10);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => { window.testState.stoppedTracks += 1; stop(); };
      return stream;
    };
    navigator.mediaDevices.getUserMedia = fakeStream;
    navigator.mediaDevices.getDisplayMedia = async () => {
      if (window.testState.denyScreen) throw new DOMException('Screen sharing was denied', 'NotAllowedError');
      const stream = await fakeStream();
      const track = stream.getVideoTracks()[0];
      track.getSettings = () => ({ displaySurface: window.testState.surface || 'monitor' });
      window.testState.screenTrack = track;
      return stream;
    };
    Object.defineProperty(document, 'fullscreenElement', { get: () => window.testState.fullscreen });
    document.documentElement.requestFullscreen = async () => {
      window.testState.fullscreen = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    const realFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (window.testState.offline) throw new TypeError('Simulated connection outage');
      if (String(url).endsWith('/exam/answer')) window.testState.answerCalls += 1;
      if (String(url).endsWith('/exam/submit') && window.testState.failSubmission) {
        window.testState.failSubmission = false;
        return new Response(JSON.stringify({ message: 'Temporary submission failure' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      return realFetch(url, options);
    };
    undefined;
  `);
}

async function run() {
  try {
    await app.whenReady();
    server = createApp(store).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    desktopCapturer.getSources = async () => [
      { id: 'screen:test', name: 'Test display', thumbnail: nativeImage.createEmpty() },
      { id: 'screen:external', name: 'External display', thumbnail: nativeImage.createEmpty() },
    ];
    monitoring = registerExamIpc(() => window, {
      onExit: () => {
        exitRequests += 1;
      },
    });
    window = new BrowserWindow({
      show: false,
      width: 1380,
      height: 1000,
      webPreferences: { preload: path.resolve('app/preload.js'), backgroundThrottling: false },
    });
    // Exercise the real lifecycle without placing the developer's desktop into kiosk mode.
    window.isKiosk = () => kiosk;
    window.setKiosk = (value) => {
      kiosk = value;
      kioskTransitions.push(value);
    };
    window.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://localhost:3005/*'] },
      (details, callback) => callback({ redirectURL: `${base}${new URL(details.url).pathname}` }),
    );
    await window.loadFile(path.resolve('dist/index.html'));
    await waitFor("document.querySelector('.brief-meta')?.textContent.includes('2 questions')");
    await evidence('01-setup');
    await installMediaMocks();
    assert.equal(
      await evaluate(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Continue to assessment').disabled",
      ),
      true,
    );
    await click('Enable camera');
    await waitFor("document.querySelector('.camera-preview video').readyState >= 2");
    await click('Enter full screen');
    await waitFor("document.querySelector('.readiness-ring').textContent.trim() === '3/4'");
    await click('Share screen');
    await waitFor("document.querySelector('.screen-source-item')");
    await selectDisplay();
    await waitFor("document.querySelector('.screen-source-item[aria-pressed=true]')");
    assert.equal(
      await evaluate("document.querySelector('.readiness-ring').textContent.trim()"),
      '3/4',
    );
    await evidence('01a-entire-screen-picker');
    await click('Cancel');
    assert.equal(
      await evaluate("document.querySelector('.readiness-ring').textContent.trim()"),
      '3/4',
    );
    await click('Share screen');
    await waitFor("document.querySelector('.screen-source-item')");
    await selectDisplay();
    await evaluate('window.testState.denyScreen = true');
    await confirmShare();
    await waitFor("document.querySelector('dialog .danger')?.textContent.includes('denied')");
    assert.equal(
      await evaluate("document.querySelector('.readiness-ring').textContent.trim()"),
      '3/4',
    );
    await evaluate("window.testState.denyScreen = false; window.testState.surface = 'window'");
    await selectDisplay();
    await confirmShare();
    await waitFor(
      "document.querySelector('dialog .danger')?.textContent.includes('entire screen')",
    );
    assert.equal(
      await evaluate("document.querySelector('.readiness-ring').textContent.trim()"),
      '3/4',
    );
    await evaluate("window.testState.surface = 'monitor'");
    await selectDisplay();
    await confirmShare();
    await waitFor("document.querySelector('.screen-preview video').readyState >= 2");
    await waitFor("document.querySelector('.readiness-ring').textContent.trim() === '4/4'");
    assert.equal(await evaluate("document.querySelectorAll('.check-ready').length"), 4);
    assert.ok(
      await evaluate(
        "document.querySelector('.checklist').textContent.includes('Test display is shared')",
      ),
    );
    await evidence('01b-setup-ready');
    await evaluate(
      "window.testState.screenTrack.stop(); window.testState.screenTrack.dispatchEvent(new Event('ended'))",
    );
    await waitFor("document.querySelector('.readiness-ring').textContent.trim() === '3/4'");
    await click('Share screen');
    await waitFor("document.querySelector('.screen-source-item')");
    await selectDisplay();
    await confirmShare();
    await waitFor("document.querySelector('.readiness-ring').textContent.trim() === '4/4'");
    await click('Continue to assessment');
    await waitFor("document.querySelector('dialog[open]')");
    await evaluate(`
      document.querySelectorAll('input:not([type=checkbox])').forEach((input, index) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, index ? 'test-student' : 'Alex Morgan');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.querySelector('input[type=checkbox]').click();
    `);
    await click('Start assessment');
    await waitFor("document.querySelector('.question-text')");
    assert.equal(monitoring.isActive(), true);
    assert.equal(kiosk, true);
    await click('Leave exam');
    await evaluate('window.athena.getDesktopSources()');
    assert.equal(exitRequests, 1);
    assert.equal(kiosk, true, 'Requesting exit does not release restrictions before confirmation');
    assert.ok(
      await evaluate(
        "document.querySelector('.exam-clock strong').textContent.startsWith('19:') || document.querySelector('.exam-clock strong').textContent === '20:00'",
      ),
    );
    window.webContents.send('capture-request');
    const evidenceDirectory = path.join(directory, 'captures', store.readSessions()[0].sessionId);
    const captureDeadline = Date.now() + 5000;
    let capturedFiles = [];
    while (capturedFiles.length < 2 && Date.now() < captureDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      try {
        capturedFiles = readdirSync(evidenceDirectory).filter((name) => /\.(jpg|png)$/.test(name));
      } catch {
        /* Capture is still writing. */
      }
    }
    assert.equal(capturedFiles.length, 2, 'Camera AND screen evidence persisted');
    await waitFor("document.querySelector('.sync-note')?.textContent.includes('Last capture')");
    assert.ok(capturedFiles.some((name) => name.startsWith('camera-')));
    assert.ok(capturedFiles.some((name) => name.startsWith('screen-')));
    assert.ok(
      readFileSync(path.join(evidenceDirectory, 'audit.jsonl'), 'utf8').includes('snapshot'),
    );
    await evidence('02-assessment');

    // Warnings are observable and logged, while answer controls remain usable.
    await evaluate(
      "window.testState.fullscreen = null; document.dispatchEvent(new Event('fullscreenchange'))",
    );
    await waitFor("document.querySelector('.monitoring-warning')");
    assert.equal(await evaluate("document.querySelector('.option-btn').disabled"), false);
    await choose(1);
    await choose(0);
    await click('Save & next');
    await waitFor(
      "document.querySelector('.question-text')?.textContent.includes('Which Electron API')",
    );
    assert.equal(store.readSessions()[0].answers[0].selectedAnswer, 0);
    await choose(0);
    await click('Mark for review');
    await evidence('03-warning');
    await evaluate('window.testState.offline = true');
    monitoring.report('focus-lost');
    await waitFor("document.querySelector('.sync-note')?.textContent.includes('waiting to sync')");
    assert.equal(await evaluate("document.querySelector('.option-btn').disabled"), false);
    await evaluate("window.testState.offline = false; window.dispatchEvent(new Event('online'))");
    await waitFor("document.querySelector('.sync-note')?.textContent.includes('Activity synced')");
    assert.ok(store.readSessions()[0].events.some(({ type }) => type === 'focus-lost'));

    // A page reload must recover the deadline, saved answers, draft selection, and review mark.
    const originalExpiry = store.readSessions()[0].expiresAt;
    monitoring.stop();
    assert.equal(kiosk, false, 'Reload releases native restrictions');
    await window.loadFile(path.resolve('dist/index.html'));
    await waitFor(
      "document.querySelector('.question-text')?.textContent.includes('Which Electron API')",
    );
    await installMediaMocks();
    assert.equal(store.readSessions().length, 1);
    assert.equal(store.readSessions()[0].expiresAt, originalExpiry);
    assert.equal(
      await evaluate("document.querySelectorAll('.option-btn')[0].getAttribute('aria-pressed')"),
      'true',
    );
    assert.ok(await evaluate("document.querySelector('.question-number.marked')" + ' !== null'));
    assert.equal(await evaluate("document.querySelector('.option-btn').disabled"), false);
    await click('Reconnect camera');
    await click('Restore screen sharing');
    await waitFor("document.querySelector('.screen-source-item')");
    await selectDisplay();
    await confirmShare();
    await waitFor("!document.querySelector('dialog[open]')");
    await click('Restore full screen');
    await waitFor("document.querySelector('.camera-preview video').readyState >= 2");
    await click('Submit exam');
    await waitFor("document.querySelector('dialog[open]')");
    await click('Submit assessment');
    await waitFor(
      "document.querySelector('dialog .danger')?.textContent === 'Temporary submission failure'",
    );
    assert.equal(store.readSessions()[0].answers.length, 2);
    await click('Submit assessment');
    await waitFor("document.querySelector('.result h1')");
    assert.equal(
      await evaluate('window.testState.answerCalls'),
      1,
      'Retry does not resubmit a saved answer',
    );
    assert.equal(await evaluate('window.testState.stoppedTracks'), 2);
    assert.equal(monitoring.isActive(), false);
    assert.equal(kiosk, false);
    assert.deepEqual(kioskTransitions, [true, false, true, false]);
    assert.equal(store.readSessions()[0].status, 'submitted');
    assert.equal(store.readSessions()[0].correct, 1);
    await evidence('04-result');
    window.setSize(980, 850);
    await evidence('05-compact-result');
    console.log(
      `UI smoke passed: real API, native IPC, setup, both evidence files, warn-and-continue, offline event retry, reload recovery, draft recovery, submission retry, and cleanup. Screenshots: ${artifacts}`,
    );
    window.destroy();
    server.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (window && !window.isDestroyed()) await evidence('failure').catch(() => {});
    window?.destroy();
    server?.close();
    app.exit(1);
  }
}
setTimeout(() => {
  console.error('Electron UI test exceeded 90 seconds');
  app.exit(1);
}, 90000);
void run();
