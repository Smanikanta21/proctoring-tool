const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('athena', {
  onCaptureRequest: (callback) => subscribe('capture-request', callback),
  onProctorEvent: (callback) => subscribe('proctor-event', callback),
  startMonitoring: (sessionId) => ipcRenderer.invoke('start-monitoring', sessionId),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  requestExit: () => ipcRenderer.invoke('request-exit'),
  saveCameraSnapshot: (data) => ipcRenderer.invoke('store-camera-snapshot', data),
  saveScreenSnapshot: (data) => ipcRenderer.invoke('store-screen-snapshot', data),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  selectDesktopSource: (sourceId) => ipcRenderer.invoke('select-desktop-source', sourceId),
});
