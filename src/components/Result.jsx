import Icon from './Icon';
import { REVIEW_TYPES, formatTime } from '../lib/events';
import './Result.css';

export default function Result({ session, config, events, onActivity, onReset }) {
  const result = session.result;
  const count = config?.questionCount || result.attempted;
  const elapsed = Math.max(
    0,
    Math.floor((Date.parse(session.submittedAt) - Date.parse(session.startedAt)) / 1000),
  );
  function downloadSummary() {
    const blob = new Blob(
      [JSON.stringify({ assessment: config?.title, ...session, events }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `athena-${session.sessionId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="result card">
      <div className="completion-icon">
        <Icon name="check" size={34} />
      </div>
      <span className="eyebrow">ASSESSMENT COMPLETE</span>
      <h1>
        {session.submissionReason === 'time-expired'
          ? 'Time’s up. Your work is saved.'
          : 'All done. Well done.'}
      </h1>
      <p className="muted">
        {session.name}, your assessment has been submitted successfully.
        <br />
        Camera and screen monitoring have stopped.
      </p>
      <div className="result-score">
        <strong>
          {result.correct}
          <span>/{count}</span>
        </strong>
        <span>correct answers</span>
      </div>
      <div className="result-stats">
        <div>
          <strong>{result.attempted}</strong>
          <span>Attempted</span>
        </div>
        <div>
          <strong>{result.wrong}</strong>
          <span>Incorrect</span>
        </div>
        <div>
          <strong>{Math.max(0, count - result.attempted)}</strong>
          <span>Unanswered</span>
        </div>
        <div>
          <strong>{formatTime(elapsed)}</strong>
          <span>Time taken</span>
        </div>
      </div>
      <div className="result-session">
        <span>
          <Icon name="shield" size={18} />
          {events.filter(({ type }) => REVIEW_TYPES.has(type)).length} monitoring signals recorded
          for review
        </span>
        <button className="text-button" onClick={onActivity}>
          View activity
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="result-actions">
        <button className="btn btn-secondary" onClick={downloadSummary}>
          <Icon name="download" size={18} />
          Download summary
        </button>
        <button className="btn btn-primary" onClick={onReset}>
          Back to workspace
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <p className="result-reference">
        Session {session.sessionId.replace('session-', '').slice(0, 8)} · Submitted{' '}
        {new Date(session.submittedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </section>
  );
}
