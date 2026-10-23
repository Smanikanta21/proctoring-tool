import { useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import './ScreenShareDialog.css';

export default function ScreenShareDialog({ proctoring: p }) {
  const [selected, setSelected] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const busy = preparing || p.screen.pending;

  async function select(source) {
    setSelected(null);
    setPreparing(true);
    if (await p.prepareScreen(source)) setSelected(source);
    setPreparing(false);
  }

  async function share() {
    if (!selected || busy) return;
    if (!(await p.shareScreen(selected))) setSelected(null);
  }

  return (
    <Modal title="Share your entire screen" wide busy={busy} onClose={p.closeSources}>
      <p className="muted screen-share-intro">
        Choose the display you’ll use for your exam, then confirm sharing. Everything visible on
        that display will be included in your screen snapshots.
      </p>
      <div className="screen-share-scope">
        <Icon name="screen" size={20} />
        <div>
          <strong>Entire screen</strong>
          <span>Full-display sharing is required for this assessment.</span>
        </div>
      </div>
      {p.sourcesLoading ? (
        <p className="screen-share-empty" role="status">
          Finding your displays…
        </p>
      ) : p.sources.length ? (
        <div className="screen-source-picker" aria-label="Available entire screens">
          {p.sources.map((source) => (
            <button
              key={source.id}
              className={`screen-source-item${selected?.id === source.id ? ' selected' : ''}`}
              aria-label={`Select ${source.name}`}
              aria-pressed={selected?.id === source.id}
              disabled={busy}
              onClick={() => select(source)}
            >
              <span className="screen-source-preview">
                {source.thumbnail ? (
                  <img src={source.thumbnail} alt={`Preview of ${source.name}`} />
                ) : (
                  <span className="screen-preview-unavailable">
                    <Icon name="screen" size={38} />
                    <span>Display preview unavailable</span>
                  </span>
                )}
              </span>
              <span className="screen-source-label">
                <strong>{source.name}</strong>
                <span className="screen-source-check">
                  <Icon name={selected?.id === source.id ? 'check' : 'screen'} size={16} />
                </span>
              </span>
              <span className="screen-source-caption">Entire screen</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="screen-share-empty">
          No displays found. Check screen-recording permissions and try again.
        </p>
      )}
      {p.error && (
        <p className="notice danger" role="alert">
          {p.error}
        </p>
      )}
      <p className="screen-share-confirmation" role="status">
        {p.screen.pending
          ? 'Starting your live screen preview…'
          : preparing
            ? 'Preparing your display…'
            : selected
              ? `${selected.name} selected. Confirm below to start sharing.`
              : 'Select a display to continue.'}
      </p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={p.closeSources} disabled={busy}>
          Cancel
        </button>
        {!p.sources.length && (
          <button className="btn btn-secondary" onClick={p.loadSources} disabled={p.sourcesLoading}>
            Try again
          </button>
        )}
        <button className="btn btn-primary" onClick={share} disabled={!selected || busy}>
          <Icon name="screen" size={17} />
          {p.screen.pending ? 'Connecting…' : 'Share entire screen'}
        </button>
      </div>
    </Modal>
  );
}
