# Athena assessments

An Electron proctoring workspace with a React assessment UI and an Express API. The UI includes a readiness checklist, live media previews, a question navigator, drafts, review marks, monitoring activity, and a downloadable result summary.

## Run

Use Node.js 22.12+ or 24+.

```sh
npm ci
npm --prefix backend ci
```

Start these in separate terminals:

```sh
npm --prefix backend run dev
npm run dev
npm run electron
```

The API defaults to `http://localhost:3005` and Vite to `http://localhost:5173`. The browser can preview the UI; starting an exam requires Electron. If your terminal inherits `ELECTRON_RUN_AS_NODE=1`, clear it when launching: `env -u ELECTRON_RUN_AS_NODE npm run electron`.

Set `VITE_API_URL` in `.env.local` for a different API URL. Set `PORT` and `EXAM_DURATION_MINUTES` in the backend's environment to override port 3005 and the 20-minute time limit. Restart the relevant process after changing environment variables. See [.env.example](.env.example).

## Assessment behavior

- Camera, entire-screen sharing, full screen, and a working API connection are required before starting. Students explicitly acknowledge monitoring when entering their details.
- The screen picker lists full displays. Selecting a display prepares it; **Share entire screen** starts capture. The sharing tick and setup count update only after live video starts, and clear when sharing ends. Denied requests and disconnected displays cannot complete the check or silently capture another screen.
- Active exams use Electron kiosk mode and disable moving/minimizing the window. On macOS, kiosk mode requests native restrictions on process switching, hiding the application, the Dock, and the menu bar. The visible **Leave exam** action prompts before exiting. Submission, confirmed exit, reload, and renderer failure release the exam window restrictions.
- During the exam, interruptions **warn and log while allowing the student to continue**. Flags never change the score or terminate an exam.
- Focus loss, full-screen exit, camera/screen interruption, clipboard actions, restricted shortcuts, and exit attempts are recorded. Connection changes and capture failures are system events.
- The backend owns the deadline. The timer keeps running through interruptions and reloads. Once the deadline passes, the backend finalizes saved answers on the next session request and rejects late answers.
- Choices are saved locally as drafts. `Save & next` commits an answer to the server; committed answers are final. Submission first saves any remaining selected drafts. Identical answer retries and submission retries are idempotent.
- Reopening the app recovers the active session, deadline, saved answers, local choices, review marks, and question position. Devices need to be reconnected.
- Monitoring events queue locally during outages and retry on reconnect. Camera and screen streams and the capture scheduler stop when the session completes.

## Evidence and storage

The Electron main process stores camera JPEGs and screen PNGs every 15 seconds during an active session:

```text
<Electron userData>/captures/<sessionId>/
  camera-<timestamp>-<id>.jpg
  screen-<timestamp>-<id>.png
  audit.jsonl
```

The manifest records capture times and filenames as well as native monitoring events. Images stay on the device. The API stores monitoring event types and timestamps alongside the exam session in `backend/data/sessions.json`; this file is created automatically and ignored by Git. Existing evidence in older folders is retained.

JSON storage is intended for one backend process. It uses synchronous read/update/write transactions and atomic file replacement. This app records observable events; it does not perform face recognition, infer cheating, provide a remote proctor console, or establish a tamper-proof security boundary. OS camera/screen-recording permissions must be granted on the target device.

Kiosk support varies by OS. Electron cannot guarantee blocking every Mission Control/Spaces gesture or system shortcut; stronger lockdown requires an OS-managed assessment or single-app mode. No system-wide trackpad preferences are changed. Verify desktop swipes, app-switch shortcuts, permission dialogs, and the confirmed exit path on the target macOS version before relying on kiosk restrictions.

## Structure

```text
app/
  app.js                  Window lifecycle, exam-only shortcuts, and exit guard
  ipc.js                  IPC, screen selection, native audit, and evidence storage
  exam-window.js          Scoped kiosk restrictions and restoration
  screen-selection.js     Explicit display selection and disconnected-display handling
  capture-scheduler.js    Evidence cadence and cleanup
  preload.js              Narrow renderer bridge
src/
  App.jsx                 Workspace shell and exam flow
  api.js                  HTTP client and error handling
  components/             Setup, monitoring, questions, dialogs, activity, results
  hooks/                  Session, media, proctoring, and event synchronization
  lib/                    Frame capture, storage, event labels, time formatting
backend/
  server.js               HTTP entry point
  app.js                  Validated exam and monitoring routes
  exam-policy.js          Deadline, event policy, and student-safe responses
  store.js                JSON persistence
  data/questions.json     Question bank and answer keys
  test/                   Backend regression tests
tests/                   Capture, preload, and integrated Electron UI tests
```

## Verification

```sh
npm run lint
npm test
npm run build
npm run test:ui
```

The UI test uses the real backend and native evidence-storage code with temporary session files and synthetic media streams. It covers display selection, cancellation, denial, rejecting window capture, live readiness, stopped sharing, evidence files, warning behavior, offline event delivery, reload recovery, drafts, submission retry, and cleanup. Native kiosk calls are intercepted in this test so it does not lock the developer's desktop; unit tests verify restriction restoration and failure handling. It exports screenshots to the OS temporary directory under `athena-ui-review`. Real camera hardware, OS permission prompts, and desktop gestures require manual testing. The formatter configuration is in `.prettierrc.json`.

Packaged Electron loads the built `dist/` renderer; development Electron loads Vite. The existing package/make scripts use Electron Forge.
