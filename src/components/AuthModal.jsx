import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';
import { PRESET_AVATARS } from '../data/presetAvatars.js';

export default function AuthModal() {
  const { activeModal, modalPayload, closeModal, openModal, login, signup, settings } = useApp();
  const [tab, setTab] = useState('login');
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPw, setSuPw] = useState('');
  const [suAvatar, setSuAvatar] = useState(null);

  const isOpen = activeModal === 'auth';
  const returnTo = modalPayload && modalPayload.returnTo;
  const regEnabled = settings.registrationEnabled;
  const effectiveTab = regEnabled ? tab : 'login';

  function finish() {
    if (returnTo === 'wizard') {
      openModal('wizard');
    } else {
      closeModal();
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    await login(loginId, loginPw);
    setLoginId(''); setLoginPw('');
    finish();
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    await signup(suName, suEmail, suPw, suAvatar);
    setSuName(''); setSuEmail(''); setSuPw(''); setSuAvatar(null);
    finish();
  }

  function handleOwnPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSuAvatar(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <Modal isOpen={isOpen} onClose={closeModal}>
      <div className="tab-row">
        <button className={'tab-btn' + (effectiveTab === 'login' ? ' active' : '')} onClick={() => setTab('login')}>Вход</button>
        {regEnabled && (
          <button className={'tab-btn' + (effectiveTab === 'signup' ? ' active' : '')} onClick={() => setTab('signup')}>Регистрация</button>
        )}
      </div>

      {effectiveTab === 'login' ? (
        <div>
          <h2>С возвращением</h2>
          <p className="sub">Войди, чтобы вести дневник и общаться с сообществом.</p>
          <form onSubmit={handleLoginSubmit}>
            <div className="field"><label>E-mail</label><input type="text" placeholder="you@example.com" required value={loginId} onChange={(e) => setLoginId(e.target.value)} /></div>
            <div className="field"><label>Пароль</label><input type="password" placeholder="••••••••" required value={loginPw} onChange={(e) => setLoginPw(e.target.value)} /></div>
            <button type="submit" className="btn btn-primary btn-block">Войти</button>
          </form>
          {regEnabled && (
            <p className="form-hint">Нет аккаунта? <a href="#" onClick={(e) => { e.preventDefault(); setTab('signup'); }}>Зарегистрироваться</a></p>
          )}
        </div>
      ) : (
        <div>
          <h2>Присоединиться</h2>
          <p className="sub">100% анонимно — только никнейм.</p>
          <form onSubmit={handleSignupSubmit}>
            <div className="field"><label>Никнейм</label><input type="text" placeholder="Придумай никнейм" required value={suName} onChange={(e) => setSuName(e.target.value)} /></div>
            <div className="field"><label>E-mail</label><input type="email" placeholder="you@example.com" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)} /></div>
            <div className="field"><label>Пароль</label><input type="password" placeholder="Минимум 8 символов" required value={suPw} onChange={(e) => setSuPw(e.target.value)} /></div>

            <div className="field">
              <label>Фото профиля (необязательно)</label>
              <input type="file" accept="image/*" onChange={handleOwnPhoto} />
            </div>

            <p className="form-hint" style={{ marginTop: 0, marginBottom: 8 }}>Не хочешь грузить своё фото — выбери аватар:</p>
            <div className="avatar-picker">
              {PRESET_AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={'avatar-picker-item' + (suAvatar === a.src ? ' selected' : '')}
                  onClick={() => setSuAvatar(a.src)}
                  aria-label={`Выбрать аватар ${a.id}`}
                >
                  <img src={a.src} alt="" />
                </button>
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-block">Создать аккаунт</button>
          </form>
          <p className="form-hint">Уже есть аккаунт? <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }}>Войти</a></p>
        </div>
      )}
    </Modal>
  );
}
