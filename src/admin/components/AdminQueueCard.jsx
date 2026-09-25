import { Link } from 'react-router-dom';

/**
 * "Очередь / Модерация" — левая колонка Row 3 дашборда (Этап 2).
 *
 * items: [{
 *   id, kindLabel ('Статья' | 'Требует ответа'), kindClass ('post'|'question'),
 *   title, author, time (строка из timeAgo() или null — для статей его нет,
 *   см. переписку: у blog_posts нет created_at, показывать нечего),
 *   actions: [{ label, onClick?, to?, variant ('approve'|'reject'|'neutral') }]
 * }]
 *
 * Компонент не знает про AppContext — вся сборка/сортировка/callbacks
 * собираются в AdminDashboard.jsx, здесь только рендер.
 */
export default function AdminQueueCard({ items }) {
  if (!items || items.length === 0) {
    return <p className="sub" style={{ padding: 14 }}>Очередь пуста — всё разобрано</p>;
  }

  return (
    <div className="admin-queue-list">
      {items.map((item) => (
        <div className="admin-queue-item" key={item.id}>
          <div className="admin-queue-item-top">
            <span className={`admin-queue-pill ${item.kindClass}`}>{item.kindLabel}</span>
            {item.time && <span className="admin-queue-time">{item.time}</span>}
          </div>
          <div className="admin-queue-title">{item.title}</div>
          {item.author && <div className="admin-queue-author">{item.author}</div>}
          <div className="admin-queue-actions">
            {item.actions.map((a, i) => (
              a.to ? (
                <Link key={i} to={a.to} className={`admin-queue-btn ${a.variant}`}>{a.label}</Link>
              ) : (
                <button key={i} className={`admin-queue-btn ${a.variant}`} onClick={a.onClick}>{a.label}</button>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
