import './MonitoringPanel.css';
import Icon from './Icon';
import { EVENT_LABELS, REVIEW_TYPES } from '../lib/events';

export default function MonitoringPanel({
  proctoring: p,
  active,
  connected,
  events,
  pending,
  onActivity,
}) {
  const { videoRef: cameraVideoRef } = p.camera;
  const { videoRef: screenVideoRef } = p.screen;
  const count = events.filter(({ type }) => REVIEW_TYPES.has(type)).length;
  return (
    <aside className="monitor-column" aria-label="Monitoring status">
      <section className="card monitor-card">
        <div className="monitor-heading">
          <h2>Your workspace</h2>
          <span className={`status-dot${active ? ' live' : ''}`} />
        </div>
        <div className={`camera-preview${p.camera.enabled ? ' connected' : ''}`}>
          <video ref={cameraVideoRef} autoPlay playsInline muted hidden={!p.camera.enabled} />
          {!p.camera.enabled && (
            <div className="preview-placeholder">
              <div className="preview-camera-icon">
                <Icon name="camera" size={28} />
              </div>
              <strong>Your camera preview</strong>
              <span>Connect your camera to get started</span>
            </div>
          )}
          {p.camera.enabled && (
            <div className="preview-tag">
              <span className="status-dot live" />
              Camera connected
            </div>
          )}
          <span className="preview-corner top-left" />
          <span className="preview-corner top-right" />
          <span className="preview-corner bottom-left" />
          <span className="preview-corner bottom-right" />
        </div>
        <div className="feed-status">
          <span>
            <Icon name="screen" size={16} />
            Entire screen
          </span>
          <span className={p.screen.enabled ? 'text-green' : 'muted'}>
            {p.screen.enabled ? (
              <>
                <Icon name="check" size={14} /> Sharing
              </>
            ) : (
              'Not shared'
            )}
          </span>
        </div>
        <div className="screen-preview" hidden={!p.screen.enabled}>
          <video ref={screenVideoRef} autoPlay playsInline muted />
          <div className="screen-preview-caption">
            <Icon name="check" size={13} />
            {p.selectedSource?.name || 'Entire screen'} · Live preview
          </div>
        </div>
        <div className="feed-status">
          <span>
            <Icon name="wifi" size={16} />
            Exam connection
          </span>
          <span className={connected ? 'text-green' : 'text-amber'}>
            {connected ? 'Online' : 'Reconnecting'}
          </span>
        </div>
        <div className="monitor-foot">
          <Icon name="shield" size={16} />
          <span>{active ? 'Monitoring is active' : 'Monitoring begins with your exam'}</span>
        </div>
      </section>
      {active ? (
        <section className="card session-health">
          <div className="monitor-heading">
            <h2>Session activity</h2>
            <span className="pill neutral">{count} signals</span>
          </div>
          <p className="muted">Recorded for review. Your exam continues.</p>
          <div className="activity-mini">
            {events
              .slice(-3)
              .reverse()
              .map((event) => (
                <div key={event.id}>
                  <span
                    className={`activity-dot ${REVIEW_TYPES.has(event.type) ? 'attention' : ''}`}
                  />
                  <span>{EVENT_LABELS[event.type] || event.type}</span>
                  <time>
                    {new Date(event.occurredAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ))}
            {!events.length && <p className="muted">No events recorded yet.</p>}
          </div>
          <button className="text-button" onClick={onActivity}>
            View activity log <Icon name="arrow" size={16} />
          </button>
          <div className="sync-note">
            {pending ? `${pending} events waiting to sync` : 'Activity synced'} ·{' '}
            {p.lastCapture
              ? `Last capture ${new Date(p.lastCapture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Awaiting first capture'}
          </div>
        </section>
      ) : (
        <section className="guideline-card">
          <span className="eyebrow">A FEW THINGS TO KNOW</span>
          <h3>
            Fair for everyone.
            <br />
            Clear from the start.
          </h3>
          <ul>
            <li>
              <Icon name="check" size={16} />
              Camera and screen snapshots every 15 seconds during the exam.
            </li>
            <li>
              <Icon name="check" size={16} />
              Interruptions are logged. Warnings let you continue.
            </li>
            <li>
              <Icon name="check" size={16} />
              Your saved answers are final. Review each choice before saving.
            </li>
          </ul>
          <span className="guideline-caption">Snapshots stay on this device.</span>
        </section>
      )}
    </aside>
  );
}
