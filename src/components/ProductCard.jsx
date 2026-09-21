import PepperIcon from './PepperIcon.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17l-6.1 3.5 1.5-6.8L2.2 9l6.9-.7L12 2Z" />
    </svg>
  );
}

export default function ProductCard({ product }) {
  const { showToast } = useApp();
  return (
    <div className="card product-card">
      <div className="pod-media" style={{ background: 'radial-gradient(circle at 30% 20%,#F2A93B33,var(--soil-900) 70%)' }}>
        <Badge kind="stage">{product.tag}</Badge>
        <PepperIcon color="#F2A93B" />
      </div>
      <div className="card-body">
        <h3>{product.name}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>{product.desc}</p>
        <div className="price-row">
          <span className="price">{product.price}</span>
          <span className="rating"><StarIcon /> {product.rating}</span>
        </div>
        <button className="btn btn-outline btn-block btn-sm" onClick={() => showToast('Карточка товара — демо-режим')}>
          Подробнее
        </button>
      </div>
    </div>
  );
}
