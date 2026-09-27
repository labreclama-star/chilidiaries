import { useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { useApp } from '../context/AppContext.jsx';
import { PRESET_AVATARS } from '../data/presetAvatars.js';

// Иконки глаза — локальные, только для этого компонента (просьба из
// задачи: не выносить в NavIcons). Стиль такой же, как в NavIcons.jsx —
// stroke-иконки, currentColor, без заливки.
function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3.6-7 10-7c1.9 0 3.5.5 4.8 1.2M22 12s-3.6 7-10 7c-1.9 0-3.5-.5-4.8-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

// Кнопка-глаз внутри поля пароля — общая мини-разметка для обоих табов.
function PasswordEyeButton({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      style={{
        position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
        background: 'none', border: 'none', padding: 4, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'var(--cream-faint)', cursor: 'pointer'
      }}
    >
      {visible ? <EyeOffIcon width={17} height={17} /> : <EyeIcon width={17} height={17} />}
    </button>
  );
}

export default function AuthModal() {
  const { activeModal, modalPayload, closeModal, openModal, login, signup, settings } = useApp();
  const [tab, setTab] = useState('login');
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPw, setSuPw] = useState('');
  const [suAvatar, setSuAvatar] = useState(null);

  // Задача 1: видимость пароля — два независимых флага.
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);

  // Задача 2: одна форма активна за раз, поэтому один общий флаг submitting.
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await login(loginId, loginPw);
      setLoginId(''); setLoginPw('');
      finish();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(suName, suEmail, suPw, suAvatar);
      setSuName(''); setSuEmail(''); setSuPw(''); setSuAvatar(null);
      finish();
    } finally {
      setSubmitting(false);
    }
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
            <div className="field">
              <label>Пароль</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  style={{ width: '100%', paddingRight: 40 }}
                />
                <PasswordEyeButton visible={showLoginPw} onToggle={() => setShowLoginPw((v) => !v)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? (<><Spinner size={14} /> Вхожу…</>) : 'Войти'}
            </button>
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
            <div className="field">
              <label>Пароль</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSignupPw ? 'text' : 'password'}
                  placeholder="Минимум 8 символов"
                  required
                  value={suPw}
                  onChange={(e) => setSuPw(e.target.value)}
                  style={{ width: '100%', paddingRight: 40 }}
                />
                <PasswordEyeButton visible={showSignupPw} onToggle={() => setShowSignupPw((v) => !v)} />
              </div>
            </div>

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

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? (<><Spinner size={14} /> Создаю…</>) : 'Создать аккаунт'}
            </button>
          </form>
          <p className="form-hint">Уже есть аккаунт? <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }}>Войти</a></p>
        </div>
      )}
    </Modal>
  );
}
