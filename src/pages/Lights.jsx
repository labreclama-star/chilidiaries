import { useApp } from '../context/AppContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Lights() {
  const { lights } = useApp();
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Оборудование</span>
          <h1>Освещение для выращивания</h1>
          <p>Подборка ламп сообщества — с рейтингами и рекомендациями по стадии роста.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="grid grid-3">
          {lights.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </>
  );
}
