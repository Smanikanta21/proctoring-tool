import { useEffect, useRef, useState } from 'react';

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function useMediaStream() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestId = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(
    () => () => {
      requestId.current += 1;
      stopTracks(streamRef.current);
    },
    [],
  );

  async function start(capture) {
    const id = ++requestId.current;
    setPending(true);
    let stream;
    try {
      stream = await capture();
      // Permission dialogs can finish after the user has left this screen.
      if (id !== requestId.current) {
        stopTracks(stream);
        return false;
      }
      stopTracks(streamRef.current);
      streamRef.current = stream;
      setEnabled(false);
      const video = videoRef.current;
      const track = stream.getVideoTracks()[0];
      if (!video || !track || track.readyState !== 'live')
        throw new Error('No live video feed is available. Please reconnect.');
      video.srcObject = stream;
      let playing = false;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener(
          'ended',
          () => {
            if (streamRef.current === stream) stop();
          },
          { once: true },
        );
        track.addEventListener('mute', () => {
          if (streamRef.current === stream) setEnabled(false);
        });
        track.addEventListener('unmute', () => {
          if (streamRef.current === stream && playing) setEnabled(true);
        });
      });
      // A selection or permission grant alone does not mean frames are arriving.
      await video.play();
      if (id !== requestId.current) {
        stopTracks(stream);
        return false;
      }
      playing = true;
      if (track.readyState !== 'live' || track.muted || video.readyState < 2)
        throw new Error('The video feed has not started. Please reconnect.');
      setEnabled(true);
      return true;
    } catch (error) {
      if (streamRef.current === stream && stream) {
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setEnabled(false);
      }
      stopTracks(stream);
      if (id === requestId.current) throw error;
      return false;
    } finally {
      if (id === requestId.current) setPending(false);
    }
  }

  function stop() {
    requestId.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
    setPending(false);
  }

  return { videoRef, enabled, pending, start, stop };
}
