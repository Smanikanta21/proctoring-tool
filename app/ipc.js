import { app, desktopCapturer, dialog, ipcMain, session } from 'electron';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCaptureScheduler } from './capture-scheduler.js';
import { createExamWindowLock } from './exam-window.js';
import { createScreenSelection } from './screen-selection.js';

export function showRules(window) {
  return dialog.showMessageBox(window, {
    type: 'info',
    title: 'Assessment guidelines',
    message: 'A fair assessment starts here.',
    detail:
      'Keep your camera, entire-screen sharing, and full screen enabled. Camera and screen snapshots are stored on this device every 15 seconds. Leaving the exam or attempting restricted shortcuts is recorded for review. Warnings do not stop the exam or change your score. The exam clock continues during interruptions. Saved answers are final.',
  });
}

export function registerExamIpc(getWindow, { onExit } = {}) {
  const captureDirectory = path.join(app.getPath('userData'), 'captures');
  let activeSessionId = null;
  const windowLock = createExamWindowLock(getWindow);
  const selection = createScreenSelection(() => desktopCapturer.getSources({ types: ['screen'] }));
  const send = (channel, value) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, value);
  };
  const scheduler = createCaptureScheduler(send);

  async function appendAudit(sessionId, entry) {
    const directory = path.join(captureDirectory, sessionId);
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, 'audit.jsonl'), `${JSON.stringify(entry)}\n`);
  }

  async function saveSnapshot(data, kind) {
    if (!activeSessionId) throw new Error('Monitoring is not active.');
    const sessionId = activeSessionId;
    const capturedAt = new Date().toISOString();
    const name = `${kind}-${Date.now()}-${randomUUID()}.${kind === 'camera' ? 'jpg' : 'png'}`;
    const directory = path.join(captureDirectory, sessionId);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), Buffer.from(data));
    await appendAudit(sessionId, { type: 'snapshot', kind, name, capturedAt });
    return { kind, capturedAt };
  }

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const source = await selection.consume();
      callback(source ? { video: source } : {});
    } catch (error) {
      console.error('Failed to load screen sources:', error);
      callback({});
    }
  });

  function stop() {
    scheduler.stop();
    activeSessionId = null;
    void selection.select(null);
    windowLock.release();
  }
  ipcMain.handle('start-monitoring', (_event, sessionId) => {
    if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(sessionId))
      throw new Error('Invalid session.');
    windowLock.enter();
    activeSessionId = sessionId;
    scheduler.start();
  });
  ipcMain.handle('stop-monitoring', stop);
  ipcMain.handle('request-exit', () => onExit?.());
  ipcMain.handle('store-camera-snapshot', (_event, data) => saveSnapshot(data, 'camera'));
  ipcMain.handle('store-screen-snapshot', (_event, data) => saveSnapshot(data, 'screen'));
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map(({ id, name, thumbnail }) => ({
      id,
      name,
      thumbnail: thumbnail.isEmpty() ? null : thumbnail.toDataURL(),
    }));
  });
  ipcMain.handle('select-desktop-source', (_event, sourceId) => selection.select(sourceId));
  return {
    stop,
    isActive: () => Boolean(activeSessionId),
    report(type) {
      if (!activeSessionId) return;
      const event = { id: randomUUID(), type, occurredAt: new Date().toISOString() };
      send('proctor-event', event);
      void appendAudit(activeSessionId, event).catch((error) =>
        console.error('Could not persist monitoring event:', error),
      );
    },
  };
}
