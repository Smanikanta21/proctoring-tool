const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const createApp = require('../app');
const createStore = require('../store');

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-exam-test-'));
  fs.copyFileSync(
    path.join(__dirname, '../data/questions.json'),
    path.join(directory, 'questions.json'),
  );
  const store = createStore(directory);
  const server = createApp(store).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    directory,
    store,
    async request(route, body) {
      const response = await fetch(
        `${base}${route}`,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      );
      return { status: response.status, data: await response.json() };
    },
  };
}

test('exam flow persists scores, hides answer keys, and rejects duplicate or late answers', async (t) => {
  const { request, store } = await fixture(t);
  const { data: questions } = await request('/exam/mcq');
  assert.equal(questions.length, 5);
  assert.ok(questions.every((question) => !('correctAnswer' in question)));
  const { data: singleQuestion } = await request('/exam/mcq/1');
  assert.deepEqual(singleQuestion, questions[0]);
  const {
    status,
    data: { sessionId },
  } = await request('/exam/start', { userId: '  student-1 ', name: ' Ada ', acknowledged: true });
  assert.equal(status, 201);
  assert.equal(store.readSessions()[0].name, 'Ada');

  const correct = await request('/exam/answer', { sessionId, questionId: 1, selectedAnswer: 1 });
  assert.deepEqual(correct.data, {
    message: 'Answer saved',
    questionId: 1,
    selectedAnswer: 1,
    attempted: 1,
  });
  const duplicate = await request('/exam/answer', { sessionId, questionId: 1, selectedAnswer: 0 });
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.data.message, /already saved/);
  await request('/exam/answer', { sessionId, questionId: 2, selectedAnswer: 1 });
  const submitted = await request('/exam/submit', { sessionId });
  assert.deepEqual(submitted.data.result, { attempted: 2, correct: 1, wrong: 1 });
  const originalSubmission = store.readSessions()[0].submittedAt;
  assert.deepEqual(
    (await request('/exam/submit', { sessionId })).data.result,
    submitted.data.result,
  );
  assert.equal(store.readSessions()[0].submittedAt, originalSubmission);
  assert.equal(
    (await request('/exam/answer', { sessionId, questionId: 3, selectedAnswer: 1 })).status,
    409,
  );
  const progress = await request(`/exam/session/${sessionId}`);
  assert.equal(progress.data.status, 'submitted');
  assert.equal(progress.data.answers.length, 2);
});

test('invalid requests cannot alter scores or create invalid sessions', async (t) => {
  const { request, store } = await fixture(t);
  for (const body of [
    {},
    { userId: ' ', name: 'Ada', acknowledged: true },
    { userId: {}, name: 'Ada', acknowledged: true },
  ]) {
    assert.equal((await request('/exam/start', body)).status, 400);
  }
  const {
    data: { sessionId },
  } = await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true });
  for (const selectedAnswer of [null, '', ' ', true, {}, [], -1, 4, 0.5, 'invalid']) {
    assert.equal(
      (await request('/exam/answer', { sessionId, questionId: 1, selectedAnswer })).status,
      400,
    );
  }
  assert.equal((await request('/exam/answer', { sessionId })).status, 400);
  assert.equal((await request('/exam/mcq/999')).status, 404);
  assert.equal((await request('/exam/session/missing')).status, 404);
  assert.equal((await request('/exam/submit', {})).status, 400);
  assert.equal(store.readSessions()[0].attempted, 0);
});

test('fresh stores initialize sessions and simultaneous starts receive unique IDs', async (t) => {
  const { request, store } = await fixture(t);
  assert.deepEqual(store.readSessions(), []);
  const sessions = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      request('/exam/start', { userId: `student-${index}`, name: 'Student', acknowledged: true }),
    ),
  );
  assert.equal(new Set(sessions.map(({ data }) => data.sessionId)).size, 10);
  assert.equal(store.readSessions().length, 10);
});

test('corrupt storage is reported without overwriting existing data', async (t) => {
  const { request, directory } = await fixture(t);
  t.mock.method(console, 'error', () => {});
  const file = path.join(directory, 'sessions.json');
  fs.writeFileSync(file, 'corrupt data');
  assert.equal(
    (await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true })).status,
    500,
  );
  assert.equal(fs.readFileSync(file, 'utf8'), 'corrupt data');
});

