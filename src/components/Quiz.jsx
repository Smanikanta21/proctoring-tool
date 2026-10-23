import { useState, useEffect } from 'react';
import { getQuestions, submitAnswer } from '../api';
import { readStorage, writeStorage } from '../lib/storage';
import Icon from './Icon';
import Modal from './Modal';
import './Quiz.css';

export default function Quiz({ session, onFinish, onSessionEnded, expired }) {
  const storageKey = `athena.draft.${session.sessionId}`;
  const [draft, setDraft] = useState(() =>
    readStorage(storageKey, { answers: {}, marked: [], index: 0 }),
  );
  const [questions, setQuestions] = useState([]);
  const [committed, setCommitted] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reload, setReload] = useState(0);
  const saved = {
    ...Object.fromEntries(
      session.answers.map(({ questionId, selectedAnswer }) => [questionId, selectedAnswer]),
    ),
    ...committed,
  };
  const index = Math.min(draft.index, Math.max(questions.length - 1, 0));
  const question = questions[index];
  const selected = question ? (saved[question.id] ?? draft.answers[question.id]) : undefined;
  const finalized = question && saved[question.id] !== undefined;
  const selectedCount = questions.filter(
    ({ id }) => saved[id] !== undefined || draft.answers[id] !== undefined,
  ).length;

  useEffect(() => {
    const controller = new AbortController();
    getQuestions(controller.signal)
      .then((questions) => {
        setQuestions(questions);
        setError('');
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  function updateDraft(changes) {
    const next = { ...draft, ...changes };
    setDraft(next);
    if (!writeStorage(storageKey, next))
      setError(
        'Local recovery is unavailable. Please keep this window open and save your answers.',
      );
  }
  async function save(questionId, answer) {
    await submitAnswer(session.sessionId, questionId, answer);
    setCommitted((previous) => ({ ...previous, [questionId]: answer }));
  }
  function reportError(error) {
    if (error.session) onSessionEnded(error.session);
    else setError(error.message);
  }
  async function saveAndNext() {
    if (busy || expired || selected === undefined) return;
    setBusy(true);
    setError('');
    try {
      if (!finalized) await save(question.id, selected);
      if (index < questions.length - 1) updateDraft({ index: index + 1 });
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      for (const question of questions) {
        const answer = draft.answers[question.id];
        if (saved[question.id] === undefined && answer !== undefined)
          await save(question.id, answer);
      }
      await onFinish();
      writeStorage(storageKey, null);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="card loading-state">
        <span className="spinner" />
        Loading your assessment…
      </div>
    );
  if (!questions.length)
    return (
      <div className="card loading-state">
        <Icon name="wifi" />
        <p>{error || 'No questions are available.'}</p>
        <button className="btn btn-secondary" onClick={() => setReload((value) => value + 1)}>
          Retry loading
        </button>
      </div>
    );
  return (
    <>
      <section className="card question-map">
        <div className="section-heading">
          <div>
            <h2>Question navigator</h2>
            <p>
              {Object.keys(saved).length} of {questions.length} answers saved
            </p>
          </div>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => setConfirming(true)}
            disabled={busy || expired}
          >
            Submit exam
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="question-map-bottom">
          <div className="question-numbers">
            {questions.map((question, questionIndex) => (
              <button
                aria-label={`Go to question ${questionIndex + 1}`}
                aria-current={index === questionIndex ? 'step' : undefined}
                className={`question-number${index === questionIndex ? ' current' : ''}${saved[question.id] !== undefined ? ' saved' : ''}${draft.marked.includes(question.id) ? ' marked' : ''}`}
                key={question.id}
                disabled={busy}
                onClick={() => updateDraft({ index: questionIndex })}
              >
                {questionIndex + 1}
                {draft.marked.includes(question.id) && <span />}
              </button>
            ))}
          </div>
          <div className="map-legend">
            <span>
              <i className="legend-saved" />
              Saved
            </span>
            <span>
              <i className="legend-marked" />
              For review
            </span>
            <span>
              <i />
              Not saved
            </span>
          </div>
        </div>
      </section>
      <section className="card quiz-container">
        <div className="question-top">
          <span className="eyebrow">
            QUESTION {String(index + 1).padStart(2, '0')}{' '}
            <span className="muted">/ {String(questions.length).padStart(2, '0')}</span>
          </span>
          <span className="pill neutral">Single choice</span>
        </div>
        <h2 className="question-text">{question.question}</h2>
        <p className="question-instruction">
          Choose one answer. You can change your selection until you save.
        </p>
        {error && !confirming && (
          <p className="notice danger" role="alert">
            {error}
          </p>
        )}
        <div className="options-container">
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              className={`option-btn${selected === optionIndex ? ' selected' : ''}`}
              aria-label={`${String.fromCharCode(65 + optionIndex)}. ${option}`}
              aria-pressed={selected === optionIndex}
              disabled={Boolean(finalized) || busy || expired}
              onClick={() =>
                updateDraft({ answers: { ...draft.answers, [question.id]: optionIndex } })
              }
            >
              <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
              <span>{option}</span>
              <span className="option-radio">{selected === optionIndex && <span />}</span>
            </button>
          ))}
        </div>
        <div className="answer-tools">
          <button
            className={`text-button${draft.marked.includes(question.id) ? ' text-accent' : ''}`}
            disabled={busy || expired}
            onClick={() =>
              updateDraft({
                marked: draft.marked.includes(question.id)
                  ? draft.marked.filter((id) => id !== question.id)
                  : [...draft.marked, question.id],
              })
            }
          >
            <Icon name="flag" size={16} />
            {draft.marked.includes(question.id) ? 'Marked for review' : 'Mark for review'}
          </button>
          <span className="answer-status">
            <Icon name={finalized ? 'check' : 'lock'} size={15} />
            {finalized
              ? 'Answer saved · final'
              : selected !== undefined
                ? 'Draft saved on this device'
                : 'Select an answer'}
          </span>
        </div>
        <div className="navigation-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => updateDraft({ index: index - 1 })}
            disabled={index === 0 || busy}
          >
            <Icon name="left" size={17} />
            Previous
          </button>
          <button
            className="btn btn-primary"
            onClick={saveAndNext}
            disabled={
              busy ||
              expired ||
              selected === undefined ||
              (Boolean(finalized) && index === questions.length - 1)
            }
          >
            {busy
              ? 'Saving…'
              : finalized
                ? 'Next question'
                : index === questions.length - 1
                  ? 'Save answer'
                  : 'Save & next'}
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>
      <div className="quiet-note">
        <Icon name="lock" size={16} />
        <p>
          Save each answer before moving on.
          <span> Only answers received before the deadline count.</span>
        </p>
      </div>
      {confirming && (
        <Modal title="Ready to submit?" onClose={() => setConfirming(false)} busy={busy}>
          <p className="muted">
            We’ll save your selected answers and finish your assessment. Submitted answers cannot be
            changed.
          </p>
          <div className="submission-counts">
            <div>
              <strong>{selectedCount}</strong>
              <span>Answered</span>
            </div>
            <div>
              <strong>{questions.length - selectedCount}</strong>
              <span>Unanswered</span>
            </div>
            <div>
              <strong>{draft.marked.length}</strong>
              <span>Marked for review</span>
            </div>
          </div>
          {questions.length !== selectedCount && (
            <p className="notice warning">
              You still have {questions.length - selectedCount} unanswered questions.
            </p>
          )}
          {error && (
            <p className="notice danger" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep reviewing
            </button>
            <button className="btn btn-primary" disabled={busy || expired} onClick={finish}>
              {busy ? 'Submitting…' : 'Submit assessment'}
              <Icon name="check" size={18} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
