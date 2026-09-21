import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import FeedItem from '../components/FeedItem.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import { buildFeedItems, recommendDiaries } from '../utils/helpers.js';

export default function Feed() {
  const { currentUser, growers, diaries, varieties, openModal } = useApp();

  if (!currentUser) {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' /* бока — из .wrap */ }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}>Лента</span>
        <h1 style={{ margin: '14px 0 10px' }}>Твоя лента обновлений</h1>
        <p style={{ color: 'var(--cream-dim)', marginBottom: 26 }}>Войди, чтобы подписываться на гроверов и видеть их обновления здесь.</p>
        <button className="btn btn-primary" onClick={() => openModal('auth')}>Войти / Зарегистрироваться</button>
      </div>
    );
  }

  const followedGrowerIds = growers.filter((g) => g._followed).map((g) => g.id);
  const feedItems = buildFeedItems(followedGrowerIds, diaries);

  const myDiaries = diaries.filter((d) => d.growerId === currentUser.growerId);
  const recommended = recommendDiaries(myDiaries, diaries, varieties, [...followedGrowerIds, currentUser.growerId]).slice(0, 3);

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Сообщество</span>
          <h1>Лента</h1>
          <p>Свежие отчёты гроверов, на которых ты подписан.</p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        {feedItems.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 50 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4v3a13 13 0 0 1 13 13h3C20 11.9 12.1 4 4 4Z" /><path d="M4 11v3a6 6 0 0 1 6 6h3a9 9 0 0 0-9-9Z" /><circle cx="6" cy="18" r="1.6" /></svg>
            <p>Начните следить за людьми, чтобы видеть обновления здесь.<br />Откройте для себя контент, который вдохновляет вас.</p>
            <Link to="/growers" className="btn btn-primary" style={{ marginTop: 16 }}>Найти гроверов</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 50 }}>
            {feedItems.map(({ diary, week }) => (
              <FeedItem key={`${diary.id}-${week.n}`} diary={diary} week={week} />
            ))}
          </div>
        )}

        {recommended.length > 0 && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Рекомендации для тебя</h2>
            <p style={{ fontSize: 13, color: 'var(--cream-faint)', marginBottom: 20 }}>
              Похоже на сорта, которые ты уже выращиваешь.
            </p>
            <div className="grid grid-3">
              {recommended.map((d) => <DiaryCard key={d.id} diary={d} />)}
            </div>
          </>
        )}
      </div>
    </>
  );
}
