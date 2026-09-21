import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';
import { fmtNum } from '../utils/helpers.js';

/**
 * "Экспорт дневника в PDF" — не тянем в проект отдельную библиотеку вроде
 * jsPDF (лишний вес и рантайм-канвас-рендеринг ради, по сути, одной кнопки),
 * а собираем красиво свёрстанный отчёт и отдаём его нативному диалогу
 * печати браузера (`window.print()`) — в нём у пользователя уже есть
 * полноценный предпросмотр страниц и пункт "Сохранить как PDF" во всех
 * современных браузерах. Модалка ниже и есть тот самый предпросмотр
 * (то, что видно на экране, один в один пойдёт в PDF благодаря
 * `@media print` в index.css, которая на печати показывает только
 * #diary-print-area и прячет всё остальное).
 */
export default function DiaryReportModal() {
  const { activeModal, modalPayload, closeModal, diaries, varieties, growers } = useApp();
  const isOpen = activeModal === 'diaryReport';
  const d = modalPayload ? diaries.find((x) => x.id === modalPayload.diaryId) : null;
  const v = d ? varieties.find((x) => x.id === d.varietyId) : null;
  const g = d ? growers.find((x) => x.id === d.growerId) : null;

  function handlePrint() {
    window.print();
  }

  return (
    <Modal isOpen={isOpen && !!d && !!v && !!g} onClose={closeModal} wide>
      {d && v && g && (
        <>
          <div className="report-toolbar">
            <div>
              <span className="eyebrow">Предпросмотр отчёта</span>
              <h2 style={{ margin: '6px 0 0' }}>Отчёт за сезон</h2>
            </div>
            <button className="btn btn-primary" onClick={handlePrint}>⭳ Скачать PDF</button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--cream-faint)', margin: '8px 0 20px' }}>
            Откроется диалог печати браузера — выбери принтер «Сохранить как PDF» (или аналог в твоём браузере),
            чтобы получить файл.
          </p>

          <div id="diary-print-area" className="diary-report">
            <div className="diary-report-header">
              <div>
                <div className="diary-report-brand">🌶 ChiliDiaries</div>
                <h1>{d.title}</h1>
                <p className="diary-report-sub">
                  {v.name} · {g.name} · {d.location}, {d.medium}
                </p>
              </div>
              <div className="diary-report-date">
                Сформировано {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {d.desc && <p className="diary-report-desc">{d.desc}</p>}

            <div className="diary-report-stats">
              <div><label>Старт</label><strong>{new Date(d.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
              <div><label>Текущий этап</label><strong>{d.stage}</strong></div>
              <div><label>Отчётов</label><strong>{d.weeks.length}</strong></div>
              <div><label>SHU сорта</label><strong>{fmtNum(Math.round(d.shu))}</strong></div>
              <div><label>Лайков</label><strong>{d.likes}</strong></div>
              <div><label>Подписчиков дневника</label><strong>{d.followers}</strong></div>
            </div>

            <h3 className="diary-report-section-title">Хронология роста</h3>
            <div className="diary-report-timeline">
              {d.weeks.map((w) => (
                <div className="diary-report-week" key={w.n}>
                  <div className="diary-report-week-head">
                    <b>День {w.day} · {w.title}</b>
                    <span>{w.date} · {w.stage}</span>
                  </div>
                  <p>{w.note}</p>
                  <div className="diary-report-week-meta">🌡 {w.temp}°C · 💧 {w.hum}%</div>
                  {w.photos && w.photos.length > 0 && (
                    <div className="diary-report-photos">
                      {w.photos.map((src, i) => (
                        <img key={i} src={src} alt="" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="diary-report-footer">
              Отчёт сформирован автоматически на ChiliDiaries · chilidiaries.example
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
