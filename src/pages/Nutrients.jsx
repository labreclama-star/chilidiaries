import { useApp } from '../context/AppContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Nutrients() {
  const { nutrients } = useApp();
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Оборудование</span>
          <h1>Удобрения и добавки</h1>
          <p>Что используют гроверы сообщества на разных стадиях — от старта до налива стручков.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="grid grid-3">
          {nutrients.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </>
  );
}
