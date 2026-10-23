const configuredMinutes = Number(process.env.EXAM_DURATION_MINUTES || 20);
const durationSeconds =
  (Number.isFinite(configuredMinutes) && configuredMinutes > 0 ? configuredMinutes : 20) * 60;

const EVENT_TYPES = new Set([
  'monitoring-started',
  'session-resumed',
  'focus-lost',
  'focus-restored',
  'fullscreen-exited',
  'fullscreen-restored',
  'camera-lost',
  'camera-restored',
  'screen-lost',
  'screen-restored',
  'connection-lost',
  'connection-restored',
  'clipboard-blocked',
  'shortcut-blocked',
  'exit-attempted',
  'capture-failed',
]);
const REVIEW_TYPES = new Set([
  'focus-lost',
  'fullscreen-exited',
  'camera-lost',
  'screen-lost',
  'clipboard-blocked',
  'shortcut-blocked',
  'exit-attempted',
]);

function finishSession(session, reason = 'student-submitted') {
  if (session.status === 'submitted') return;
  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();
  session.submissionReason = reason;
}

function studentSession(session) {
  const { sessionId, userId, name, startedAt, expiresAt, submittedAt, status, submissionReason } =
    session;
  const events = session.events || [];
  return {
    sessionId,
    userId,
    name,
    startedAt,
    expiresAt,
    submittedAt,
    status,
    submissionReason,
    serverNow: new Date().toISOString(),
    answers: session.answers.map(({ questionId, selectedAnswer }) => ({
      questionId,
      selectedAnswer,
    })),
    events,
    reviewCount: events.filter(({ type }) => REVIEW_TYPES.has(type)).length,
    ...(status === 'submitted' && {
      result: { attempted: session.attempted, correct: session.correct, wrong: session.wrong },
    }),
  };
}

module.exports = { durationSeconds, EVENT_TYPES, REVIEW_TYPES, finishSession, studentSession };
