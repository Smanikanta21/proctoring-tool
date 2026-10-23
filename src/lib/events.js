export const EVENT_LABELS = {
  'monitoring-started': 'Monitoring started',
  'session-resumed': 'Session resumed',
  'focus-lost': 'Exam window left',
  'focus-restored': 'Returned to exam',
  'fullscreen-exited': 'Full screen exited',
  'fullscreen-restored': 'Full screen restored',
  'camera-lost': 'Camera interrupted',
  'camera-restored': 'Camera restored',
  'screen-lost': 'Screen sharing interrupted',
  'screen-restored': 'Screen sharing restored',
  'connection-lost': 'Connection interrupted',
  'connection-restored': 'Connection restored',
  'clipboard-blocked': 'Clipboard action blocked',
  'shortcut-blocked': 'Restricted shortcut blocked',
  'exit-attempted': 'Application exit attempted',
  'capture-failed': 'Snapshot could not be saved',
};
export const REVIEW_TYPES = new Set([
  'focus-lost',
  'fullscreen-exited',
  'camera-lost',
  'screen-lost',
  'clipboard-blocked',
  'shortcut-blocked',
  'exit-attempted',
]);
export const formatTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
