import { useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

export default function StartExamDialog({ onStart, onClose, ready, config }) {
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (!ready || pending || !acknowledged || !userId.trim() || !name.trim()) return;
    setPending(true);
    setError('');
    try {
      await onStart(userId.trim(), name.trim());
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }
  return (
    <Modal title="You’re ready. Let’s begin." onClose={onClose} busy={pending}>
      <p className="muted">
        Confirm your details for {config.title}. Your {Math.round(config.durationSeconds / 60)}
        -minute timer starts when you begin.
      </p>
      <p className="notice">
        Kiosk mode restricts switching apps during your exam. Use Leave exam to exit with
        confirmation.
      </p>
      <form onSubmit={submit} className="start-form">
        <label className="input-group">
          Full name
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="e.g. Alex Morgan"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
          />
        </label>
        <label className="input-group">
          Student ID
          <input
            required
            maxLength={100}
            placeholder="Your student or enrollment ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={pending}
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={pending}
          />
          <span>
            I understand that camera and screen snapshots are stored on this device every 15
            seconds, and interruptions are logged for review. Warnings do not stop the timer or
            change my score.
          </span>
        </label>
        {error && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        {!ready && <p className="notice warning">Restore your setup checks before starting.</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={onClose}>
            Go back
          </button>
          <button
            className="btn btn-primary"
            disabled={pending || !ready || !acknowledged || !userId.trim() || !name.trim()}
          >
            {pending ? 'Starting…' : 'Start assessment'}
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
