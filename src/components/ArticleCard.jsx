import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import PepperIcon from './PepperIcon.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';
import { heatColor } from '../utils/helpers.js';

export default function ArticleCard({ post }) {
  const { varieties, growers } = useApp();
  const v = post.varietyId ? varieties.find((x) => x.id === post.varietyId) : null;
  const color = v ? heatColor((v.shuMin + v.shuMax) / 2) : '#F2A93B';
  const g = growers.find((x) => x.id === post.growerId);
  const mediaStyle = post.photo
    ? { backgroundImage: `url('${post.photo}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `radial-gradient(circle at 30% 20%,${color}33,var(--soil-900) 70%)` };

  return (
    <div className="card">
      <Link to={`/blog/${post.id}`} className="pod-media" style={{ ...mediaStyle, cursor: 'pointer' }}>
        {post.status === 'pending' && <Badge kind="stage">На модерации</Badge>}
        {!post.photo && <PepperIcon color={color} />}
      </Link>
      <div className="card-body">
        <Link to={`/blog/${post.id}`}><h3 style={{ cursor: 'pointer' }}>{post.title}</h3></Link>
        <p style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>{post.excerpt}</p>
        <div className="card-tags">
          {post.tags.slice(0, 3).map((t) => (
            <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="tag-link" style={{ textDecoration: 'none' }}>
              <Badge>{t}</Badge>
            </Link>
          ))}
        </div>
        <Link to={g ? `/growers/${g.id}` : '#'} className="card-meta" style={{ marginTop: 4, textDecoration: 'none', width: 'fit-content' }}>
          <Avatar name={g ? g.name : 'Автор'} size={20} />
          <span>{g ? g.name : 'ChiliDiaries'}</span>
        </Link>
        <div className="card-footer">
          <div className="mini-actions">
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" /></svg>
              {post.likes}
            </span>
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              {post.views}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
