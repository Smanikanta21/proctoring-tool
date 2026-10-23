import './ActivityLog.css';
import { EVENT_LABELS, REVIEW_TYPES } from '../lib/events';
import Icon from './Icon';

export default function ActivityLog({ events, pending }) {
  return (
    <>
      <p className="muted">
        A factual record of this session. These signals do not change your score.
        {pending > 0 && ` ${pending} events are waiting to sync.`}
      </p>
      <div className="activity-list">
        {events.length ? (
          [...events].reverse().map((event) => (
            <div className="activity-entry" key={event.id}>
              <span className={`activity-icon${REVIEW_TYPES.has(event.type) ? ' attention' : ''}`}>
                <Icon name={REVIEW_TYPES.has(event.type) ? 'flag' : 'check'} size={17} />
              </span>
              <div>
                <strong>{EVENT_LABELS[event.type] || event.type}</strong>
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
              </div>
              <span className="pill neutral">
                {REVIEW_TYPES.has(event.type) ? 'For review' : 'System event'}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Icon name="activity" size={28} />
            <p>No activity recorded yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
