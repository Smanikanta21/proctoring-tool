import { app, BrowserWindow, dialog, Menu } from 'electron';
import path from 'node:path';
import { registerExamIpc, showRules } from './ipc.js';

let examWindow;
let monitoring;
let exitPrompt = false;

async function confirmExit() {
  if (exitPrompt) return;
  if (!monitoring.isActive()) return app.quit();
  exitPrompt = true;
  monitoring.report('exit-attempted');
  try {
    const { response } = await dialog.showMessageBox(examWindow, {
      type: 'question',
      title: 'Leave your assessment?',
      message: 'Your exam is still in progress.',
      detail:
        'Saved answers are safe. The timer keeps running while you are away; you can reopen this app to resume.',
      buttons: ['Stay in exam', 'Leave application'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 1) {
      monitoring.stop();
      app.quit();
    }
  } finally {
    exitPrompt = false;
  }
}

function createWindow() {
  examWindow = new BrowserWindow({
    height: 940,
    width: 1380,
    minWidth: 900,
    minHeight: 680,
    title: 'Athena · Assessment workspace',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  if (app.isPackaged) examWindow.loadFile(path.join(import.meta.dirname, '../dist/index.html'));
  else examWindow.loadURL('http://localhost:5173');

  examWindow.webContents.on('before-input-event', (event, input) => {
    if (!monitoring.isActive() || input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const modified = input.control || input.meta;
    if (
      (modified && ['x', 'v', 'p', 'r', 'u'].includes(key)) ||
      (modified && input.shift && ['i', 'j', 'c'].includes(key)) ||
      (modified && ['tab', 'h', 'm'].includes(key)) ||
      (input.alt && ['tab', 'escape'].includes(key)) ||
      (input.control && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) ||
      (modified && input.control && key === 'f') ||
      ['f5', 'f12'].includes(key)
    ) {
      event.preventDefault();
      monitoring.report(['x', 'v'].includes(key) ? 'clipboard-blocked' : 'shortcut-blocked');
    }
  });
  examWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  examWindow.webContents.on('will-navigate', (event) => {
    if (monitoring.isActive()) {
      event.preventDefault();
      monitoring.report('shortcut-blocked');
    }
  });
  examWindow.webContents.on('did-start-loading', () => monitoring.stop());
  examWindow.webContents.on('render-process-gone', () => monitoring.stop());
  examWindow.on('blur', () => monitoring.report('focus-lost'));
  examWindow.on('focus', () => monitoring.report('focus-restored'));
  examWindow.on('close', (event) => {
    if (monitoring.isActive()) {
      event.preventDefault();
      void confirmExit();
    }
  });
  examWindow.on('closed', () => {
    monitoring.stop();
    examWindow = null;
  });
}

app.whenReady().then(() => {
  monitoring = registerExamIpc(() => examWindow, { onExit: confirmExit });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin'
        ? [{ label: 'Athena', submenu: [{ role: 'about' }, { role: 'quit' }] }]
        : []),
      { label: 'File', submenu: [{ label: 'Exit', click: () => app.quit() }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }] },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle full screen',
            click: () => {
              if (monitoring.isActive()) monitoring.report('shortcut-blocked');
              else examWindow?.setFullScreen(!examWindow.isFullScreen());
            },
          },
        ],
      },
      {
        label: 'Help',
        submenu: [{ label: 'Assessment guidelines', click: () => showRules(examWindow) }],
      },
    ]),
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('before-quit', (event) => {
  if (monitoring?.isActive()) {
    event.preventDefault();
    void confirmExit();
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
