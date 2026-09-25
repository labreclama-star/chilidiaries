import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';
import Avatar from '../../components/Avatar.jsx';
import AdminContestWinnerModal from '../components/AdminContestWinnerModal.jsx';

const emptyForm = () => ({
  title: '', desc: '', fullDesc: '', prize: '', startDate: '', deadline: '',
  status: 'upcoming', photo: null, sponsor: '', rules: '', howToJoin: ''
});

// Статус конкурса → подпись + модификатор пилюли (.admin-pill--*)
const CONTEST_STATUS_META = {
  active: { label: 'Идёт', cls: 'admin-pill--accent' },
  upcoming: { label: 'Скоро', cls: 'admin-pill--warn' },
  judging: { label: 'Определение победителя', cls: 'admin-pill--judging' },
  finished: { label: 'Завершён', cls: 'admin-pill--muted' }
};
function contestStatusMeta(status) {
  return CONTEST_STATUS_META[status] || CONTEST_STATUS_META.upcoming;
}

// isoDateOnly(v) — <input type="date"> понимает только YYYY-MM-DD. Если в
// БД лежит нормальная ISO-дата — отрезаем время/зону, оставляя первые 10
// символов. Если там что-то не-ISO (старое значение, введённое словами,
// или пустота) — отдаём '', иначе браузер просто покажет пустое поле сам,
// но лучше сразу явно.
function isoDateOnly(v) {
  return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) ? v.slice(0, 10) : '';
}

