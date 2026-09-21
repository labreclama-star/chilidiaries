import { useApp } from '../context/AppContext.jsx';
import ContestCard from '../components/ContestCard.jsx';

export default function Contests() {
  const { contests } = useApp();
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Сезон 2026</span>
          <h1>Конкурсы сообщества</h1>
          <p>Участвуй в конкурсах, публикуя отчёты в своём дневнике — победителей выбирает сообщество голосованием.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="grid grid-3">
          {contests.map((c) => <ContestCard key={c.id} contest={c} />)}
        </div>
      </div>
    </>
  );
}
