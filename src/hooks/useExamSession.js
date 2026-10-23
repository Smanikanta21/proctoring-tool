import { useCallback, useEffect, useRef, useState } from 'react';
import { getExamConfig, getSession, startExam, submitExam } from '../api';
import { readStorage, writeStorage } from '../lib/storage';

const ACTIVE_SESSION = 'athena.active-session';

export default function useExamSession() {
  const [sessionId, setSessionId] = useState(() => readStorage(ACTIVE_SESSION));
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missingSession, setMissingSession] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [clockOffset, setClockOffset] = useState(0);
  const refreshInFlight = useRef(false);
  const generation = useRef(0);

  const acceptSession = useCallback((value) => {
    setSession((previous) =>
      previous?.sessionId === value.sessionId &&
      previous.status === 'submitted' &&
      value.status !== 'submitted'
        ? previous
        : value,
    );
    setNow(Date.now());
    setClockOffset(Date.parse(value.serverNow) - Date.now());
    if (value.status === 'submitted') writeStorage(ACTIVE_SESSION, null);
  }, []);

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const currentGeneration = generation.current;
    return Promise.all([getExamConfig(), sessionId ? getSession(sessionId) : Promise.resolve(null)])
      .then(([config, session]) => {
        if (generation.current !== currentGeneration) return;
        setConfig(config);
        if (session) acceptSession(session);
        setConnected(true);
        setMissingSession(false);
        setError('');
      })
      .catch((error) => {
        if (generation.current !== currentGeneration) return;
        setConnected(false);
        setMissingSession(error.status === 404);
        setError(error.message);
      })
      .finally(() => {
        setLoading(false);
        refreshInFlight.current = false;
      });
  }, [sessionId, acceptSession]);

  useEffect(() => {
    void refresh();
    const polling = setInterval(refresh, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(polling);
      clearInterval(clock);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  async function begin(userId, name) {
    const response = await startExam(userId, name);
    generation.current += 1;
    writeStorage(ACTIVE_SESSION, response.sessionId);
    setSessionId(response.sessionId);
    acceptSession(response.session);
  }

  async function finish() {
    const response = await submitExam(sessionId);
    generation.current += 1;
    acceptSession(response.session);
  }

  function reset() {
    generation.current += 1;
    writeStorage(ACTIVE_SESSION, null);
    setSessionId(null);
    setSession(null);
    setMissingSession(false);
  }

  const duration = session
    ? Math.ceil((Date.parse(session.expiresAt) - Date.parse(session.startedAt)) / 1000)
    : 0;
  const remaining = session
    ? Math.min(
        duration,
        Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now - clockOffset) / 1000)),
      )
    : 0;
  return {
    session,
    sessionId,
    config,
    connected,
    loading,
    error,
    missingSession,
    remaining,
    begin,
    finish,
    refresh,
    reset,
    acceptSession,
  };
}
