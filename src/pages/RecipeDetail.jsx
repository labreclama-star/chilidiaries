import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import PhotoFrame from '../components/PhotoFrame.jsx';

export default function RecipeDetail() {
  const { id } = useParams();
  const {
    recipes, varieties, growers, currentUser,
    toggleLikeRecipe, incrementRecipeViews, toggleSaveRecipe, savedRecipeIds,
    toggleFollowGrower, showToast
  } = useApp();
  const r = recipes.find((x) => x.id === id);
  const countedRef = useRef(null);

  useEffect(() => {
    if (r && countedRef.current !== r.id) {
      countedRef.current = r.id;
      incrementRecipeViews(r.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);

  if (!r) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 760 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Рецепт не найден.</p>
          <Link to="/recipes" className="btn btn-outline" style={{ marginTop: 16 }}>← Все рецепты</Link>
        </div>
      </div>
    );
  }

  const v = r.varietyId ? varieties.find((x) => x.id === r.varietyId) : null;
  const g = growers.find((x) => x.id === r.growerId);
  const isSaved = savedRecipeIds.includes(r.id);
  const isOwnRecipe = !!(currentUser && currentUser.growerId === r.growerId);

  function handleShare() {
    showToast('Ссылка на рецепт скопирована в буфер обмена', 'success');
  }

  return (
    <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70, maxWidth: 760 /* бока — из .wrap */ }}>
      {/* Фото целиком (letterbox на размытой подложке), а не cover — иначе обрезалось сверху и снизу */}
      {r.photo && <div className="diary-hero-media"><PhotoFrame src={r.photo} /></div>}

      <span className="eyebrow">{r.category}</span>
      <h1 className="detail-title" style={{ margin: '12px 0 16px' }}>{r.title}</h1>

      <div className="diary-title-row" style={{ marginBottom: 0 }}>
        <Link to={g ? `/growers/${g.id}` : '#'} className="grower-line" style={{ textDecoration: 'none', marginBottom: 0 }}>
          <Avatar name={g ? g.name : 'Гровер'} photo={g?.avatar} size={34} online={g?.online} showOnline />
          <div><b>{g ? g.name : 'Гровер'}</b><span>{v ? `На основе ${v.name}` : 'Рецепт сообщества'}</span></div>
        </Link>
        {g && !isOwnRecipe && (
          <button
            className={'btn btn-outline btn-sm' + (g._followed ? ' active' : '')}
            onClick={() => toggleFollowGrower(g.id)}
          >
            {g._followed ? '✓ Подписан' : '+ Подписаться'}
          </button>
        )}
      </div>

      <p style={{ color: 'var(--cream-dim)', fontSize: 15, lineHeight: 1.6, margin: '22px 0 26px' }}>{r.desc}</p>

      <div className="side-card">
        <h4>Ингредиенты</h4>
        <ul style={{ paddingLeft: 18, color: 'var(--cream-dim)', fontSize: 14, lineHeight: 2 }}>
          {r.ingredients.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      </div>
      <div className="side-card">
        <h4>Приготовление</h4>
        <ol style={{ paddingLeft: 18, color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.9 }}>
          {r.steps.map((s, idx) => <li key={idx} style={{ marginBottom: 8 }}>{s}</li>)}
        </ol>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 0', borderTop: '1px solid var(--scorch-line-soft)', borderBottom: '1px solid var(--scorch-line-soft)', marginBottom: 24 }}>
        <div className="mini-actions" style={{ gap: 20 }}>
          <span className={'mini-action like-action' + (r.liked ? ' liked' : '')} style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => toggleLikeRecipe(r.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" /></svg>
            {r.likes}
          </span>
          <span className="mini-action" style={{ fontSize: 14 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            {r.views ?? 0} просмотров
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'btn btn-outline btn-sm' + (isSaved ? ' active' : '')} onClick={() => toggleSaveRecipe(r.id)}>
            {isSaved ? '✓ Сохранено' : '🔖 Сохранить'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleShare}>Поделиться</button>
        </div>
      </div>

      <Link to="/recipes" className="btn btn-outline">← Все рецепты</Link>
    </div>
  );
}
