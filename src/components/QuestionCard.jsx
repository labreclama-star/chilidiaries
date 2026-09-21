import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';
import { dayCount, timeAgo } from '../utils/helpers.js';

/** Simple line-style chili glyph — used for question likes instead of the heart icon used elsewhere, per spec. */
function PepperLikeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.5 3.2c1.3.6 2.2 1.7 2.5 3" />
      <path d="M8 6.4c2.8-1.3 5.8-1 7.7 1 2 4.4 1 9.7-2.5 12.7-1.9 1.6-4 1.9-5.5.9-1.6-1-2.2-3.1-1.6-5.6.7-3.6 1-6.8 1.9-9Z" />
    </svg>
  );
}

export default function QuestionCard({ question }) {
  const { growers, diaries } = useApp();
  const g = growers.find((x) => x.id === question.growerId);
  const diary = question.diaryId ? diaries.find((d) => d.id === question.diaryId) : null;
  const days = dayCount(question.createdAt);

  return (
    <Link to={`/questions/${question.id}`} className="card" style={{ cursor: 'pointer' }}>
      {question.photo ? (
        <div className="pod-media" style={{ backgroundImage: `url('${question.photo}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <Badge kind="stage">{question.status === 'solved' ? 'Решён' : 'Открыт'}</Badge>
        </div>
      ) : null}
      <div className="card-body">
        {!question.photo && (
          <Badge variant={question.status === 'solved' ? 'leaf' : 'ember'} style={{ marginBottom: 10, display: 'inline-block' }}>
            {question.status === 'solved' ? 'Решён' : 'Открыт'}
          </Badge>
        )}
        <h3 style={{ fontSize: 16, lineHeight: 1.4 }}>
          {question.text.length > 140 ? `${question.text.slice(0, 140)}…` : question.text}
        </h3>
        <div className="card-meta">
          {g && <Avatar name={g.name} size={20} />}
          <span>{g?.name}</span>
          <span>·</span>
          <span>{timeAgo(question.createdAt)}</span>
          {days != null && <><span>·</span><span>{days} дн.</span></>}
        </div>
        <div className="card-tags" style={{ marginTop: 8 }}>
          {question.stage && <span className="tag">{question.stage}</span>}
          {question.topic && <span className="tag">{question.topic}</span>}
          {diary && <span className="tag leaf">{diary.title}</span>}
          {!diary && <span className="tag">Без дневника</span>}
        </div>
        <div className="card-footer">
          <div className="mini-actions">
            <span className="mini-action">
              <PepperLikeIcon width="16" height="16" />
              {question.likes}
            </span>
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H7l-3 3V4Z" /></svg>
              {question.answers.length}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export { PepperLikeIcon };
