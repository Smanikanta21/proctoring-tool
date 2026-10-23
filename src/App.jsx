import { useState } from 'react';
import useExamSession from './hooks/useExamSession';
import useAuditLog from './hooks/useAuditLog';
import useProctoring from './hooks/useProctoring';
import ReadinessChecklist from './components/ReadinessChecklist';
import MonitoringPanel from './components/MonitoringPanel';
import StartExamDialog from './components/StartExamDialog';
import ScreenShareDialog from './components/ScreenShareDialog';
import ActivityLog from './components/ActivityLog';
import Modal from './components/Modal';
import Quiz from './components/Quiz';
import Result from './components/Result';
import Icon from './components/Icon';
import { EVENT_LABELS, REVIEW_TYPES, formatTime } from './lib/events';
import './App.css';

export default function App() {
  const exam = useExamSession();
  const active = exam.session?.status === 'in-progress';
  const completed = exam.session?.status === 'submitted';
  const audit = useAuditLog(exam.sessionId, exam.session?.events);
  const p = useProctoring({
    active,
    sessionId: exam.sessionId,
    connected: exam.connected,
    onEvent: audit.record,
  });
  const [dialog, setDialog] = useState(null);
  const [dismissedEvent, setDismissedEvent] = useState(null);
  const name = exam.session?.name || 'Guest student';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const lastSignal = audit.events.filter(({ type }) => REVIEW_TYPES.has(type)).at(-1);
  const warning =
    active &&
    (!p.ready || !p.focused || !exam.connected || (lastSignal && dismissedEvent !== lastSignal.id));

  async function begin(userId, name) {
    await exam.begin(userId, name);
    setDialog(null);
  }
  async function finish() {
    await audit.flush().catch(() => {});
    await exam.finish();
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Athena workspace">
          <span className="brand-mark">
            <Icon name="shield" size={24} />
          </span>
          <span>
            athena<span className="brand-period">.</span>
          </span>
        </a>
        <div className="sidebar-label">STUDENT WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a className="nav-item active" href="#workspace">
            <Icon name="grid" />
            Your assessment
            <span className="nav-indicator" />
          </a>
          <button
            className="nav-item"
            onClick={() => setDialog('activity')}
            disabled={!exam.session}
          >
            <Icon name="activity" />
            Session activity
          </button>
          <button className="nav-item" onClick={() => setDialog('guidelines')}>
            <Icon name="book" />
            Guidelines
          </button>
          {active && (
            <button className="nav-item" onClick={p.requestExit}>
              <Icon name="close" />
              Leave exam
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Icon name="help" size={22} />
            </span>
            <h3>A little help?</h3>
            <p>Find out how your assessment and monitoring work.</p>
            <button className="text-button" onClick={() => setDialog('guidelines')}>
              Read the guide
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="student-profile">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{name}</strong>
              <span>{exam.session?.userId || 'Ready when you are'}</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace<span>/</span>
            <strong>
              {completed ? 'Summary' : active ? 'Assessment in progress' : 'Assessment setup'}
            </strong>
          </div>
          <div className="topbar-status">
            <span className={`status-dot${exam.connected ? ' live' : ''}`} />
            {exam.connected ? 'Connected to exam service' : 'Connecting to exam service'}
            <span className="topbar-divider" />
            <Icon name="shield" size={18} />
          </div>
        </header>
        <main id="workspace" className="workspace">
          {active && (
            <div className="exam-titlebar">
              <div>
                <span className="eyebrow">ASSESSMENT IN PROGRESS</span>
                <h1>{exam.config?.title || 'Your assessment'}</h1>
                <p>Take your time. Make each answer count.</p>
              </div>
              <div className={`exam-clock${exam.remaining < 60 ? ' urgent' : ''}`}>
                <Icon name="clock" size={22} />
                <div>
                  <span>TIME REMAINING</span>
                  <strong>{formatTime(exam.remaining)}</strong>
                </div>
              </div>
            </div>
          )}
          {warning && (
            <div className="notice warning monitoring-warning" role="alert">
              <Icon name="warning" size={21} />
              <div>
                <strong>
                  {!p.ready
                    ? 'A monitoring check needs attention'
                    : !p.focused
                      ? 'Return to your exam window'
                      : !exam.connected
                        ? 'Your connection was interrupted'
                        : EVENT_LABELS[lastSignal.type]}
                </strong>
                <p>
                  You can continue your exam. This event is recorded for review; your timer keeps
                  running.
                </p>
                <div className="recovery-actions">
                  {!p.camera.enabled && (
                    <button
                      className="text-button"
                      onClick={p.enableCamera}
                      disabled={p.camera.pending}
                    >
                      Reconnect camera
                    </button>
                  )}
                  {!p.screen.enabled && (
                    <button
                      className="text-button"
                      onClick={p.loadSources}
                      disabled={p.screen.pending}
                    >
                      Restore screen sharing
                    </button>
                  )}
                  {!p.fullscreen && (
                    <button className="text-button" onClick={p.enableFullscreen}>
                      Restore full screen
                    </button>
                  )}
                  {!exam.connected && (
                    <button className="text-button" onClick={exam.refresh}>
                      Retry connection
                    </button>
                  )}
                </div>
              </div>
              {p.ready && p.focused && exam.connected && (
                <button
                  className="icon-button"
                  aria-label="Dismiss warning"
                  onClick={() => setDismissedEvent(lastSignal?.id)}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          )}
          {p.error && (
            <p className="notice danger" role="alert">
              <Icon name="info" />
              {p.error}
            </p>
          )}
          {audit.storageError && (
            <p className="notice warning">
              Local event storage is unavailable. Keep the application open so activity can sync.
            </p>
          )}
          {active && exam.remaining === 0 && (
            <p className="notice warning" role="status">
              Time is up. Finalizing your saved answers
              {!exam.connected ? ' when the connection returns' : ''}…
            </p>
          )}
          {completed ? (
            <Result
              session={exam.session}
              config={exam.config}
              events={audit.events}
              onActivity={() => setDialog('activity')}
              onReset={exam.reset}
            />
          ) : (
            <div className="workspace-grid">
              <div className="assessment-column">
                {active ? (
                  <Quiz
                    key={exam.sessionId}
                    session={exam.session}
                    expired={exam.remaining === 0}
                    onFinish={finish}
                    onSessionEnded={exam.acceptSession}
                  />
                ) : exam.sessionId ? (
                  <section className="card loading-state">
                    <Icon name="refresh" size={28} />
                    <h2>Restoring your assessment</h2>
                    <p className="muted">
                      {exam.error || 'Retrieving your saved answers and remaining time…'}
                    </p>
                    {exam.error && (
                      <button className="btn btn-secondary" onClick={exam.refresh}>
                        Retry connection
                      </button>
                    )}
                    {exam.missingSession && (
                      <button className="text-button" onClick={exam.reset}>
                        Return to setup
                      </button>
                    )}
                  </section>
                ) : (
                  <ReadinessChecklist
                    proctoring={p}
                    connected={exam.connected}
                    config={exam.config}
                    loading={exam.loading}
                    onBegin={() => setDialog('start')}
                  />
                )}
              </div>
              <MonitoringPanel
                proctoring={p}
                active={active}
                connected={exam.connected}
                events={audit.events}
                pending={audit.pending}
                onActivity={() => setDialog('activity')}
              />
            </div>
          )}
          <footer className="workspace-footer">
            <span>ATHENA ASSESSMENTS</span>
            <span>Built for focus. Designed for fairness.</span>
            <span>
              <Icon name="lock" size={12} />
              Your assessment workspace
            </span>
          </footer>
        </main>
      </div>
      {p.sources !== null && !completed && <ScreenShareDialog proctoring={p} />}
      {dialog === 'start' && (
        <StartExamDialog
          ready={p.ready && exam.connected}
          config={exam.config}
          onStart={begin}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'activity' && (
        <Modal title="Your session activity" wide onClose={() => setDialog(null)}>
          <ActivityLog events={audit.events} pending={audit.pending} />
        </Modal>
      )}
      {dialog === 'guidelines' && (
        <Modal title="A clear guide to your assessment" wide onClose={() => setDialog(null)}>
          <div className="guide-content">
            <div>
              <Icon name="camera" />
              <h3>Stay connected</h3>
              <p>
                Enable your camera, share an entire screen, and enter full screen before starting.
                Camera and screen snapshots are saved on this device every 15 seconds during the
                exam.
              </p>
            </div>
            <div>
              <Icon name="lock" />
              <h3>Stay in your exam workspace</h3>
              <p>
                Desktop kiosk mode restricts app switching during the exam. Use Leave exam if you
                need to exit; you’ll be asked to confirm. Your timer keeps running while away.
              </p>
            </div>
            <div>
              <Icon name="flag" />
              <h3>Warnings keep you informed</h3>
              <p>
                Leaving the exam window, exiting full screen, losing a device feed, or attempting a
                restricted shortcut is logged for review. You can keep answering. These signals do
                not change your score.
              </p>
            </div>
            <div>
              <Icon name="clock" />
              <h3>The clock keeps running</h3>
              <p>
                Your time limit is set by the exam service. Reloading or losing connection does not
                reset it. At the deadline, only answers already saved to the service count.
              </p>
            </div>
            <div>
              <Icon name="check" />
              <h3>Save, review, then submit</h3>
              <p>
                Selections are kept locally as drafts. Use Save &amp; next to save an answer
                permanently. You can mark questions for review and revisit them. Saved answers
                cannot be changed. Your final submission saves any remaining selected drafts.
              </p>
            </div>
            <div>
              <Icon name="refresh" />
              <h3>Recover your work</h3>
              <p>
                Reopen this app after an interruption to restore your session and saved answers.
                Reconnect your camera and screen. Queued monitoring events sync when the service is
                available again.
              </p>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setDialog(null)}>
              Got it
              <Icon name="check" size={18} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
