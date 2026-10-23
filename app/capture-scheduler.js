export function createCaptureScheduler(send) {
  let interval;
  function stop() {
    clearInterval(interval);
    interval = undefined;
  }
  return {
    start() {
      stop();
      interval = setInterval(() => send('capture-request'), 15000);
    },
    stop,
  };
}
