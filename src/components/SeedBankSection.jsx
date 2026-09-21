import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { IconSeed } from './NavIcons.jsx';

export default function SeedBankSection() {
  const { seedBank, varieties, addSeed, removeSeed, toggleSeedStatus } = useApp();
  const [name, setName] = useState('');
  const [varietyId, setVarietyId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('have');

  function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    addSeed({ name: name.trim(), varietyId: varietyId || null, quantity: quantity.trim(), status });
    setName(''); setVarietyId(''); setQuantity('');
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="side-card" style={{ marginBottom: 20 }}>
        <h4><IconSeed width="15" height="15" style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />Добавить в банк семян</h4>
        <div className="field-row">
          <div className="field"><label>Название сорта</label><input type="text" placeholder="Например: Carolina Reaper F3" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field">
            <label>Привязать к каталогу (необязательно)</label>
            <select value={varietyId} onChange={(e) => setVarietyId(e.target.value)}>
              <option value="">— не выбрано —</option>
              {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field"><label>Количество семян</label><input type="text" placeholder="например: 12 шт." value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div className="field">
            <label>Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="have">Есть семена</option>
              <option value="want">Ищу семена</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block">Добавить</button>
      </form>

      {seedBank.length === 0 ? (
        <div className="empty-state">
          <p>Твой банк семян пуст — добавь первый сорт выше.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {seedBank.map((s) => {
            const v = s.varietyId ? varieties.find((x) => x.id === s.varietyId) : null;
            return (
              <div className="side-card" key={s.id} style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <b style={{ display: 'block', color: 'var(--white)', fontSize: 14.5 }}>{s.name}</b>
                    {v && <Link to={`/varieties/${v.id}`} style={{ fontSize: 11.5, color: 'var(--habanero)' }}>{v.name}</Link>}
                  </div>
                  <button className="modal-close seed-remove-btn" style={{ position: 'static', width: 22, height: 22 }} onClick={() => removeSeed(s.id)} aria-label="Удалить">&times;</button>
                </div>
                {s.quantity && <p style={{ fontSize: 12.5, color: 'var(--cream-dim)', margin: '8px 0' }}>Количество: {s.quantity}</p>}
                <button
                  className={'chip' + (s.status === 'have' ? ' active' : '')}
                  onClick={() => toggleSeedStatus(s.id)}
                  style={{ marginTop: 6 }}
                >
                  {s.status === 'have' ? '✓ Есть семена' : '🔍 Ищу семена'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
