import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
    </svg>
  );
}

/**
 * "Полная информация о конкурсе" — opens from the preview card/photo in
 * ContestCard. Reads the contest fresh from context by id (rather than
 * trusting whatever was in the payload at click-time) so progress/participant
 * counts stay live even if the modal is left open.
 */
export default function ContestDetailModal() {
  const { activeModal, modalPayload, closeModal, contests, joinContest, joinedContestIds } = useApp();
  const isOpen = activeModal === 'contestDetail';
  const contest = modalPayload ? contests.find((c) => c.id === modalPayload.contestId) : null;
  const joined = contest ? joinedContestIds.includes(contest.id) : false;

  return (
    <Modal isOpen={isOpen && !!contest} onClose={closeModal} wide>
      {contest && (
        <>
          {contest.photo && (
            <div className="contest-detail-photo" style={{ backgroundImage: `url('${contest.photo}')` }} />
          )}
          <span className="eyebrow">{contest.sponsor ? `Спонсор: ${contest.sponsor}` : 'Активный конкурс'}</span>
          <h2 style={{ margin: '10px 0 14px' }}>{contest.title}</h2>

          <p style={{ color: 'var(--cream-dim)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
            {contest.fullDesc || contest.desc}
          </p>

          <div className="contest-prize" style={{ marginBottom: 20 }}>
            <TrophyIcon />
            <span>{contest.prize}</span>
          </div>

          <div className="contest-progress" style={{ marginBottom: 22 }}>
            <div className="progress-bar"><div style={{ width: `${contest.progress}%` }} /></div>
            <div className="contest-meta">
              <span>{contest.participants} участников</span>
              <span>{contest.progress}% до конца срока</span>
            </div>
          </div>

          <div className="meta-strip" style={{ marginBottom: 22 }}>
            <div><label>Старт</label><strong>{contest.startDate}</strong></div>
            <div><label>Дедлайн</label><strong>{contest.deadline}</strong></div>
          </div>

          {contest.rules && contest.rules.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h4 style={{ fontSize: 14, marginBottom: 10, color: 'var(--white)' }}>Правила</h4>
              <ul style={{ paddingLeft: 18, color: 'var(--cream-dim)', fontSize: 13.5, lineHeight: 1.9 }}>
                {contest.rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {contest.howToJoin && (
            <div className="side-card" style={{ marginBottom: 22 }}>
              <h4 style={{ fontSize: 13.5, marginBottom: 6, color: 'var(--habanero)' }}>Как участвовать</h4>
              <p style={{ fontSize: 13.5, color: 'var(--cream-dim)' }}>{contest.howToJoin}</p>
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={joined} onClick={() => joinContest(contest.id)}>
            {joined ? '✓ Вы участвуете' : 'Участвовать'}
          </button>
        </>
      )}
    </Modal>
  );
}
