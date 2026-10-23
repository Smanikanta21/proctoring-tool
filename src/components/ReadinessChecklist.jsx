import './ReadinessChecklist.css';
import Icon from './Icon';

export default function ReadinessChecklist({ proctoring: p, connected, config, onBegin, loading }) {
  const checks = [
    {
      icon: 'camera',
      name: 'Camera access',
      detail: 'Keep your face in the frame throughout the assessment.',
      ready: p.camera.enabled,
      pending: p.camera.pending,
      action: p.enableCamera,
      label: 'Enable camera',
    },
    {
      icon: 'screen',
      name: 'Entire-screen sharing',
      detail: p.screen.enabled
        ? `${p.selectedSource?.name || 'Entire screen'} is shared. Your live preview is connected.`
        : 'Select your full display and confirm sharing.',
      readyLabel: 'Sharing',
      ready: p.screen.enabled,
      pending: p.screen.pending,
      action: p.loadSources,
      label: 'Share screen',
    },
    {
      icon: 'expand',
      name: 'Full-screen mode',
      detail: 'A distraction-free workspace for your assessment.',
      ready: p.fullscreen,
      action: p.enableFullscreen,
      label: 'Enter full screen',
    },
    {
      icon: 'wifi',
      name: 'Exam connection',
      detail: 'Your answers and monitoring events can sync.',
      ready: connected,
      label: connected ? 'Connected' : 'Reconnecting…',
    },
  ];
  const readyCount = checks.filter(({ ready }) => ready).length;
  return (
    <>
      <section className="welcome">
        <div className="eyebrow">
          <span className="tiny-line" /> YOUR ASSESSMENT WORKSPACE
        </div>
        <h1>
          Good preparation.
          <br />
          <span>A confident start.</span>
        </h1>
        <p>
          Take a moment to set up your space. We’ll help you get everything ready before the clock
          starts.
        </p>
      </section>
      <section className="assessment-brief">
        <div className="brief-icon">
          <Icon name="book" size={25} />
        </div>
        <div className="brief-body">
          <span className="eyebrow">{config?.subject || 'YOUR NEXT ASSESSMENT'}</span>
          <h2>{config?.title || 'Connecting to your assessment…'}</h2>
          <div className="brief-meta">
            <span>
              <Icon name="clock" size={15} />
              {config ? `${Math.round(config.durationSeconds / 60)} minutes` : '—'}
            </span>
            <span>
              <Icon name="grid" size={15} />
              {config ? `${config.questionCount} questions` : '—'}
            </span>
            <span>
              <Icon name="shield" size={15} />
              Proctored
            </span>
          </div>
        </div>
        <span className="pill neutral">Not started</span>
      </section>
      <section className="card readiness-card">
        <div className="section-heading">
          <div>
            <h2>Let’s check your setup</h2>
            <p>Four quick checks. One less thing to think about.</p>
          </div>
          <div
            className="readiness-ring"
            role="status"
            aria-label={`${readyCount} of 4 setup checks complete`}
            style={{ '--progress': `${readyCount * 25}%` }}
          >
            <span>
              {readyCount}
              <small>/4</small>
            </span>
          </div>
        </div>
        <div className="checklist">
          {checks.map((check, index) => (
            <div className={`check-row${check.ready ? ' is-ready' : ''}`} key={check.name}>
              <div className="check-icon">
                <Icon name={check.icon} size={21} />
              </div>
              <div className="check-body">
                <h3>{check.name}</h3>
                <p>{check.detail}</p>
              </div>
              {check.ready ? (
                <span className="check-ready">
                  <Icon name="check" size={16} />
                  {check.readyLabel || 'Ready'}
                </span>
              ) : check.action ? (
                <button
                  className="btn btn-small btn-secondary"
                  onClick={check.action}
                  disabled={check.pending || !p.available}
                >
                  {check.pending ? 'Connecting…' : check.label}
                </button>
              ) : (
                <span className="check-waiting">{loading ? 'Checking…' : check.label}</span>
              )}
              <span className="check-step">0{index + 1}</span>
            </div>
          ))}
        </div>
        {!p.available && (
          <p className="notice warning">
            <Icon name="info" />
            Open the Athena desktop app to connect your devices and begin.
          </p>
        )}
        <div className="setup-footer">
          <span>
            <Icon name="lock" size={15} />
            {readyCount === 4 ? 'Your workspace is ready' : 'Complete all checks to begin'}
          </span>
          {onBegin && (
            <button
              className="btn btn-primary"
              disabled={!p.ready || !connected || loading}
              onClick={onBegin}
            >
              Continue to assessment
              <Icon name="arrow" size={18} />
            </button>
          )}
        </div>
      </section>
      <div className="quiet-note">
        <Icon name="info" size={17} />
        <p>
          A quiet room. A clear desk. Your best work.
          <br />
          <span>Close unrelated apps and keep your charger nearby.</span>
        </p>
      </div>
    </>
  );
}
