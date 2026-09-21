import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';
import { DIARY_STAGES, REPORT_INTERVALS } from '../../utils/helpers.js';

export default function AdminDiaries() {
  const navigate = useNavigate();
  const { diaries, varieties, growers, findGrowerById, adminUpdateDiary, adminDeleteDiary, adminDeleteWeekReport } = useApp();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [varietyFilter, setVarietyFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', varietyId: '', stage: '', reportInterval: 'weekly' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const list = useMemo(() => diaries.filter((d) => {
    if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
    if (authorFilter !== 'all' && d.growerId !== authorFilter) return false;
    if (varietyFilter !== 'all' && d.varietyId !== varietyFilter) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [diaries, stageFilter, authorFilter, varietyFilter, search]);

  function openEdit(d) {
    setForm({ title: d.title, varietyId: d.varietyId, stage: d.stage, reportInterval: d.reportInterval || 'weekly' });
    setEditing(d);
  }

  function closeModal() {
    setEditing(null);
  }

  function field(key) {
    return { value: form[key] ?? '', onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function handleSubmit(e) {
    e.preventDefault();
    adminUpdateDiary(editing.id, form);
    closeModal();
  }

  const columns = [
    {
      key: 'cover', label: 'Обложка', render: (d) => (
        d.coverPhoto
          ? <img src={d.coverPhoto} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
          : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--soil-800)' }} />
      )
    },
    { key: 'title', label: 'Название', render: (d) => <b>{d.title}</b> },
    { key: 'author', label: 'Автор', render: (d) => findGrowerById(d.growerId)?.name || '—' },
    { key: 'variety', label: 'Сорт', render: (d) => varieties.find((v) => v.id === d.varietyId)?.name || '—' },
    { key: 'stage', label: 'Стадия' },
    { key: 'weeks', label: 'Отчётов', render: (d) => d.weeks.length },
    { key: 'likes', label: 'Лайки' },
    { key: 'startDate', label: 'Старт' }
  ];

  const confirming = confirmDeleteId ? diaries.find((d) => d.id === confirmDeleteId) : null;

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Дневники</h1>

      <div className="admin-toolbar">
        <div className="field">
          <input type="text" placeholder="Поиск по названию…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">Все стадии</option>
          {DIARY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
          <option value="all">Все авторы</option>
          {growers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={varietyFilter} onChange={(e) => setVarietyFilter(e.target.value)}>
          <option value="all">Все сорта</option>
          {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        onRowClick={openEdit}
        renderActions={(d) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/diaries/${d.id}`)}>Открыть</button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(d.id)}>Удалить</button>
          </div>
        )}
        emptyText="Дневники не найдены"
      />

      <Modal isOpen={!!editing} onClose={closeModal} wide>
        {editing && (
          <>
            <h2>Редактировать дневник</h2>
            <form onSubmit={handleSubmit}>
              <div className="field"><label>Название</label><input type="text" required {...field('title')} /></div>
              <div className="field-row">
                <div className="field">
                  <label>Сорт</label>
                  <select {...field('varietyId')}>
                    {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Стадия</label>
                  <select {...field('stage')}>
                    {DIARY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Интервал отчётов</label>
                <select {...field('reportInterval')}>
                  {REPORT_INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-block">Сохранить</button>
            </form>

            <h3 style={{ marginTop: 22 }}>Отчёты ({editing.weeks.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {editing.weeks.length === 0 && <p className="sub">Отчётов пока нет</p>}
              {editing.weeks.map((w) => (
                <div key={w.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid var(--scorch-line-soft)', borderRadius: 8 }}>
                  <span>№{w.n} · {w.title || 'Без названия'} · {w.date}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      adminDeleteWeekReport(editing.id, w.n);
                      setEditing((prev) => ({ ...prev, weeks: prev.weeks.filter((x) => x.n !== w.n) }));
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить дневник?"
        message={`Дневник «${confirming?.title}» и все его отчёты будут удалены без возможности восстановления.`}
        onConfirm={() => confirming && adminDeleteDiary(confirming.id)}
      />
    </div>
  );
}
