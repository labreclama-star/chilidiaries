import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import ArticleCard from '../components/ArticleCard.jsx';

export default function Blog() {
  const { blogPosts, currentUser, openModal, showToast } = useApp();
  const [searchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag');

  let visible = blogPosts.filter((p) => p.status === 'approved' || (currentUser && p.growerId === currentUser.growerId));
  if (tagFilter) visible = visible.filter((p) => p.tags.includes(tagFilter));
  const sorted = visible.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  function handleWriteArticle() {
    if (!currentUser) { showToast('Войди, чтобы написать статью'); openModal('auth'); return; }
    openModal('writeArticle');
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">{tagFilter ? `Тег: ${tagFilter}` : 'Знания сообщества'}</span>
            <h1>{tagFilter ? `Статьи с тегом «${tagFilter}»` : 'Блог о выращивании острого перца'}</h1>
            <p>{tagFilter ? 'Все статьи сообщества с этим тегом.' : 'Гайды, разборы сортов и практические статьи от гроверов ChiliDiaries — пиши свою и делись опытом.'}</p>
            {tagFilter && <Link to="/blog" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>← Все статьи</Link>}
          </div>
          <button className="btn btn-primary" onClick={handleWriteArticle}>✎ Написать статью</button>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <p>Статей пока нет.</p>
          </div>
        ) : (
          <div className="grid grid-3">
            {sorted.map((p) => <ArticleCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </>
  );
}
