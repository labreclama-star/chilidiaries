/**
 * Одна крупная карточка метрики для Row 1 дашборда (редизайн "editorial dark",
 * Этап 2). Показывает крупное serif-число, капс-подпись сверху и, если
 * `deltaPct` передан (не null/undefined), строку вида "↗ +12% к прошлому
 * периоду" — зелёную при росте, оранжевую при падении.
 *
 * Если `deltaPct` не передан (например, для "На модерации" — у blog_posts
 * нет created_at, честный % посчитать нечем, см. переписку по Этапу 2),
 * строка delta не рендерится вовсе — карточка просто показывает число.
 *
 * @param {{label: string, value: number, deltaPct?: number|null}} props
 */
export default function AdminMetricCard({ label, value, deltaPct = null }) {
  const hasDelta = deltaPct !== null && deltaPct !== undefined;
  const trend = hasDelta ? (deltaPct >= 0 ? 'up' : 'down') : null;

  return (
    <div className={`admin-metric-card${trend ? ` ${trend}` : ''}`}>
      <div className="admin-metric-top">
        <span className="admin-metric-lbl">{label}</span>
        <span className="admin-metric-slash" aria-hidden="true">/</span>
      </div>
      <div className="admin-metric-val">{value}</div>
      {hasDelta && (
        <div className={`admin-metric-delta ${trend}`}>
          {trend === 'up' ? '↗' : '↘'} {deltaPct > 0 ? '+' : ''}{deltaPct}% к прошлому периоду
        </div>
      )}
    </div>
  );
}
