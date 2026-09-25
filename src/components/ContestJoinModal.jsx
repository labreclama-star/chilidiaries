import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

/**
 * "Выбери дневник для участия" — открывается ТОЛЬКО через startJoinContest
 * (см. AppContext.jsx), который уже проверил: юзер залогинен, конкурс не
 * finished, юзер ещё не участвует, и у него есть хотя бы один свой дневник.
 * Здесь дневники читаются по тому же фильтру (growerId) — на случай, если
 * список diaries в state изменится, пока модалка открыта.
 *
 * diaries в state отфильтрованы по is_private=false на уровне запроса
 * (fetchInitialDiaries) — свои приватные дневники сюда просто не попадают,
 * так что весь список myDiaries ниже уже гарантированно публичный.
 */
export default function ContestJoinModal() {
  const { activeModal, modalPayload, closeModal, contests, diaries, currentUser, joinContestWithDiary } = useApp();
  const isOpen = activeModal === 'contestJoin';
  const contest = modalPayload ? contests.find((c) => c.id === modalPayload.contestId) : null;
  const myDiaries = currentUser ? diaries.filter((d) => d.growerId === currentUser.growerId) : [];

  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Сброс выбора при каждом новом конкурсе (в т.ч. при первом открытии) —
  // иначе повторное открытие модалки для ДРУГОГО конкурса унесло бы с собой
  // выбор дневника от прошлого раза.
  useEffect(() => {
    setSelectedId(null);
  }, [modalPayload?.contestId]);

  const handleJoin = async () => {
    if (!contest || !selectedId || submitting) return;
    setSubmitting(true);
    const result = await joinContestWithDiary(contest.id, selectedId);
    setSubmitting(false);
    // ok:true покрывает и duplicate (юзер и так уже участвует) — в обоих
    // случаях модалке больше нечего показывать, кроме как закрыться.
    if (result.ok) closeModal();
  };

  return (
    <Modal isOpen={isOpen && !!contest} onClose={closeModal}>
      {contest && (
        <>
          <span className="eyebrow">Участие в конкурсе</span>
          <h2 style={{ margin: '10px 0 16px' }}>{contest.title}</h2>
          <p style={{ color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Выбери дневник, которым будешь участвовать. Голоса — лайки, которые дневник получит за время конкурса
            (лайки до сегодняшнего дня не считаются).
          </p>

          {myDiaries.length === 0 ? (
            // Защитный случай: startJoinContest уже отсекает пустой список
            // тостом до открытия модалки, но diaries могли измениться, пока
            // модалка была открыта (например, дневник удалён админом).
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, marginBottom: 20 }}>
              У тебя пока нет своих дневников — заведи дневник, чтобы участвовать.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {myDiaries.map((d) => (
                <label
                  key={d.id}
                  className="side-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    borderColor: selectedId === d.id ? 'var(--habanero)' : undefined
                  }}
                >
                  <input
                    type="radio"
                    name="contest-join-diary"
                    value={d.id}
                    checked={selectedId === d.id}
                    onChange={() => setSelectedId(d.id)}
                  />
                  <span style={{ fontSize: 14 }}>{d.title}</span>
                </label>
              ))}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={!selectedId || submitting} onClick={handleJoin}>
            {submitting ? 'Отправляю…' : 'Участвовать'}
          </button>
        </>
      )}
    </Modal>
  );
}
