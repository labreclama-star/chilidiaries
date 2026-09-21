import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function ProfileMenu() {
  const navigate = useNavigate();
  const { currentUser, findGrowerById, setOnlineStatus, logout, openModal, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const grower = currentUser ? findGrowerById(currentUser.growerId) : null;

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!currentUser || !grower) return null;

  function handleLogout() {
    logout();
    setOpen(false);
    showToast('Ты вышел из аккаунта');
    navigate('/');
  }

  return (
    <div className="profile-menu-wrap" ref={wrapRef}>
      <button className="profile-menu-trigger" onClick={() => setOpen((v) => !v)}>
        <Avatar name={grower.name} photo={grower.avatar} size={28} online={grower.online} showOnline />
        <span className="pname">{grower.name}</span>
      </button>

      {open && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-head">
            <Avatar name={grower.name} photo={grower.avatar} size={40} online={grower.online} showOnline />
            <div>
              <b>{grower.name}</b>
              <span>{grower.loc}</span>
            </div>
          </div>

          <div className="profile-online-row">
            <span>Показывать «в сети»</span>
            <button
              className={'profile-toggle' + (grower.online ? ' on' : '')}
              aria-label="Переключить статус онлайн"
              onClick={() => setOnlineStatus(!grower.online)}
            />
          </div>

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-item" onClick={() => { setOpen(false); navigate(`/growers/${grower.id}`); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
            Мой профиль
          </button>
          <button className="profile-dropdown-item" onClick={() => { setOpen(false); navigate('/my-diaries'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
            Мои дневники
          </button>
          <button className="profile-dropdown-item" onClick={() => { setOpen(false); openModal('editProfile'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>
            Редактировать профиль
          </button>

          <div className="profile-dropdown-divider" />

          <button className="profile-dropdown-item danger" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
            Выйти из аккаунта
          </button>
        </div>
      )}
    </div>
  );
}
