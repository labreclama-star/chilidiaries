import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';
import { QUESTION_STAGES, QUESTION_TOPICS } from '../../utils/helpers.js';

export default function AdminQuestions() {
  const navigate = useNavigate();
  const { questions, findGrowerById, adminUpdateQuestion, adminDeleteQuestion, adminAnswerQuestion, markSolved } = useApp();

  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ text: '', stage: '', topic: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [answering, setAnswering] = useState(null);
  const [answerText, setAnswerText] = useState('');

  const list = useMemo(() => questions.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (topicFilter !== 'all' && q.topic !== topicFilter) return false;
    return true;
  }), [questions, statusFilter, topicFilter]);

  function openEdit(q) {
    setForm({ text: q.text, stage: q.stage || '', topic: q.topic || '' });
    setEditing(q);
  }

  function field(key) {
    return { value: form[key] ?? '', onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function handleSubmit(e) {
    e.preventDefault();
    adminUpdateQuestion(editing.id, { text: form.text, stage: form.stage || null, topic: form.topic || null });
    setEditing(null);
  }

  function submitAnswer(e) {
    e.preventDefault();
    if (!answerText.trim()) return;
    adminAnswerQuestion(answering.id, answerText.trim());
    setAnswering(null);
    setAnswerText('');
  }

  const columns = [
    { key: 'text', label: 'Текст', render: (q) => <span title={q.text}>{q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text}</span> },
    { key: 'author', label: 'Автор', render: (q) => findGrowerById(q.growerId)?.name || '—' },
    { key: 'stage', label: 'Стадия', render: (q) => q.stage || '—' },
    { key: 'topic', label: 'Тема', render: (q) => q.topic || '—' },
    { key: 'status', label: 'Статус', render: (q) => <span className={'tag' + (q.status === 'solved' ? ' leaf' : '')}>{q.status === 'solved' ? 'Решён' : 'Открыт'}</span> },
    { key: 'answers', label: 'Ответов', render: (q) => q.answers.length },
    { key: 'likes', label: 'Лайки' }
  ];

  const confirming = confirmDeleteId ? questions.find((q) => q.id === confirmDeleteId) : null;

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Вопросы</h1>

      <div className="admin-toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Все статусы</option>
          <option value="open">Открытые</option>
          <option value="solved">Решённые</option>
        </select>
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          <option value="all">Все темы</option>
          {QUESTION_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        onRowClick={openEdit}
        emptyText="Вопросы не найдены"
        renderActions={(q) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/questions/${q.id}`)}>Открыть</button>
            <button className="btn btn-outline btn-sm" onClick={() => markSolved(q.id)}>{q.status === 'solved' ? 'Открыть снова' : 'Решён'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAnswering(q); setAnswerText(''); }}>Ответить</button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(q)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(q.id)}>Удалить</button>
          </div>
        )}
      />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)}>
        <h2>Редактировать вопрос</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Текст вопроса</label><textarea rows="4" required {...field('text')} /></div>
          <div className="field-row">
            <div className="field">
              <label>Стадия</label>
              <select {...field('stage')}>
                <option value="">— не выбрана —</option>
                {QUESTION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Тема</label>
              <select {...field('topic')}>
                <option value="">— не выбрана —</option>
                {QUESTION_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block">Сохранить</button>
        </form>
      </Modal>

      <Modal isOpen={!!answering} onClose={() => setAnswering(null)}>
        <h2>Ответить от имени администратора</h2>
        <p className="sub">«{answering?.text.slice(0, 100)}{answering?.text.length > 100 ? '…' : ''}»</p>
        <form onSubmit={submitAnswer}>
          <div className="field"><label>Ответ</label><textarea rows="4" required value={answerText} onChange={(e) => setAnswerText(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary btn-block">Опубликовать ответ</button>
        </form>
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить вопрос?"
        message="Вопрос и все ответы к нему будут удалены без возможности восстановления."
        onConfirm={() => confirming && adminDeleteQuestion(confirming.id)}
      />
    </div>
  );
}
