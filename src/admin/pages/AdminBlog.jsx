import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';

const emptyForm = () => ({ title: '', varietyId: '', tags: '', content: '', photo: null });

const STATUS_LABELS = { pending: 'На модерации', approved: 'Опубликована', rejected: 'Отклонена' };

export default function AdminBlog() {
  const navigate = useNavigate();
  const { blogPosts, varieties, findGrowerById, adminAddBlogPost, adminUpdateBlogPost, adminDeleteBlogPost, adminModerateBlogPost } = useApp();

  const [statusFilter, setStatusFilter] = useState('pending');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // post being rejected
  const [rejectReason, setRejectReason] = useState('');

  const list = useMemo(() => (
    statusFilter === 'all' ? blogPosts : blogPosts.filter((p) => p.status === statusFilter)
  ), [blogPosts, statusFilter]);

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

  function openEdit(p) {
    setForm({ title: p.title, varietyId: p.varietyId || '', tags: (p.tags || []).join(', '), content: (p.content || []).join('\n'), photo: p.photo || null });
    setEditing(p);
  }

  function closeModal() {
    setEditing(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const paragraphs = form.content.split('\n').map((s) => s.trim()).filter(Boolean);
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
    const payload = { title: form.title, varietyId: form.varietyId || null, tags, content: paragraphs, photo: form.photo };
    if (editing && editing.id) {
      adminUpdateBlogPost(editing.id, { ...payload, excerpt: paragraphs[0] ? paragraphs[0].slice(0, 140) : '' });
    } else {
      adminAddBlogPost(payload);
    }
    closeModal();
  }

  function submitReject(e) {
    e.preventDefault();
    adminModerateBlogPost(rejecting.id, 'rejected', rejectReason);
    setRejecting(null);
    setRejectReason('');
  }

  const columns = [
    {
      key: 'photo', label: 'Обложка', render: (p) => (
        p.photo ? <img src={p.photo} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--soil-800)' }} />
      )
    },
    { key: 'title', label: 'Заголовок', render: (p) => <b>{p.title}</b> },
    { key: 'author', label: 'Автор', render: (p) => findGrowerById(p.growerId)?.name || 'admin' },
    { key: 'status', label: 'Статус', render: (p) => <span className={'tag' + (p.status === 'approved' ? ' leaf' : p.status === 'rejected' ? ' ember' : '')}>{STATUS_LABELS[p.status] || p.status}</span> },
    { key: 'date', label: 'Дата' },
    { key: 'likes', label: 'Лайки' },
    { key: 'views', label: 'Просмотры' }
  ];

  const confirming = confirmDeleteId ? blogPosts.find((p) => p.id === confirmDeleteId) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Блог</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Написать статью</button>
      </div>

      <div className="admin-toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">На модерации</option>
          <option value="approved">Опубликованные</option>
          <option value="rejected">Отклонённые</option>
          <option value="all">Все статьи</option>
        </select>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        onRowClick={openEdit}
        emptyText="Статьи не найдены"
        renderActions={(p) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/blog/${p.id}`)}>Открыть</button>
            {p.status !== 'approved' && (
              <button className="btn btn-outline btn-sm" onClick={() => adminModerateBlogPost(p.id, 'approved')}>Одобрить</button>
            )}
            {p.status !== 'rejected' && (
              <button className="btn btn-outline btn-sm" onClick={() => { setRejecting(p); setRejectReason(''); }}>Отклонить</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(p.id)}>Удалить</button>
          </div>
        )}
      />

      <Modal isOpen={!!editing} onClose={closeModal} wide>
        <h2>{editing && editing.id ? 'Редактировать статью' : 'Написать статью'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Заголовок</label><input type="text" required {...field('title')} /></div>
          <div className="field-row">
            <div className="field">
              <label>Сорт (необязательно)</label>
              <select {...field('varietyId')}>
                <option value="">— не привязана —</option>
                {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Теги через запятую</label><input type="text" {...field('tags')} /></div>
          </div>
          <div className="field"><label>Текст статьи (каждый абзац — с новой строки)</label><textarea rows="6" required {...field('content')} /></div>
          <div className="field"><label>Обложка статьи</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
          {form.photo && (
            <div style={{ marginBottom: 6 }}>
              <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '16px 4px 16px 4px' }} />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block">{editing && editing.id ? 'Сохранить' : 'Опубликовать статью'}</button>
        </form>
      </Modal>

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)}>
        <h2>Отклонить статью</h2>
        <p className="sub">«{rejecting?.title}»</p>
        <form onSubmit={submitReject}>
          <div className="field"><label>Причина (необязательно)</label><textarea rows="3" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary btn-block">Отклонить</button>
        </form>
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить статью?"
        message={`Статья «${confirming?.title}» будет удалена без возможности восстановления.`}
        onConfirm={() => confirming && adminDeleteBlogPost(confirming.id)}
      />
    </div>
  );
}
