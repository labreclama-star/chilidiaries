/**
 * Универсальная таблица для CRUD-разделов админки.
 *
 * columns: [{ key, label, render?(row) }]
 * rows: массив объектов, у каждого должен быть `row[keyField]` (по умолчанию `id`)
 * renderActions?(row): произвольные кнопки-действия в последней колонке
 * onRowClick?(row): клик по строке (например, открыть модалку редактирования)
 *
 * На мобильном (см. .admin-table в index.css) заголовки прячутся, а каждая
 * <td> получает подпись через `data-label` + CSS ::before — так строка
 * превращается в карточку "поле: значение" без отдельного JSX для мобилки.
 */
export default function AdminTable({ columns, rows, keyField = 'id', onRowClick, renderActions, emptyText = 'Пока пусто' }) {
  if (!rows || rows.length === 0) {
    return <div className="admin-page-stub"><p>{emptyText}</p></div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            {renderActions && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              {renderActions && (
                <td data-label="Действия" onClick={(e) => e.stopPropagation()}>
                  {renderActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
