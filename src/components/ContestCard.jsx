import { useApp } from '../context/AppContext.jsx';

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
    </svg>
  );
}

export default function ContestCard({ contest }) {
  const { joinContest, joinedContestIds, openModal } = useApp();
  const joined = joinedContestIds.includes(contest.id);

  return (
    <div className="contest-card">
      {contest.photo && (
        <button
          type="button"
          className="contest-cover"
          style={{ backgroundImage: `url('${contest.photo}')` }}
          onClick={() => openModal('contestDetail', { contestId: contest.id })}
          aria-label={`Подробнее о конкурсе «${contest.title}»`}
        >
          <span className="contest-cover-hint">Превью · нажми, чтобы открыть</span>
        </button>
      )}
      <span className="eyebrow">Активный конкурс</span>
      <h3>
        <button type="button" className="contest-title-btn" onClick={() => openModal('contestDetail', { contestId: contest.id })}>
          {contest.title}
        </button>
      </h3>
      <p>{contest.desc}</p>
      <div className="contest-prize"><TrophyIcon /><span>{contest.prize}</span></div>
      <div className="contest-progress">
        <div className="progress-bar"><div style={{ width: `${contest.progress}%` }} /></div>
        <div className="contest-meta">
          <span>{contest.participants} участников</span>
          <span>до {contest.deadline}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" onClick={() => openModal('contestDetail', { contestId: contest.id })}>Подробнее</button>
        <button className="btn btn-primary btn-block" disabled={joined} onClick={() => joinContest(contest.id)}>
          {joined ? '✓ Вы участвуете' : 'Участвовать'}
        </button>
      </div>
    </div>
  );
}
