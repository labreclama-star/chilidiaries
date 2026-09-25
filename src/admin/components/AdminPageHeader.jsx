/**
 * Общий заголовок раздела админки (редизайн "editorial dark", Этап 1).
 *
 * Паттерн из референса: мелкая капс-подпись в разрядку ("CHILIDIARIES · OPS"),
 * под ней крупный serif-заголовок (Fraunces, уже подключён — см. --font-display
 * в index.css), под заголовком — серый абзац-описание раздела в 1-2 строки.
 *
 * Планируется постепенно заменить этим компонентом все
 * <h1 className="admin-section-title"> на 12 страницах админки — начинаем
 * с дашборда (Этап 1), остальные разделы — по мере доработки (Этапы 2-3).
 *
 * actions — необязательный слот справа от заголовка (на одной линии с ним,
 * с переносом на мобильном), для кнопок вида "+ Добавить сорт" и т.п.
 */
export default function AdminPageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="admin-page-header">
      {eyebrow && <span className="admin-eyebrow">{eyebrow}</span>}
      <div className="admin-page-header-row">
        <h1 className="admin-page-title">{title}</h1>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </div>
      {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
    </div>
  );
}
