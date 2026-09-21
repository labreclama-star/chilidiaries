import { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';

export default function AdminData() {
  const { adminExportData, adminImportData, adminResetToSeed, showToast } = useApp();
  const fileInputRef = useRef(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleExport() {
    const data = adminExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chilidiaries-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        adminImportData(data);
      } catch {
        showToast('Не удалось прочитать файл — это точно JSON-экспорт ChiliDiaries?');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Экспорт / Импорт данных</h1>

      <div className="card" style={{ padding: 20, maxWidth: 560, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Скачать JSON</h3>
        <p className="sub">Полный снимок всех данных: гроверы, сорта, дневники, рецепты, блог, конкурсы, вопросы, свет, удобрения, настройки.</p>
        <button className="btn btn-outline btn-block" onClick={handleExport}>Скачать JSON</button>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 560, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Загрузить JSON</h3>
        <p className="sub">Полностью заменяет текущие данные содержимым файла. Файл должен быть экспортом ChiliDiaries того же формата.</p>
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileChange} />
        <button className="btn btn-outline btn-block" onClick={handleImportClick}>Загрузить JSON</button>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Сбросить к сид-данным</h3>
        <p className="sub">Удаляет всё, что сохранено в localStorage, и перезагружает страницу с исходными демо-данными проекта. Действие необратимо.</p>
        <button className="btn btn-primary btn-block" onClick={() => setConfirmReset(true)}>Сбросить к сид-данным</button>
      </div>

      <AdminConfirmDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Сбросить все данные?"
        message="Все изменения, сделанные через админку (и через сайт), будут потеряны без возможности восстановления. Страница перезагрузится с исходными демо-данными."
        confirmLabel="Сбросить"
        onConfirm={adminResetToSeed}
      />
    </div>
  );
}
