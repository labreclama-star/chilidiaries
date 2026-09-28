import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function EditProfileModal() {
  const { activeModal, closeModal, currentUser, findGrowerById, updateProfile } = useApp();
  const isOpen = activeModal === 'editProfile';
  const grower = currentUser ? findGrowerById(currentUser.growerId) : null;

  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && grower) {
      setName(grower.name);
      setLoc(grower.loc || '');
      setBio(grower.bio || '');
      setAvatar(grower.avatar || null);
    }
  }, [isOpen, grower]);

  if (!grower) return null;

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // updateProfile возвращает обновлённый профиль или null при ошибке —
      // в обоих случаях просто закрываем модалку; при следующем открытии
      // useEffect выше заново подтянет актуальные name/loc/bio/avatar из
      // grower, так что сбрасывать локальный стейт здесь вручную не нужно.
      await updateProfile({ name: name.trim() || grower.name, loc: loc.trim(), bio: bio.trim(), avatar });
      closeModal();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={closeModal}>
      <h2>Редактировать профиль</h2>
      <p className="sub">Эта информация видна другим гроверам в твоём профиле.</p>
      <form onSubmit={handleSubmit}>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: avatar ? `url('${avatar}') center/cover` : 'var(--soil-800)',
              border: '1px solid var(--scorch-line)'
            }}
          />
          <div style={{ flex: 1 }}>
            <label>Фото профиля</label>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
          </div>
        </div>
        <div className="field"><label>Никнейм</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="field"><label>Локация</label><input type="text" placeholder="Город, страна" value={loc} onChange={(e) => setLoc(e.target.value)} /></div>
        <div className="field"><label>О себе</label><textarea rows="3" placeholder="Пара слов о твоём гров-опыте…" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? (<><Spinner size={14} /> Сохраняю…</>) : 'Сохранить'}
        </button>
      </form>
    </Modal>
  );
}
