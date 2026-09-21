import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal, currentUser, findGrowerById } = useApp();
  const grower = currentUser ? findGrowerById(currentUser.growerId) : null;

  // "Профиль" has no dedicated route of its own — it goes to the current
  // grower's public page (same destination as "Мой профиль" in the desktop
  // profile dropdown). Logged-out visitors get the auth modal instead of a
  // dead tab.
  function handleProfileTap() {
    if (grower) navigate(`/growers/${grower.id}`);
    else openModal('auth');
  }

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => 'bn-item' + (isActive ? ' active' : '')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1v-9" /></svg>
        <span>Главная</span>
      </NavLink>
      <NavLink to="/diaries" className={({ isActive }) => 'bn-item' + (isActive ? ' active' : '')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
        <span>Дневники</span>
      </NavLink>
      <NavLink to="/varieties" className={({ isActive }) => 'bn-item' + (isActive ? ' active' : '')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 4c1 1.6.4 2.8-.4 4C6.8 10 5.5 12.6 6.2 15c.8 2.8 3.6 4 6 3.2 2.8-1 4.8-3.6 4.8-6.8C17 8 15 5.6 12 4.6" /></svg>
        <span>Сорта</span>
      </NavLink>
      <button
        type="button"
        className={'bn-item' + (grower && location.pathname === `/growers/${grower.id}` ? ' active' : '')}
        onClick={handleProfileTap}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20c0-3.9 3.2-6.4 7.2-6.4s7.2 2.5 7.2 6.4" /></svg>
        <span>Профиль</span>
      </button>
      <button type="button" className="bn-item" onClick={() => openModal('moreSheet')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>
        <span>Ещё</span>
      </button>
    </nav>
  );
}
