import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import PhotoFrame from '../components/PhotoFrame.jsx';

export default function BlogDetail() {
  const { id } = useParams();
  const { blogPosts, growers, currentUser, toggleLikeBlogPost, incrementBlogViews, showToast } = useApp();
  const p = blogPosts.find((x) => x.id === id);
  const countedRef = useRef(null);

  useEffect(() => {
    if (p && countedRef.current !== p.id) {
      countedRef.current = p.id;
      incrementBlogViews(p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  if (!p) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 760 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Статья не найдена.</p>
          <Link to="/blog" className="btn btn-outline" style={{ marginTop: 16 }}>← Все статьи</Link>
        </div>
      </div>
    );
  }

  const isOwner = !!(currentUser && currentUser.growerId === p.growerId);
  if (p.status === 'pending' && !isOwner) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 760 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Эта статья ещё на модерации и пока не опубликована.</p>
          <Link to="/blog" className="btn btn-outline" style={{ marginTop: 16 }}>← Все статьи</Link>
        </div>
      </div>
    );
  }

  const g = growers.find((x) => x.id === p.growerId);

  function handleShare() {
    showToast('Ссылка на статью скопирована в буфер обмена', 'success');
  }

  return (
    <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70, maxWidth: 760 /* бока — из .wrap */ }}>
      {p.status === 'pending' && isOwner && (
        <div className="side-card" style={{ marginBottom: 20, borderColor: 'var(--habanero-dim)' }}>
          <span style={{ color: 'var(--habanero)', fontSize: 13, fontWeight: 600 }}>⏳ Статья на модерации — видна только тебе, пока модератор её не одобрит.</span>
        </div>
      )}
      {/* Обложка целиком (letterbox на размытой подложке), а не cover — иначе фото обрезалось */}
      {p.photo && <div className="diary-hero-media"><PhotoFrame src={p.photo} /></div>}
      <div className="card-tags" style={{ marginBottom: 14 }}>
        {p.tags.map((t) => (
          <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} style={{ textDecoration: 'none' }}>
            <Badge variant="ember">{t}</Badge>
          </Link>
        ))}
      </div>
      <h1 className="detail-title" style={{ marginBottom: 14 }}>{p.title}</h1>
      <Link to={g ? `/growers/${g.id}` : '#'} className="grower-line" style={{ textDecoration: 'none' }}>
        <Avatar name={g ? g.name : 'ChiliDiaries'} size={34} />
        <div>
          <b>{g ? g.name : 'ChiliDiaries'}</b>
          <span>{new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </Link>
      <div style={{ color: 'var(--cream-dim)', fontSize: 15.5, lineHeight: 1.85, margin: '26px 0' }}>
        {p.content.map((par, idx) => <p key={idx} style={{ marginBottom: 18 }}>{par}</p>)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 0', borderTop: '1px solid var(--scorch-line-soft)', borderBottom: '1px solid var(--scorch-line-soft)', marginBottom: 24 }}>
        <div className="mini-actions" style={{ gap: 20 }}>
          <span className={'mini-action like-action' + (p.liked ? ' liked' : '')} style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => toggleLikeBlogPost(p.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" /></svg>
            {p.likes}
          </span>
          <span className="mini-action" style={{ fontSize: 14 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            {p.views} просмотров
          </span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleShare}>Поделиться</button>
      </div>

      <Link to="/blog" className="btn btn-outline">← Все статьи</Link>
    </div>
  );
}
