import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import PepperIcon from './PepperIcon.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';
import { heatColor, fmtNum, diaryMediaStyle, varietyNames, latestReportDay, communityShuDelta } from '../utils/helpers.js';

export default function DiaryCard({ diary }) {
  const { varieties, growers, diaries, toggleLikeDiary } = useApp();
  const findVariety = (id) => varieties.find((v) => v.id === id);
  const v = findVariety(diary.varietyId);
  const g = growers.find((x) => x.id === diary.growerId);
  const color = heatColor(diary.shu);
  const lastDay = latestReportDay(diary);
  const delta = communityShuDelta(diary, diaries);

  if (!v || !g) return null;

  return (
    <div className="card diary-card">
      <Link to={`/diaries/${diary.id}`} className="pod-media" style={{ ...diaryMediaStyle(diary, v, color), cursor: 'pointer' }}>
        <Badge kind="stage">{diary.stage}</Badge>
        <Badge kind="heat">{fmtNum(Math.round(diary.shu))} SHU</Badge>
        {!(diary.coverPhoto || v.photo) && <PepperIcon color={color} />}
      </Link>
      <div className="card-body">
        <Link to={`/diaries/${diary.id}`}><h3 style={{ cursor: 'pointer' }}>{diary.title}</h3></Link>
        <div className="card-meta">
          <Avatar name={g.name} size={22} />
          <span>{g.name}</span><span>·</span><span>{varietyNames(diary, findVariety)}</span>
        </div>
        {diary.desc && (
          <p style={{ fontSize: 12.5, color: 'var(--cream-dim)', lineHeight: 1.5, margin: 0 }}>
            {diary.desc.slice(0, 90)}{diary.desc.length > 90 ? '…' : ''}
          </p>
        )}
        <div className="card-tags">
          <Badge>{diary.location}</Badge>
          <Badge>{diary.medium}</Badge>
          {diary.techniques[0] && <Badge>{diary.techniques[0]}</Badge>}
        </div>
        {delta != null && Math.abs(delta) >= 3 && (
          <div className="stats-compare" style={{ marginTop: -2 }}>
            <span className={'delta ' + (delta >= 0 ? 'up' : 'down')}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
            <span className="vs-label">остроты к среднему по сорту</span>
          </div>
        )}
        <div className="card-footer">
          <div className="mini-actions">
            <span
              className={'mini-action like-action' + (diary.liked ? ' liked' : '')}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLikeDiary(diary.id); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" />
              </svg>
              <span className="like-count">{diary.likes}</span>
            </span>
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
              </svg>
              {diary.comments.length}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cream-faint)' }}>
            {lastDay != null ? `День ${lastDay}` : 'Нет отчётов'}
          </span>
        </div>
      </div>
    </div>
  );
}
