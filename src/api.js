const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3005').replace(/\/$/, '');

async function request(path, { body, signal } = {}) {
  const timeout = AbortSignal.timeout(10000);
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Cannot reach the exam service. Check your connection and retry.', {
      cause: error,
    });
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.session = data.session;
    throw error;
  }
  return data;
}

export const getExamConfig = (signal) => request('/exam/config', { signal });
export const startExam = (userId, name) =>
  request('/exam/start', { body: { userId, name, acknowledged: true } });
export const getQuestions = (signal) => request('/exam/mcq', { signal });
export const getSession = (sessionId, signal) =>
  request(`/exam/session/${encodeURIComponent(sessionId)}`, { signal });
export const submitAnswer = (sessionId, questionId, selectedAnswer) =>
  request('/exam/answer', { body: { sessionId, questionId, selectedAnswer } });
export const submitExam = (sessionId) => request('/exam/submit', { body: { sessionId } });
export const sendEvents = (sessionId, events) =>
  request('/exam/events', { body: { sessionId, events } });
