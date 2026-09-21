import { useApp } from '../context/AppContext.jsx';
import GrowerCard from '../components/GrowerCard.jsx';

export default function Growers() {
  const { growers } = useApp();
  const visible = growers.filter((g) => !g.deleted);
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Сообщество</span>
          <h1>Гроверы ChiliDiaries</h1>
          <p>Подписывайся на гроверов, чтобы следить за их дневниками и не пропускать новые отчёты.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="grid grid-4">
          {visible.map((g) => <GrowerCard key={g.id} grower={g} />)}
        </div>
      </div>
    </>
  );
}
