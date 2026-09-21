import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Comment from '../components/Comment.jsx';
import Badge from '../components/Badge.jsx';
import { PepperLikeIcon } from '../components/QuestionCard.jsx';
import { dayCount, timeAgo } from '../utils/helpers.js';

export default function QuestionDetail() {
  const { id } = useParams();
  const {
    questions, growers, diaries, currentUser,
    toggleLikeQuestion, addAnswer, markSolved, showToast
  } = useApp();
  const q = questions.find((x) => x.id === id);
  const [tab, setTab] = useState('all');
  const [answerText, setAnswerText] = useState('');

  if (!q) {
    return (
      <div className="wrap" style={{ padding: '60px 0', maxWidth: 760 }}>
        <div className="empty-state">
          <p>Вопрос не найден.</p>
          <Link to="/questions" className="btn btn-outline" style={{ marginTop: 16 }}>← Все вопросы</Link>
        </div>
      </div>
    );
  }

  const g = growers.find((x) => x.id === q.growerId);
  const diary = q.diaryId ? diaries.find((d) => d.id === q.diaryId) : null;
  const isOwner = !!(currentUser && currentUser.growerId === q.growerId);
  const days = dayCount(q.createdAt);

  function handleSubmitAnswer() {
    const text = answerText.trim();
    if (!text) return;
    addAnswer(q.id, text);
    setAnswerText('');
  }

  function handleShare() {
    showToast('Ссылка на вопрос скопирована в буфер обмена', 'success');
  }

  const showProblem = tab === 'all' || tab === 'problem';
  const showAnswers = tab === 'all' || tab === 'comments';

  return (
    <div className="wrap" style={{ padding: '36px 0 70px', maxWidth: 760 }}>
      <div className="tab-row">
        <button className={'tab-btn' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>Все</button>
        <button className={'tab-btn' + (tab === 'problem' ? ' active' : '')} onClick={() => setTab('problem')}>Описание проблемы</button>
        <button className={'tab-btn' + (tab === 'comments' ? ' active' : '')} onClick={() => setTab('comments')}>Комментарии от пользователей</button>
      </div>

      {showProblem && (
        <>
          {q.photo && <div className="diary-hero-media" style={{ backgroundImage: `url('${q.photo}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Badge variant={q.status === 'solved' ? 'leaf' : 'ember'}>{q.status === 'solved' ? 'Решён' : 'Открыт'}</Badge>
            {q.stage && <span className="tag">{q.stage}</span>}
            {q.topic && <span className="tag">{q.topic}</span>}
            {diary ? <Link to={`/diaries/${diary.id}`} className="tag leaf">{diary.title}</Link> : <span className="tag">Без дневника</span>}
          </div>

          <p style={{ fontSize: 17, lineHeight: 1.6, margin: '0 0 20px' }}>{q.text}</p>

          <div className="diary-title-row" style={{ marginBottom: 20 }}>
            <Link to={g ? `/growers/${g.id}` : '#'} className="grower-line" style={{ textDecoration: 'none', marginBottom: 0 }}>
              <Avatar name={g ? g.name : 'Гровер'} photo={g?.avatar} size={34} online={g?.online} showOnline />
              <div><b>{g ? g.name : 'Гровер'}</b><span>{timeAgo(q.createdAt)}{days != null ? ` · ${days} дн. назад` : ''}</span></div>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 0', borderTop: '1px solid var(--scorch-line-soft)', borderBottom: '1px solid var(--scorch-line-soft)', marginBottom: 24 }}>
            <div className="mini-actions" style={{ gap: 20 }}>
              <span className={'mini-action like-action' + (q.liked ? ' liked' : '')} style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => toggleLikeQuestion(q.id)}>
                <PepperLikeIcon width="18" height="18" />
                {q.likes}
              </span>
              <span className="mini-action" style={{ fontSize: 14 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H7l-3 3V4Z" /></svg>
                {q.answers.length} ответов
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isOwner && (
                <button className={'btn btn-outline btn-sm' + (q.status === 'solved' ? ' active' : '')} onClick={() => markSolved(q.id)}>
                  {q.status === 'solved' ? '✓ Решено' : 'Отметить решённым'}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={handleShare}>Поделиться</button>
            </div>
          </div>
        </>
      )}

      {showAnswers && (
        <div className="comments-block">
          <h2 style={{ fontSize: 22, marginBottom: 20 }}>Комментарии от пользователей ({q.answers.length})</h2>
          {q.answers.length
            ? q.answers.map((a) => <Comment key={a.id} comment={{ author: a.author, text: a.text, time: timeAgo(a.createdAt) }} />)
            : <p style={{ color: 'var(--cream-dim)', fontSize: 14, marginBottom: 16 }}>Пока никто не ответил — будь первым.</p>}
          <div className="comment-form">
            <Avatar name={currentUser ? currentUser.name : 'Гость'} size={34} />
            <textarea
              placeholder={currentUser ? 'Поделись советом или предположением…' : 'Войди, чтобы ответить…'}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSubmitAnswer}>Ответить</button>
          </div>
        </div>
      )}

      <Link to="/questions" className="btn btn-outline" style={{ marginTop: 8 }}>← Все вопросы</Link>
    </div>
  );
}
