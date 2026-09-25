/**
 * "Сейчас / Лента событий" — правая колонка Row 3 (Этап 2).
 *
 * events: [{ id, title, detail, date (Date) }], топ-8 по date desc — собирается
 * в AdminDashboard.jsx из diaries (startDate) + growers (joinedAt). Комментарии
 * сюда не включены: в AppContext их нет отдельным плоским массивом (только
 * вложенными в полный дневник после getDiaryById) — договорились не показывать
 * их в этой итерации.
 */
export default function AdminEventFeed({ events }) {
  return (
    <div>
      <div className="admin-feed-live">
        <span className="admin-feed-live-dot" aria-hidden="true" />
        ЖИВО
      </div>
      {(!events || events.length === 0) ? (
        <p className="sub" style={{ padding: '10px 0' }}>Пока нет событий</p>
      ) : (
        <div className="admin-feed">
          {events.map((e) => (
            <div className="admin-feed-item" key={e.id}>
              <span className="admin-feed-dot" aria-hidden="true" />
              <div>
                <div className="admin-feed-title">{e.title}</div>
                {e.detail && <div className="admin-feed-detail">{e.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