test('requires monitoring acknowledgement and publishes the exam policy', async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request('/exam/start', { userId: 'student', name: 'Ada' })).status, 400);
  const { data } = await request('/exam/config');
  assert.equal(data.policy, 'warn-and-continue');
  assert.equal(data.captureIntervalSeconds, 15);
  assert.equal(data.questionCount, 5);
  assert.ok(data.durationSeconds > 0);
});

test('retries are idempotent and answers do not reveal correctness before submission', async (t) => {
  const { request, store } = await fixture(t);
  const {
    data: { sessionId, session },
  } = await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true });
  assert.ok(Date.parse(session.expiresAt) > Date.parse(session.startedAt));
  const payload = { sessionId, questionId: 1, selectedAnswer: 1 };
  const first = await request('/exam/answer', payload);
  assert.deepEqual(await request('/exam/answer', payload), first);
  const progress = (await request(`/exam/session/${sessionId}`)).data;
  assert.equal(progress.answers.length, 1);
  assert.equal(progress.answers[0].isCorrect, undefined);
  assert.equal(progress.result, undefined);
  assert.equal(progress.correct, undefined);
  assert.equal(store.readSessions()[0].correct, 1);
});

test('records and deduplicates events without stopping the exam or changing its score', async (t) => {
  const { request, store } = await fixture(t);
  const {
    data: { sessionId },
  } = await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true });
  const events = [
    { id: 'event-one', type: 'focus-lost', occurredAt: new Date().toISOString() },
    { id: 'event-two', type: 'fullscreen-exited', occurredAt: new Date().toISOString() },
  ];
  assert.equal((await request('/exam/events', { sessionId, events })).status, 200);
  assert.equal((await request('/exam/events', { sessionId, events })).data.eventCount, 2);
  const progress = (await request(`/exam/session/${sessionId}`)).data;
  assert.equal(progress.status, 'in-progress');
  assert.equal(progress.reviewCount, 2);
  assert.equal(store.readSessions()[0].correct, 0);
  assert.equal(
    (await request('/exam/answer', { sessionId, questionId: 1, selectedAnswer: 1 })).status,
    200,
  );
  assert.equal((await request('/exam/submit', { sessionId })).data.result.correct, 1);
});

test('validates monitoring events before persisting the batch', async (t) => {
  const { request, store } = await fixture(t);
  const {
    data: { sessionId },
  } = await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true });
  for (const events of [
    null,
    [null],
    [{ id: 'x', type: 'unknown', occurredAt: new Date().toISOString() }],
    [{ id: 'x', type: 'focus-lost', occurredAt: 'bad-date' }],
  ]) {
    assert.equal((await request('/exam/events', { sessionId, events })).status, 400);
  }
  assert.equal(store.readSessions()[0].events.length, 0);
});

test('the server expires sessions, rejects late answers, and accepts delayed audit delivery', async (t) => {
  const { request, store } = await fixture(t);
  const {
    data: { sessionId },
  } = await request('/exam/start', { userId: 'student', name: 'Ada', acknowledged: true });
  await request('/exam/answer', { sessionId, questionId: 1, selectedAnswer: 1 });
  const sessions = store.readSessions();
  sessions[0].expiresAt = new Date(Date.now() - 1000).toISOString();
  store.saveSessions(sessions);
  const late = await request('/exam/answer', { sessionId, questionId: 2, selectedAnswer: 0 });
  assert.equal(late.status, 409);
  assert.equal(late.data.session.submissionReason, 'time-expired');
  assert.deepEqual(late.data.session.result, { attempted: 1, correct: 1, wrong: 0 });
  const completed = (await request(`/exam/session/${sessionId}`)).data;
  assert.equal(completed.status, 'submitted');
  assert.deepEqual(
    (await request('/exam/submit', { sessionId })).data.session.result,
    completed.result,
  );
  assert.equal(
    (
      await request('/exam/events', {
        sessionId,
        events: [
          { id: 'late-delivery', type: 'connection-lost', occurredAt: sessions[0].startedAt },
        ],
      })
    ).status,
    200,
  );
});
