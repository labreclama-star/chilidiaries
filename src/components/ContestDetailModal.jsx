import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { timeAgo } from '../utils/helpers.js';
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
  const { activeModal, modalPayload, closeModal, contests, startJoinContest, joinedContestIds, getContestParticipants, growers, diaries, contestWins } = useApp();
  const isOpen = activeModal === 'contestDetail';
  const contest = modalPayload ? contests.find((c) => c.id === modalPayload.contestId) : null;
  const joined = contest ? joinedContestIds.includes(contest.id) : false;
  const finished = contest ? contest.status === 'finished' : false;

  // Официальный победитель (Этап 6, задача Б2) — без новых запросов: имя
  // берём из growers, дневник — из diaries (если он там есть; дневники
  // могут быть приватными и не попасть в общий state — тогда fallback ниже
  // на подпись без ссылки, а не сломанную ссылку на несуществующий id).
  const win = finished && contest ? contestWins.find((w) => w.contestId === contest.id) : null;
  const winnerGrower = win ? growers.find((g) => g.id === win.winnerUserId) : null;
  const winnerDiary = win ? diaries.find((d) => d.id === win.winnerDiaryId) : null;

  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantsError, setParticipantsError] = useState(null);

  // Зависимость от isOpen (а не только contest?.id) специально: юзер может
  // закрыть эту модалку, поучаствовать через ContestJoinModal (Этап 3) и
  // вернуться сюда же для того же конкурса — без isOpen в зависимостях
  // повторное открытие того же contest.id не перезапустило бы эффект, и
  // свежедобавленный участник не появился бы в списке без ручного refresh.
  useEffect(() => {
    if (!isOpen || !contest) {
      return;
    }
    let cancelled = false;
    setLoadingParticipants(true);
    setParticipantsError(null);
    getContestParticipants(contest.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setParticipantsError(error.message || 'Не удалось загрузить участников');
        setParticipants([]);
      } else {
        setParticipants(data || []);
      }
      setLoadingParticipants(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, contest?.id, getContestParticipants]);

  // Максимум delta среди текущих участников — знаменатель для прогресс-бара
  // каждой карточки (ширина = доля от лидера). Math.max(1, …) — защита от
  // деления на 0, когда конкурс только начался и у всех delta === 0.
  const maxDelta = Math.max(1, ...participants.map((p) => p.likesDelta));
  const medals = ['🥇', '🥈', '🥉'];

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

          {winnerGrower && (
            <div className="side-card" style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={winnerGrower.name} photo={winnerGrower.avatar} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: 13.5, marginBottom: 4, color: 'var(--habanero)' }}>🏆 Победитель конкурса</h4>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{winnerGrower.name}</div>
                {winnerDiary ? (
                  <Link to={`/diaries/${winnerDiary.id}`} onClick={closeModal} style={{ fontSize: 13, color: 'var(--habanero)' }}>
                    {winnerDiary.title}
                  </Link>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--cream-dim)' }}>Дневник победителя</span>
                )}
                {win.announcedAt && (
                  <div style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 2 }}>{timeAgo(win.announcedAt)}</div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 22 }}>
            <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--white)' }}>Участники</h4>

            {loadingParticipants && (
              <p style={{ fontSize: 13.5, color: 'var(--cream-dim)' }}>Загружаю участников…</p>
            )}

            {!loadingParticipants && participantsError && (
              <p style={{ fontSize: 13.5, color: 'var(--cream-dim)' }}>Не удалось загрузить участников</p>
            )}

            {!loadingParticipants && !participantsError && participants.length === 0 && (
              <p style={{ fontSize: 13.5, color: 'var(--cream-dim)' }}>Пока никто не участвует</p>
            )}

            {!loadingParticipants && !participantsError && participants.length > 0 && (
              <div className="grid grid-2">
                {participants.map((p, i) => (
                  <div key={p.userId} className="contest-participant-card">
                    <div className="contest-participant-head">
                      <div className="avatar" style={p.avatar ? { backgroundImage: `url('${p.avatar}')` } : undefined}>
                        {!p.avatar && p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="contest-participant-name">
                        {i < 3 && <span className="contest-participant-medal">{medals[i]}</span>}
                        {p.name}
                      </span>
                    </div>

                    <Link to={`/diaries/${p.diaryId}`} onClick={closeModal} className="contest-participant-diary">
                      {p.diaryTitle}
                    </Link>

                    <div className="contest-participant-delta">{p.likesDelta}</div>
                    <div className="contest-participant-delta-label">лайков за период</div>

                    <div className="progress-bar">
                      <div style={{ width: `${(Math.max(0, p.likesDelta) / maxDelta) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-block" disabled={joined || finished} onClick={() => startJoinContest(contest.id)}>
            {joined ? '✓ Вы участвуете' : finished ? 'Конкурс завершён' : 'Участвовать'}
          </button>
        </>
      )}
    </Modal>
  );
}
