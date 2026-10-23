import { useEffect, useEffectEvent, useRef, useState } from 'react';
import useMediaStream from './useMediaStream';
import { captureFrame } from '../lib/capture-frame';

export default function useProctoring({ active, sessionId, connected, onEvent }) {
  const camera = useMediaStream();
  const screen = useMediaStream();
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState('');
  const [sources, setSources] = useState(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const sourceRequest = useRef(0);
  const [selectedSource, setSelectedSource] = useState(null);
  const [lastCapture, setLastCapture] = useState(null);
  const previousChecks = useRef(null);
  const capturing = useRef(false);
  const bridge = window.athena;

  async function run(action) {
    setError('');
    try {
      return await action();
    } catch (error) {
      setError(error.message);
      return false;
    }
  }

  const recordChanges = useEffectEvent(() => {
    const checks = {
      camera: camera.enabled,
      screen: screen.enabled,
      fullscreen,
      connection: connected,
    };
    const previous = previousChecks.current;
    if (!active) {
      previousChecks.current = null;
      return;
    }
    if (previous) {
      for (const [key, value] of Object.entries(checks)) {
        if (previous[key] !== value)
          onEvent(`${key}-${value ? 'restored' : key === 'fullscreen' ? 'exited' : 'lost'}`);
      }
    } else onEvent('monitoring-started');
    previousChecks.current = checks;
  });
  useEffect(() => {
    recordChanges();
  }, [active, camera.enabled, screen.enabled, fullscreen, connected]);

  const capture = useEffectEvent(async () => {
    if (!active || capturing.current) return;
    capturing.current = true;
    try {
      const captures = [];
      if (camera.enabled)
        captures.push(
          captureFrame(camera.videoRef.current, 'image/jpeg').then(bridge.saveCameraSnapshot),
        );
      if (screen.enabled)
        captures.push(
          captureFrame(screen.videoRef.current, 'image/png').then(bridge.saveScreenSnapshot),
        );
      if (captures.length) {
        await Promise.all(captures);
        setLastCapture({ sessionId, time: new Date().toISOString() });
        setError('');
      }
    } catch (error) {
      setError(`Snapshot issue: ${error.message}`);
      onEvent('capture-failed');
    } finally {
      capturing.current = false;
    }
  });

  const receiveEvent = useEffectEvent((event) => {
    if (!active) return;
    if (event.type === 'focus-lost') setFocused(false);
    if (event.type === 'focus-restored') setFocused(true);
    onEvent(event.type, event);
  });
  const blockClipboard = useEffectEvent((event) => {
    if (!active) return;
    event.preventDefault();
    onEvent('clipboard-blocked');
  });
  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    const clipboard = (event) => blockClipboard(event);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    for (const type of ['copy', 'cut', 'paste']) document.addEventListener(type, clipboard);
    const unsubscribeCapture = bridge?.onCaptureRequest(() => {
      void capture();
    });
    const unsubscribeEvents = bridge?.onProctorEvent((event) => receiveEvent(event));
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      for (const type of ['copy', 'cut', 'paste']) document.removeEventListener(type, clipboard);
      unsubscribeCapture?.();
      unsubscribeEvents?.();
    };
  }, [bridge]);

  const stopStreams = useEffectEvent(() => {
    camera.stop();
    screen.stop();
    closeSources();
  });
  const monitoringError = useEffectEvent((error) => {
    setError(error.message);
    onEvent('capture-failed');
  });
  useEffect(() => {
    if (!active || !bridge) return;
    void bridge.startMonitoring(sessionId).catch(monitoringError);
    return () => {
      stopStreams();
      void bridge.stopMonitoring().catch(console.error);
    };
  }, [active, sessionId, bridge]);

  function shareScreen(source) {
    return run(async () => {
      const started = await screen.start(async () => {
        // Selection is prepared by the picker. Keep this call in the click's user activation.
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: false,
        });
        if (
          stream.getVideoTracks()[0]?.getSettings().displaySurface === 'window' ||
          stream.getVideoTracks()[0]?.getSettings().displaySurface === 'browser'
        ) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('Choose an entire screen so monitoring can cover your assessment.');
        }
        return stream;
      });
      if (started) {
        setSelectedSource(source);
        setSources(null);
      }
      return started;
    });
  }

  async function loadSources() {
    const request = ++sourceRequest.current;
    setSources([]);
    setSourcesLoading(true);
    await run(async () => {
      await bridge.selectDesktopSource(null);
      const sources = await bridge.getDesktopSources();
      if (request !== sourceRequest.current) return;
      if (!sources.length)
        throw new Error(
          'No screens are available. Allow screen recording in system settings and try again.',
        );
      setSources(sources);
    });
    if (request === sourceRequest.current) setSourcesLoading(false);
  }

  function closeSources() {
    ++sourceRequest.current;
    setSources(null);
    setSourcesLoading(false);
    void bridge.selectDesktopSource(null).catch(console.error);
  }

  return {
    camera,
    screen,
    fullscreen,
    focused,
    error,
    sources,
    sourcesLoading,
    selectedSource,
    lastCapture: lastCapture?.sessionId === sessionId ? lastCapture.time : null,
    available: Boolean(bridge),
    ready: Boolean(bridge) && camera.enabled && screen.enabled && fullscreen,
    enableCamera: () =>
      run(() =>
        camera.start(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false })),
      ),
    enableFullscreen: () => run(() => document.documentElement.requestFullscreen()),
    shareScreen,
    loadSources,
    closeSources,
    prepareScreen: (source) =>
      run(async () => {
        await bridge.selectDesktopSource(source.id);
        return true;
      }),
    requestExit: () => run(() => bridge.requestExit()),
  };
}
