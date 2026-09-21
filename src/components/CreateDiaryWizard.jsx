import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmtNum, REPORT_INTERVALS, intervalLabel, DIARY_STAGES } from '../utils/helpers.js';

export default function CreateDiaryWizard() {
  const navigate = useNavigate();
  const {
    activeModal, closeModal, varieties,
    wizard, updateWizard, toggleWizardVariety, openAddVarietyFromWizard,
    currentUser, openModal, createDiary
  } = useApp();

  const isOpen = activeModal === 'wizard';
  const selectedVarieties = wizard.varietyIds.map((id) => varieties.find((v) => v.id === id)).filter(Boolean);

  function goToStep(n) {
    if (n === 2 && wizard.varietyIds.length === 0) return; // guarded by button disabled state too
    updateWizard({ step: n });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateWizard({ photo: ev.target.result });
    reader.readAsDataURL(file);
  }

  async function handleCreate() {
    if (!currentUser) {
      closeModal();
      openModal('auth', { returnTo: 'wizard' });
      return;
    }
    const diary = await createDiary({
      title: wizard.title,
      note: wizard.note,
      varieties: selectedVarieties.length ? selectedVarieties : [varieties[0]],
      location: wizard.location,
      medium: wizard.medium,
      startDate: wizard.date,
      coverPhoto: wizard.photo,
      reportInterval: wizard.reportInterval,
      stage: wizard.stage
    });
    closeModal();
    if (diary) navigate(`/diaries/${diary.id}`);
  }

  const primary = selectedVarieties[0] || varieties[0];
  const summaryTitle = wizard.title || (primary ? `Дневник: ${primary.name}` : 'Дневник');

  return (
    <Modal isOpen={isOpen} onClose={closeModal} wide>
      <h2>Начать дневник</h2>
      <p className="sub">3 шага — и твой гров уже в сообществе.</p>
      <div className="wizard-steps">
        <div className={wizard.step >= 1 ? 'done' : ''} />
        <div className={wizard.step >= 2 ? 'done' : ''} />
        <div className={wizard.step >= 3 ? 'done' : ''} />
      </div>

      {wizard.step === 1 && (
        <div className="wizard-step-content active">
          <div className="field">
            <label>Название дневника</label>
            <input type="text" placeholder="Например: Reaper на балконе" value={wizard.title} onChange={(e) => updateWizard({ title: e.target.value })} />
          </div>
          <div className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ margin: 0 }}>Выбери один или несколько сортов</label>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={openAddVarietyFromWizard}>
              + Своего сорта нет в списке
            </button>
          </div>
          <div className="pick-grid">
            {varieties.map((v) => (
              <div
                key={v.id}
                className={'pick-item' + (wizard.varietyIds.includes(v.id) ? ' selected' : '')}
                onClick={() => toggleWizardVariety(v.id)}
              >
                <b>{v.name}</b>
                <span>до {fmtNum(v.shuMax)} SHU</span>
              </div>
            ))}
          </div>
          <div className="wizard-nav">
            <span />
            <button className="btn btn-primary" disabled={wizard.varietyIds.length === 0} onClick={() => goToStep(2)}>Далее →</button>
          </div>
        </div>
      )}

      {wizard.step === 2 && (
        <div className="wizard-step-content active">
          <div className="field-row">
            <div className="field">
              <label>Среда</label>
              <select value={wizard.medium} onChange={(e) => updateWizard({ medium: e.target.value })}>
                <option>Почва</option><option>Кокос</option><option>Гидропоника</option>
              </select>
            </div>
            <div className="field">
              <label>Место</label>
              <select value={wizard.location} onChange={(e) => updateWizard({ location: e.target.value })}>
                <option>Дома</option><option>Теплица</option><option>Открытый грунт</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>На каком этапе сейчас растение?</label>
            <div className="filter-bar" style={{ padding: '10px 0', border: 'none', marginBottom: 0 }}>
              {DIARY_STAGES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={'chip' + (wizard.stage === s ? ' active' : '')}
                  onClick={() => updateWizard({ stage: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Дата старта</label>
            <input type="date" value={wizard.date} onChange={(e) => updateWizard({ date: e.target.value })} />
          </div>
          <div className="field">
            <label>Как часто планируешь публиковать отчёты?</label>
            <div className="filter-bar" style={{ padding: '10px 0', border: 'none', marginBottom: 0 }}>
              {REPORT_INTERVALS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={'chip' + (wizard.reportInterval === opt.value ? ' active' : '')}
                  onClick={() => updateWizard({ reportInterval: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--cream-faint)' }}>Не строго — день каждого отчёта всегда можно поправить вручную.</span>
          </div>
          <div className="field">
            <label>Комментарий (необязательно)</label>
            <textarea rows="3" placeholder="Пара слов о плане на гров…" value={wizard.note} onChange={(e) => updateWizard({ note: e.target.value })} />
          </div>
          <div className="field">
            <label>Фото обложки дневника (необязательно)</label>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
          </div>
          {wizard.photo && (
            <div style={{ marginBottom: 6 }}>
              <img src={wizard.photo} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '16px 4px 16px 4px' }} />
            </div>
          )}
          <div className="wizard-nav">
            <button className="btn btn-outline" onClick={() => goToStep(1)}>← Назад</button>
            <button className="btn btn-primary" onClick={() => goToStep(3)}>Далее →</button>
          </div>
        </div>
      )}

      {wizard.step === 3 && (
        <div className="wizard-step-content active">
          <div style={{ background: 'var(--soil-850)', border: '1px solid var(--scorch-line)', borderRadius: 12, padding: 18, marginBottom: 18, fontSize: 13.5, color: 'var(--cream-dim)', lineHeight: 1.8 }}>
            <b style={{ color: 'var(--white)' }}>{summaryTitle}</b><br />
            Сорт{selectedVarieties.length > 1 ? 'а' : ''}: {selectedVarieties.map((v) => v.name).join(', ')}<br />
            Среда: {wizard.medium} · Место: {wizard.location}<br />
            Стадия: {wizard.stage}<br />
            Интервал отчётов: {intervalLabel(wizard.reportInterval)}<br />
            Старт: {wizard.date || 'сегодня'}
          </div>
          <div className="wizard-nav">
            <button className="btn btn-outline" onClick={() => goToStep(2)}>← Назад</button>
            <button className="btn btn-primary" onClick={handleCreate}>Создать дневник 🌶️</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