// formatDateRu(v) — человекочитаемый вид ISO-даты для карточки конкурса
// в гриде (не для формы). Если распарсить не удалось — показываем то, что
// есть, как есть, а не '—' (например, старое нечисловое значение из БД).
function formatDateRu(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AdminContests() {
  const navigate = useNavigate();
  const {
    contests, growers, diaries, adminAddContest, adminUpdateContest, adminDeleteContest,
    adminAddContestParticipant, adminRemoveContestParticipant, getContestWinners,
    getContestParticipants, showToast
  } = useApp();

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [managing, setManaging] = useState(null); // contest whose participants are being edited
  const [managingParticipants, setManagingParticipants] = useState([]);
  const [managingLoading, setManagingLoading] = useState(false);
  const [addGrowerId, setAddGrowerId] = useState('');
  const [addDiaryId, setAddDiaryId] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [winners, setWinners] = useState({}); // { [contestId]: { winnerUserId, winnerDiaryId, place } }
  const [winnerModalContestId, setWinnerModalContestId] = useState(null);

  // Задача 2: участники грузятся через реальный getContestParticipants
  // (тот же вызов, что у AdminContestWinnerModal/публичной таблицы
  // результатов) — c.participantIds больше не используется, он всегда []
  // (contestRowToJs хардкодит это поле, реальный счётчик — c.participants).
  const refreshManagingParticipants = useCallback((contestId) => {
    setManagingLoading(true);
    return getContestParticipants(contestId).then(({ data, error }) => {
      setManagingLoading(false);
      if (error) {
        showToast(error.message || 'Не удалось загрузить участников');
        return;
      }
      setManagingParticipants(data || []);
    });
  }, [getContestParticipants, showToast]);

  useEffect(() => {
    if (!managing) {
      setManagingParticipants([]);
      return;
    }
    setAddGrowerId('');
    setAddDiaryId('');
    refreshManagingParticipants(managing.id);
    // refreshManagingParticipants стабильна по ссылке только пока стабильны
    // getContestParticipants/showToast — оба useCallback с фиксированными
    // зависимостями в AppContext, так что перезапуск эффекта только при
    // реальной смене managing.id, а не на каждый чих.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managing?.id]);

  // Bulk-загрузка объявленных победителей для всего грида одним запросом
  // (Этап 5, п.4) — не по одному на карточку. Ключ зависимости — строка id'шников,
  // а не сам массив contests: он может пересоздаваться на каждый рендер, а
  // getContestWinners — стабильная ссылка (useCallback с [] в AppContext), так
  // что без строкового ключа эффект долбил бы бэкенд на каждый чих.
  const contestIdsKey = contests.map((c) => c.id).join(',');
  useEffect(() => {
    if (contests.length === 0) return;
    let cancelled = false;
    getContestWinners(contests.map((c) => c.id)).then(({ data, error }) => {
      if (cancelled || error) return;
      const map = {};
      (data || []).forEach((w) => { map[w.contestId] = w; });
      setWinners(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestIdsKey, getContestWinners]);

  function field(key) {
    return { value: form[key] ?? '', onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function openCreate() {
    setForm(emptyForm());
    setEditing({});
  }

  function openEdit(c) {
    setForm({
      title: c.title, desc: c.desc || '', fullDesc: c.fullDesc || '', prize: c.prize || '',
      startDate: isoDateOnly(c.startDate), deadline: isoDateOnly(c.deadline), status: c.status || 'upcoming',
      photo: c.photo || null, sponsor: c.sponsor || '', rules: (c.rules || []).join('\n'), howToJoin: c.howToJoin || ''
    });
    setEditing(c);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const rules = form.rules.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { ...form, rules };
    if (editing && editing.id) {
      adminUpdateContest(editing.id, payload);
    } else {
      adminAddContest(payload);
    }
    setEditing(null);
  }

  const confirming = confirmDeleteId ? contests.find((c) => c.id === confirmDeleteId) : null;

  // Гроверы, которых ещё можно добавить (нет среди уже загруженных
  // managingParticipants) — сверяем по userId из реального списка участников,
  // а не по мёртвому managing.participantIds.
  const availableGrowers = managing
    ? growers.filter((g) => !managingParticipants.some((p) => p.userId === g.id))
    : [];
  // Публичные дневники выбранного гровера — diaries в state и так уже
  // отфильтрован по is_private=false на уровне запроса (см. fetchInitialDiaries),
  // так что фильтр по growerId достаточен, доп. проверка приватности не нужна.
  const addGrowerDiaries = addGrowerId ? diaries.filter((d) => d.growerId === addGrowerId) : [];

  async function handleAddParticipant() {
    if (!managing || !addGrowerId || !addDiaryId || addBusy) return;
    setAddBusy(true);
    const result = await adminAddContestParticipant(managing.id, addGrowerId, addDiaryId);
    setAddBusy(false);
    if (result.ok) {
      setAddGrowerId('');
      setAddDiaryId('');
      refreshManagingParticipants(managing.id);
    }
  }

  async function handleRemoveParticipant(userId) {
    if (!managing || removingUserId) return;
    setRemovingUserId(userId);
    const result = await adminRemoveContestParticipant(managing.id, userId);
    setRemovingUserId(null);
    if (result.ok) refreshManagingParticipants(managing.id);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Конкурсы</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Создать конкурс</button>
      </div>

      {contests.length === 0 ? (
        <div className="admin-page-stub"><p>Конкурсы не найдены</p></div>
      ) : (
        <div className="admin-contest-grid">
          {contests.map((c) => {
            const status = contestStatusMeta(c.status);
            return (
              <div key={c.id} className="admin-contest-card">
                {c.photo && <img src={c.photo} alt="" className="admin-contest-cover" />}
                <div className="admin-contest-card-top">
                  <h3 className="admin-contest-title">{c.title}</h3>
                  <span className={`admin-pill ${status.cls}`}>{status.label}</span>
                </div>
                {c.desc && <p className="admin-contest-desc">{c.desc}</p>}

                <div className="admin-contest-metrics">
                  <div>
                    <div className="admin-contest-metric-lbl">Участники</div>
                    <div className="admin-contest-metric-val">{c.participants}</div>
                  </div>
                  <div>
                    <div className="admin-contest-metric-lbl">До</div>
                    <div className="admin-contest-metric-val">{formatDateRu(c.deadline)}</div>
                  </div>
                  <div>
                    <div className="admin-contest-metric-lbl">Приз</div>
                    <div className="admin-contest-metric-val">{c.prize || '—'}</div>
                  </div>
                </div>

                <div className="admin-contest-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => navigate('/contests')}>Открыть</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setManaging(c)}>Участники</button>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Изменить</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(c.id)}>Удалить</button>
                  {(c.status === 'judging' || c.status === 'finished') && (
                    winners[c.id] ? (
                      <>
                        <span className="admin-pill admin-pill--accent">🥇 Победитель объявлен</span>
                        <button className="btn btn-outline btn-sm" onClick={() => setWinnerModalContestId(c.id)}>Изменить победителя</button>
                      </>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => setWinnerModalContestId(c.id)}>Объявить победителя</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} wide>
        <h2>{editing && editing.id ? 'Редактировать конкурс' : 'Создать конкурс'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Название</label><input type="text" required {...field('title')} /></div>
          <div className="field"><label>Короткое описание</label><textarea rows="2" {...field('desc')} /></div>
          <div className="field"><label>Полное описание</label><textarea rows="3" {...field('fullDesc')} /></div>
          <div className="field-row">
            <div className="field"><label>Приз</label><input type="text" {...field('prize')} /></div>
            <div className="field"><label>Спонсор</label><input type="text" {...field('sponsor')} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Дата начала</label><input type="date" {...field('startDate')} /></div>
            <div className="field"><label>Дедлайн</label><input type="date" {...field('deadline')} /></div>
          </div>
          <div className="field">
            <label>Статус</label>
            <select {...field('status')}>
              <option value="upcoming">Скоро стартует</option>
              <option value="active">Активен</option>
              <option value="judging">Определение победителя</option>
              <option value="finished">Завершён</option>
            </select>
          </div>
          <div className="field"><label>Правила (каждое — с новой строки)</label><textarea rows="3" {...field('rules')} /></div>
          <div className="field"><label>Как участвовать</label><textarea rows="2" {...field('howToJoin')} /></div>
          <div className="field"><label>Обложка</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
          {form.photo && (
            <div style={{ marginBottom: 14 }}>
              <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block">{editing && editing.id ? 'Сохранить' : 'Создать конкурс'}</button>
        </form>
      </Modal>

      <Modal isOpen={!!managing} onClose={() => setManaging(null)}>
        <h2>Участники: {managing?.title}</h2>

        <div style={{ marginBottom: 14 }}>
          <select
            value={addGrowerId}
            onChange={(e) => { setAddGrowerId(e.target.value); setAddDiaryId(''); }}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <option value="">Выбери гровера…</option>
            {availableGrowers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {addGrowerId && (
            addGrowerDiaries.length === 0 ? (
              // Триггер check_contest_participant_diary (0013) требует свой
              // и публичный дневник — без него INSERT всё равно отклонится,
              // поэтому не даём даже пытаться.
              <p className="sub">У этого гровера нет публичных дневников — участвовать нечем.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={addDiaryId} onChange={(e) => setAddDiaryId(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                  <option value="">Выбери дневник…</option>
                  {addGrowerDiaries.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" disabled={!addDiaryId || addBusy} onClick={handleAddParticipant}>
                  {addBusy ? 'Добавляю…' : 'Добавить'}
                </button>
              </div>
            )
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {managingLoading && <p className="sub">Загружаю участников…</p>}
          {!managingLoading && managingParticipants.length === 0 && <p className="sub">Участников пока нет</p>}
          {!managingLoading && managingParticipants.map((p) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', border: '1px solid var(--scorch-line-soft)', borderRadius: 8 }}>
              <Avatar name={p.name} photo={p.avatar} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--cream-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.diaryTitle} · {p.likesDelta} лайков
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={removingUserId === p.userId}
                onClick={() => handleRemoveParticipant(p.userId)}
              >
                {removingUserId === p.userId ? 'Убираю…' : 'Убрать'}
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <AdminContestWinnerModal
        contest={winnerModalContestId ? contests.find((c) => c.id === winnerModalContestId) : null}
        onClose={() => setWinnerModalContestId(null)}
        onDeclared={(winner) => setWinners((prev) => ({ ...prev, [winner.contestId]: winner }))}
      />

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить конкурс?"
        message={`Конкурс «${confirming?.title}» будет удалён без возможности восстановления.`}
        onConfirm={() => confirming && adminDeleteContest(confirming.id)}
      />
    </div>
  );
}