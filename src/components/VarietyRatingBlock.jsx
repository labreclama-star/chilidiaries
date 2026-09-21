import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import StarRating from './StarRating.jsx';
import RatingInput from './RatingInput.jsx';
import { computeVarietyRatings, findUserVote } from '../utils/varietyRatings.js';

const emptyDraft = { overall: 0, capsaicin: 0, aroma: 0 };

/**
 * "Оценки сообщества" side-card: shows the three community-adjusted
 * averages (see utils/varietyRatings.js for how the numbers move as votes
 * come in) plus lets the current user cast or edit their own vote.
 */
export default function VarietyRatingBlock({ variety }) {
  const { currentUser, varietyVotes, voteVariety, openModal } = useApp();
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(false);

  const ratings = computeVarietyRatings(variety, varietyVotes);
  const myVote = currentUser ? findUserVote(varietyVotes, variety.id, currentUser.growerId) : null;

  // Pre-fill the form with the user's existing vote (or reset it) whenever
  // the logged-in user or the underlying vote changes — e.g. after
  // switching accounts, or right after voting for the first time.
  useEffect(() => {
    setDraft(myVote ? { overall: myVote.overall, capsaicin: myVote.capsaicin, aroma: myVote.aroma } : emptyDraft);
    setEditing(false);
  }, [myVote, currentUser]);

  function handleSubmit() {
    if (!currentUser) {
      openModal('auth');
      return;
    }
    if (!draft.overall || !draft.capsaicin || !draft.aroma) return;
    voteVariety(variety.id, draft);
    setEditing(false);
  }

  const showForm = !myVote || editing;
  const canSubmit = draft.overall > 0 && draft.capsaicin > 0 && draft.aroma > 0;

  return (
    <div className="side-card">
      <h4>Оценки сообщества</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
        <StarRating value={ratings.overall} label="Общий рейтинг" />
        <StarRating value={ratings.capsaicin} label="Капсаицин" />
        <StarRating value={ratings.aroma} label="Аромат" />
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--cream-faint)', marginBottom: 16 }}>
        {ratings.voteCount > 0
          ? `На основе ${ratings.voteCount} ${pluralVotes(ratings.voteCount)} сообщества`
          : 'Пока это стартовая оценка каталога — стань первым, кто проголосует'}
      </p>

      {!currentUser && (
        <button className="btn btn-outline btn-block" onClick={() => openModal('auth')}>
          Войти, чтобы оценить сорт
        </button>
      )}

      {currentUser && !showForm && (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--cream-dim)', marginBottom: 10 }}>
            Ты оценил(а) этот сорт: {myVote.overall}/5 · капсаицин {myVote.capsaicin}/5 · аромат {myVote.aroma}/5
          </p>
          <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => setEditing(true)}>
            Изменить оценку
          </button>
        </div>
      )}

      {currentUser && showForm && (
        <div style={{ borderTop: '1px solid var(--scorch-line-soft)', paddingTop: 14, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: 'var(--cream-faint)', marginBottom: 10 }}>
            {myVote ? 'Изменить свою оценку:' : 'Твоя оценка:'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <RatingInput label="Общий" value={draft.overall} onChange={(n) => setDraft((d) => ({ ...d, overall: n }))} />
            <RatingInput label="Капсаицин" value={draft.capsaicin} onChange={(n) => setDraft((d) => ({ ...d, capsaicin: n }))} />
            <RatingInput label="Аромат" value={draft.aroma} onChange={(n) => setDraft((d) => ({ ...d, aroma: n }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {myVote ? 'Сохранить оценку' : 'Оценить сорт'}
            </button>
            {myVote && (
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Отмена</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pluralVotes(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'оценки';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'оценок';
  return 'оценок';
}
