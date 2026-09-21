import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function AdminSettings() {
  const { settings, adminUpdateSettings } = useApp();
  const [form, setForm] = useState(settings);

  // Синхронизируем локальную форму, если settings обновились извне (например,
  // после импорта данных на /admin/data во время открытой вкладки настроек).
  useEffect(() => { setForm(settings); }, [settings]);

  function field(key) {
    return { value: form[key] ?? '', onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function toggle(key) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  function handleBannerPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, bannerPhoto: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function handleHeroPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, heroPhoto: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    adminUpdateSettings(form);
  }

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Настройки сайта</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        <h2 className="admin-section-title">Общее</h2>
        <div className="field"><label>Название сайта</label><input type="text" {...field('siteName')} /></div>
        <div className="field"><label>Описание сайта</label><textarea rows="2" {...field('siteDescription')} /></div>

        <h2 className="admin-section-title">Контакты</h2>
        <div className="field-row">
          <div className="field"><label>E-mail</label><input type="email" {...field('contactEmail')} /></div>
          <div className="field"><label>Telegram</label><input type="text" placeholder="@chilidiaries" {...field('telegram')} /></div>
        </div>
        <div className="field"><label>Instagram</label><input type="text" placeholder="@chilidiaries" {...field('instagram')} /></div>

        <h2 className="admin-section-title">Главный экран</h2>
        <p className="sub" style={{ marginTop: -8 }}>Фоновое фото в самом верху главной страницы (за текстом заголовка).</p>
        <div className="field"><label>Главное фото</label><input type="file" accept="image/*" onChange={handleHeroPhoto} /></div>
        {form.heroPhoto && (
          <div style={{ marginBottom: 14 }}>
            <img src={form.heroPhoto} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '16px 4px 16px 4px' }} />
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setForm((f) => ({ ...f, heroPhoto: null }))}>
              Убрать фото (вернуть стандартное)
            </button>
          </div>
        )}

        <h2 className="admin-section-title">Баннер на главной</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!form.bannerEnabled} onChange={() => toggle('bannerEnabled')} />
          Показывать баннер
        </label>
        <div className="field"><label>Текст баннера</label><input type="text" {...field('bannerText')} /></div>
        <div className="field"><label>Картинка баннера (необязательно)</label><input type="file" accept="image/*" onChange={handleBannerPhoto} /></div>
        {form.bannerPhoto && (
          <div style={{ marginBottom: 14 }}>
            <img src={form.bannerPhoto} alt="" style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 8 }} />
          </div>
        )}

        <h2 className="admin-section-title">Доступность разделов</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!form.registrationEnabled} onChange={() => toggle('registrationEnabled')} />
          Регистрация новых пользователей разрешена
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!form.showQuestions} onChange={() => toggle('showQuestions')} />
          Показывать раздел «Вопросы» в меню
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!form.showFeed} onChange={() => toggle('showFeed')} />
          Показывать раздел «Лента» в меню
        </label>

        <button type="submit" className="btn btn-primary btn-block">Сохранить настройки</button>
      </form>
    </div>
  );
}
