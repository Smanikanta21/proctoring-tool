const express = require('express');
const cors = require('cors');
const { randomUUID } = require('node:crypto');
const createStore = require('./store');
const { durationSeconds, EVENT_TYPES, finishSession, studentSession } = require('./exam-policy');

const questionForStudent = ({ id, question, options }) => ({ id, question, options });

module.exports = function createApp(store = createStore()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '128kb' }));
  app.get('/', (_req, res) => res.json({ message: 'Exam backend is running' }));
  app.get('/exam/config', (_req, res) =>
    res.json({
      title: 'Electron fundamentals',
      subject: 'Software development',
      durationSeconds,
      questionCount: store.readQuestions().length,
      captureIntervalSeconds: 15,
      policy: 'warn-and-continue',
      serverNow: new Date().toISOString(),
    }),
  );

  app.post('/exam/start', (req, res) => {
    const { userId, name, acknowledged } = req.body || {};
    if (typeof userId !== 'string' || !userId.trim() || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Student ID and name are required.' });
    }
    if (userId.length > 100 || name.length > 100)
      return res.status(400).json({ message: 'Use 100 characters or fewer.' });
    if (acknowledged !== true)
      return res
        .status(400)
        .json({ message: 'Please acknowledge the monitoring rules before starting.' });
    const sessions = store.readSessions();
    const now = Date.now();
    const session = {
      sessionId: `session-${randomUUID()}`,
      userId: userId.trim(),
      name: name.trim(),
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + durationSeconds * 1000).toISOString(),
      acknowledgedAt: new Date(now).toISOString(),
      submittedAt: null,
      status: 'in-progress',
      attempted: 0,
      correct: 0,
      wrong: 0,
      answers: [],
      events: [],
    };
    sessions.push(session);
    store.saveSessions(sessions);
    res.status(201).json({ sessionId: session.sessionId, session: studentSession(session) });
  });

  app.get('/exam/mcq', (_req, res) => res.json(store.readQuestions().map(questionForStudent)));
  app.get('/exam/mcq/:id', (req, res) => {
    const question = store.readQuestions().find(({ id }) => id === Number(req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json(questionForStudent(question));
  });

  function loadSession(req, res, next) {
    const sessionId = req.params.sessionId || req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });
    const sessions = store.readSessions();
    const session = sessions.find((item) => item.sessionId === sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    // Sessions made before deadlines were introduced receive the same time allowance.
    session.expiresAt ||= new Date(
      Date.parse(session.startedAt) + durationSeconds * 1000,
    ).toISOString();
    if (session.status !== 'submitted' && Date.now() >= Date.parse(session.expiresAt)) {
      finishSession(session, 'time-expired');
      store.saveSessions(sessions);
    }
    res.locals.sessions = sessions;
    res.locals.session = session;
    next();
  }

  app.get('/exam/session/:sessionId', loadSession, (_req, res) =>
    res.json(studentSession(res.locals.session)),
  );

  app.post('/exam/answer', loadSession, (req, res) => {
    const { questionId, selectedAnswer } = req.body;
    const { session, sessions } = res.locals;
    if (session.status !== 'in-progress')
      return res
        .status(409)
        .json({ message: 'This exam has ended.', session: studentSession(session) });
    const question = store.readQuestions().find(({ id }) => id === Number(questionId));
    if (!question) return res.status(400).json({ message: 'Choose a valid question.' });
    if (
      !Number.isInteger(selectedAnswer) ||
      selectedAnswer < 0 ||
      selectedAnswer >= question.options.length
    ) {
      return res.status(400).json({ message: 'Choose a valid answer option.' });
    }
    const existing = session.answers.find((answer) => answer.questionId === question.id);
    if (existing && existing.selectedAnswer !== selectedAnswer) {
      return res
        .status(409)
        .json({ message: 'This answer is already saved and cannot be changed.' });
    }
    // Retrying after a lost response must not score the same answer twice.
    if (!existing) {
      const isCorrect = selectedAnswer === question.correctAnswer;
      session.answers.push({
        questionId: question.id,
        selectedAnswer,
        isCorrect,
        answeredAt: new Date().toISOString(),
      });
      session.attempted += 1;
      session[isCorrect ? 'correct' : 'wrong'] += 1;
      store.saveSessions(sessions);
    }
    res.json({
      message: 'Answer saved',
      questionId: question.id,
      selectedAnswer,
      attempted: session.attempted,
    });
  });

  app.post('/exam/events', loadSession, (req, res) => {
    const { events } = req.body;
    if (
      !Array.isArray(events) ||
      events.length > 50 ||
      events.some(
        (event) =>
          !event ||
          typeof event.id !== 'string' ||
          event.id.length > 100 ||
          !event.id ||
          !EVENT_TYPES.has(event.type) ||
          !Number.isFinite(Date.parse(event.occurredAt)),
      )
    ) {
      return res.status(400).json({ message: 'Invalid monitoring events.' });
    }
    const { session, sessions } = res.locals;
    session.events ||= [];
    const knownIds = new Set(session.events.map(({ id }) => id));
    for (const event of events) {
      if (knownIds.has(event.id)) continue;
      session.events.push({
        id: event.id,
        type: event.type,
        occurredAt: new Date(event.occurredAt).toISOString(),
        receivedAt: new Date().toISOString(),
      });
      knownIds.add(event.id);
    }
    store.saveSessions(sessions);
    res.json({ accepted: events.map(({ id }) => id), eventCount: session.events.length });
  });

  app.post('/exam/submit', loadSession, (_req, res) => {
    const { session, sessions } = res.locals;
    if (session.status !== 'submitted') {
      finishSession(session);
      store.saveSessions(sessions);
    }
    const view = studentSession(session);
    res.json({ message: 'Exam submitted successfully', result: view.result, session: view });
  });

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ message: 'Invalid JSON body' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ message: 'Request is too large' });
    console.error('Exam request failed:', error);
    res.status(500).json({ message: 'The exam service is unavailable. Please retry.' });
  });
  return app;
};
