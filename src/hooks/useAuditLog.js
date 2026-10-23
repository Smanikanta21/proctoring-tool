import { useCallback, useEffect, useRef, useState } from 'react';
import { sendEvents } from '../api';
import { readStorage, writeStorage } from '../lib/storage';

export default function useAuditLog(sessionId, serverEvents = []) {
  const [localEvents, setLocalEvents] = useState([]);
  const [pendingState, setPending] = useState({ key: '', count: 0 });
  const [storageError, setStorageError] = useState(false);
  const flushing = useRef(null);
  const queues = useRef(new Map());
  const key = `athena.events.${sessionId}`;

  const getQueue = useCallback(() => {
    if (!queues.current.has(key)) queues.current.set(key, readStorage(key, []));
    return queues.current.get(key);
  }, [key]);

  const flush = useCallback(async () => {
    if (!sessionId) return;
    if (flushing.current) return flushing.current;
    const task = (async () => {
      const queue = getQueue();
      setPending({ key, count: queue.length });
      while (queue.length) {
        const { accepted } = await sendEvents(sessionId, queue.slice(0, 50));
        const ids = new Set(accepted);
        for (let index = queue.length - 1; index >= 0; index -= 1) {
          if (ids.has(queue[index].id)) queue.splice(index, 1);
        }
        if (!writeStorage(key, queue.length ? queue : null)) setStorageError(true);
        setPending({ key, count: queue.length });
      }
    })();
    flushing.current = task;
    try {
      await task;
    } finally {
      flushing.current = null;
    }
  }, [key, sessionId, getQueue]);

  const record = useCallback(
    (type, nativeEvent) => {
      if (!sessionId) return;
      const event = nativeEvent || {
        id: crypto.randomUUID(),
        type,
        occurredAt: new Date().toISOString(),
      };
      const queue = getQueue();
      if (queue.some(({ id }) => id === event.id)) return;
      queue.push(event);
      if (!writeStorage(key, queue)) setStorageError(true);
      setPending({ key, count: queue.length });
      setLocalEvents((previous) => [...previous, { ...event, sessionId }]);
      void flush().catch(() => {}); // Keep failed events in memory and on disk for retry.
    },
    [sessionId, key, flush, getQueue],
  );

  useEffect(() => {
    const retry = () => {
      void flush().catch(() => {});
    };
    const interval = setInterval(retry, 5000);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', retry);
    };
  }, [flush]);

  const events = [
    ...new Map(
      [...serverEvents, ...localEvents.filter((event) => event.sessionId === sessionId)].map(
        (event) => [event.id, event],
      ),
    ).values(),
  ].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  return {
    events,
    pending: pendingState.key === key ? pendingState.count : 0,
    storageError,
    record,
    flush,
  };
}
