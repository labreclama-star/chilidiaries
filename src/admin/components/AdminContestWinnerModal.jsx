import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Avatar from '../../components/Avatar.jsx';
import { useApp } from '../../context/AppContext.jsx';

/**
 * "Объявить победителя" (Этап 5, п.2) — грузит участников конкурса через
 * getContestParticipants (тот же сервисный вызов, что и публичная таблица
 * результатов в ContestDetailModal, её НЕ трогаю) и даёт админу выбрать
 * одного radio-кнопкой. По умолчанию выбран топ-1 — список уже отсортирован
 * сервисом по likesDelta desc, поэтому это просто participants[0].
 *
 * place пока всегда 1 — schema contest_winners.contest_id это PRIMARY KEY
 * (см. 0013_contest_diary.sql), т.е. на конкурс хранится ровно одна строка;
 * топ-2/топ-3 сюда не заводим, это отдельная миграция при необходимости.
 */
export default function AdminContestWinnerModal({ contest, onClose, onDeclared }) {
  const { getContestParticipants, declareContestWinner, adminUpdateContest, showToast } = useApp();
  const isOpen = !!contest;

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setParticipants([]);
    setSelectedUserId(null);
    getContestParticipants(contest.id).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) {
        showToast(error.message || 'Не удалось загрузить участников');
        return;
      }
      const list = data || [];
      setParticipants(list);
      if (list.length > 0) setSelectedUserId(list[0].userId);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, contest?.id, getContestParticipants, showToast]);

  async function handleConfirm() {
    const winner = participants.find((p) => p.userId === selectedUserId);
    if (!winner || submitting) return;
    setSubmitting(true);
    const { error } = await declareContestWinner({
      contestId: contest.id,
      winnerUserId: winner.userId,
      winnerDiaryId: winner.diaryId,
      place: 1
    });
    if (error) {
      setSubmitting(false);
      showToast(error.message || 'Не удалось объявить победителя');
      return;
    }
    showToast('Победитель объявлен!', 'success');

    // Этап 6, задача А: автоперевод конкурса в 'finished', чтобы админу не
    // нужно было вручную идти в "Изменить" после объявления победителя.
    // Если статус уже 'finished' — не долбим БД лишним UPDATE. silent=true —
    // тост "Победитель объявлен!" уже показан выше, второй тост про смену
    // статуса тут будет лишним шумом.
    if (contest.status !== 'finished') {
      await adminUpdateContest(contest.id, { status: 'finished' }, true);
    }

    setSubmitting(false);
    onDeclared({ contestId: contest.id, winnerUserId: winner.userId, winnerDiaryId: winner.diaryId, place: 1 });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {contest && (
        <>
          <h2 style={{ marginBottom: 16 }}>Победитель: {contest.title}</h2>

          {loading && <p className="sub">Загружаю участников…</p>}

          {!loading && participants.length === 0 && (
            <p className="sub">В этом конкурсе пока нет участников.</p>
          )}

          {!loading && participants.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {participants.map((p) => (
                <label
                  key={p.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    border: '1px solid var(--scorch-line-soft)', borderRadius: 8, cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="contest-winner"
                    checked={selectedUserId === p.userId}
                    onChange={() => setSelectedUserId(p.userId)}
                  />
                  <Avatar name={p.name} photo={p.avatar} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--white)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cream-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.diaryTitle}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--habanero)', flexShrink: 0 }}>
                    {p.likesDelta}
                  </div>
                </label>
              ))}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={!selectedUserId || submitting} onClick={handleConfirm}>
            {submitting ? 'Отправляю…' : 'Подтвердить'}
          </button>
        </>
      )}
    </Modal>
  );
}
