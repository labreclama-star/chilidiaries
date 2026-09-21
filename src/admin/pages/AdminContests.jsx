import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';
import Avatar from '../../components/Avatar.jsx';

const emptyForm = () => ({
  title: '', desc: '', fullDesc: '', prize: '', startDate: '', deadline: '',
  status: 'upcoming', photo: null, sponsor: '', rules: '', howToJoin: ''
});

export default function AdminContests() {
  const navigate = useNavigate();
  const { contests, growers, adminAddContest, adminUpdateContest, adminDeleteContest, adminAddContestParticipant, adminRemoveContestParticipant } = useApp();

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [managing, setManaging] = useState(null); // contest whose participants are being edited
  const [addGrowerId, setAddGrowerId] = useState('');

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
      startDate: c.startDate || '', deadline: c.deadline || '', status: c.status || 'upcoming',
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

  const columns = [
    { key: 'title', label: 'Название', render: (c) => <b>{c.title}</b> },
    { key: 'prize', label: 'Приз' },
    { key: 'status', label: 'Статус', render: (c) => c.status || 'upcoming' },
    { key: 'startDate', label: 'Начало' },
    { key: 'deadline', label: 'Окончание' },
    { key: 'participants', label: 'Участников' }
  ];

  const confirming = confirmDeleteId ? contests.find((c) => c.id === confirmDeleteId) : null;
  const availableToAdd = managing ? growers.filter((g) => !managing.participantIds.includes(g.id)) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Конкурсы</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Создать конкурс</button>
      </div>

      <AdminTable
        columns={columns}
        rows={contests}
        onRowClick={openEdit}
        emptyText="Конкурсы не найдены"
        renderActions={(c) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/contests')}>Открыть</button>
            <button className="btn btn-outline btn-sm" onClick={() => setManaging(c)}>Участники</button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(c.id)}>Удалить</button>
          </div>
        )}
      />

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
            <div className="field"><label>Дата начала</label><input type="text" placeholder="1 июня 2026" {...field('startDate')} /></div>
            <div className="field"><label>Дедлайн</label><input type="text" placeholder="30 сентября 2026" {...field('deadline')} /></div>
          </div>
          <div className="field">
            <label>Статус</label>
            <select {...field('status')}>
              <option value="upcoming">Скоро стартует</option>
              <option value="active">Активен</option>
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <select value={addGrowerId} onChange={(e) => setAddGrowerId(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            <option value="">Выбери гровера…</option>
            {availableToAdd.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (!addGrowerId) return;
              adminAddContestParticipant(managing.id, addGrowerId);
              setManaging((prev) => ({ ...prev, participantIds: [...prev.participantIds, addGrowerId], participants: prev.participantIds.length + 1 }));
              setAddGrowerId('');
            }}
          >
            Добавить
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {managing && managing.participantIds.length === 0 && <p className="sub">Участников пока нет</p>}
          {managing && managing.participantIds.map((gid) => {
            const g = growers.find((x) => x.id === gid);
            if (!g) return null;
            return (
              <div key={gid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', border: '1px solid var(--scorch-line-soft)', borderRadius: 8 }}>
                <Avatar name={g.name} photo={g.avatar} size={28} />
                <span style={{ flex: 1, minWidth: 0 }}>{g.name}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    adminRemoveContestParticipant(managing.id, gid);
                    setManaging((prev) => ({ ...prev, participantIds: prev.participantIds.filter((id) => id !== gid), participants: prev.participantIds.length - 1 }));
                  }}
                >
                  Убрать
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

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
