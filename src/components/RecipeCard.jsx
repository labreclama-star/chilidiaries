import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';
import { recipeCategoryColor, podMediaStyle } from '../utils/helpers.js';

function JarIcon({ color }) {
  return (
    <svg viewBox="0 0 60 60" width="46" height="46" fill="none">
      <rect x="18" y="6" width="24" height="8" rx="2" fill={color} />
      <path d="M14 16h32l-3 34a5 5 0 0 1-5 4.5H22a5 5 0 0 1-5-4.5L14 16Z" fill={color} opacity=".85" />
      <path d="M14 16h32" stroke="var(--soil-950)" strokeWidth="2" />
    </svg>
  );
}

export default function RecipeCard({ recipe }) {
  const { varieties, growers } = useApp();
  const v = recipe.varietyId ? varieties.find((x) => x.id === recipe.varietyId) : null;
  const color = recipeCategoryColor(recipe.category);
  const g = growers.find((x) => x.id === recipe.growerId);
  const mediaStyle = recipe.photo
    ? { backgroundImage: `url('${recipe.photo}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : (v ? podMediaStyle(v, color) : { background: `radial-gradient(circle at 30% 20%,${color}33,var(--soil-900) 70%)` });

  return (
    <Link to={`/recipes/${recipe.id}`} className="card" style={{ cursor: 'pointer' }}>
      <div
        className="pod-media"
        style={{ ...mediaStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Badge kind="stage">{recipe.category}</Badge>
        {!recipe.photo && !(v && v.photo) && <JarIcon color={color} />}
      </div>
      <div className="card-body">
        <h3>{recipe.title}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>
          {recipe.desc.length > 90 ? `${recipe.desc.slice(0, 90)}…` : recipe.desc}
        </p>
        <div className="card-meta">
          {g && <Avatar name={g.name} size={20} />}
          <span>{g?.name}</span>
          {v && <><span>·</span><span>{v.name}</span></>}
        </div>
        <div className="card-footer">
          <div className="mini-actions">
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" />
              </svg>
              {recipe.likes}
            </span>
            <span className="mini-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              {recipe.views ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
