# Athena exam API

Run `npm install` and `npm run dev` (Node's file watcher) or `npm start`. Defaults: port **3005**, duration **20 minutes**. Override these with `PORT` and `EXAM_DURATION_MINUTES` environment variables.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /` | Service health |
| `GET /exam/config` | Assessment title, question count, duration, capture interval, warning policy |
| `POST /exam/start` | Start a session with `{ userId, name, acknowledged: true }` |
| `GET /exam/mcq` | Questions without answer keys |
| `GET /exam/mcq/:id` | One question without its answer key |
| `GET /exam/session/:sessionId` | Saved selections, deadline, events, and completion state |
| `POST /exam/answer` | Save `{ sessionId, questionId, selectedAnswer }` |
| `POST /exam/events` | Persist `{ sessionId, events }` batches |
| `POST /exam/submit` | Finish `{ sessionId }` and return results |

`POST /exam/start` returns `{ sessionId, session }`. Session IDs are opaque. `session` contains `startedAt`, `expiresAt`, and `serverNow` so the UI can align its timer with the server.

`selectedAnswer` must be a numeric option index. The first successful save is final. Repeating the same answer succeeds without increasing scores; trying to change it returns 409. In-progress responses never include correctness or score totals. Results are returned only after submission.

Deadlines are checked when loading the session for any session request. Expired sessions are finalized with `submissionReason: "time-expired"`; later answers return 409 with the completed session. Repeated submission returns the original result and submission time.

## Monitoring events

```json
{
  "sessionId": "session-...",
  "events": [
    {
      "id": "unique-event-id",
      "type": "fullscreen-exited",
      "occurredAt": "2026-10-23T10:00:00.000Z"
    }
  ]
}
```

Batches contain at most 50 events. Event IDs deduplicate retries; the server adds `receivedAt`. Allowed event types are defined in `exam-policy.js`. Queued events can arrive after an exam is submitted. Signals are review information and never change scores or end a session. Event timestamps are client observations; receiving a signal is not proof of misconduct.

## Storage and tests

The first saved session creates `data/sessions.json`. Writes use atomic replacement. Corrupt existing storage returns a server error without overwriting data. Run a single backend process with this file store.

`npm test` runs tests against temporary files and local HTTP servers. It covers validation, acknowledgement, grading, answer secrecy, retries, event deduplication, deadline enforcement, and corrupt-file handling.
