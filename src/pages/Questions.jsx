import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import FilterBar, { FilterChip } from '../components/FilterBar.jsx';
import { QUESTION_STAGES, QUESTION_TOPICS } from '../utils/helpers.js';

const NEW_WITHIN_DAYS = 2;

function buildFilters(currentUser) {
  return [
    { value: 'all', label: 'Все', test: () => true },
    { value: 'new', label: 'Новые', test: (q) => Date.now() - new Date(q.createdAt).getTime() <= NEW_WITHIN_DAYS * 86400000 },
    { value: 'open', label: 'Открытые', test: (q) => q.status === 'open' },
    { value: 'solved', label: 'Решённые', test: (q) => q.status === 'solved' },
    { value: 'no-diary', label: 'Без дневника', test: (q) => !q.diaryId },
    ...QUESTION_STAGES.map((s) => ({ value: 'stage:' + s, label: s, test: (q) => q.stage === s })),
    { value: 'mine', label: 'Мои вопросы', test: (q) => !!currentUser && q.growerId === currentUser.growerId },
    { value: 'my-answers', label: 'Мои ответы', test: (q) => !!currentUser && q.answers.some((a) => a.author === currentUser.name) },
    ...QUESTION_TOPICS.map((t) => ({ value: 'topic:' + t, label: t === 'Другое' ? 'Другие' : t, test: (q) => q.topic === t }))
  ];
}

export default function Questions() {
  const { questions, currentUser, openModal, showToast } = useApp();
  const [active, setActive] = useState('all');

  const filters = useMemo(() => buildFilters(currentUser), [currentUser]);

  const list = useMemo(() => {
    const filter = filters.find((f) => f.value === active) || filters[0];
    return questions.filter(filter.test).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [questions, filters, active]);

  function handleAsk() {
    if (!currentUser) { showToast('Войди, чтобы задать вопрос'); openModal('auth'); return; }
    openModal('askQuestion');
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Сообщество отвечает</span>
            <h1>Вопросы: разбираемся вместе</h1>
            <p>Застрял с проблемой на кусте? Спроси сообщество — фото и пара слов достаточно, чтобы получить дельный совет.</p>
          </div>
          <button className="btn btn-primary" onClick={handleAsk}>+ Задать вопрос</button>
        </div>
      </div>
      <div className="wrap">
        <FilterBar resultsLabel={`${list.length} вопросов`}>
          {filters.map((f) => (
            <FilterChip key={f.value} active={active === f.value} onClick={() => setActive(f.value)}>
              {f.label}
            </FilterChip>
          ))}
        </FilterBar>
        {list.length ? (
          <div className="grid grid-3">
            {list.map((q) => <QuestionCard key={q.id} question={q} />)}
          </div>
        ) : (
          <div className="empty-state">
            <p>Здесь пока пусто — попробуй другой фильтр{!currentUser && ' или войди в аккаунт'}.</p>
          </div>
        )}
      </div>
    </>
  );
}
