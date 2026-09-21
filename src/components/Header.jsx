import { useNavigate } from 'react-router-dom';
import { LogoIcon } from './PepperIcon.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Header() {
  const navigate = useNavigate();
  const {
    theme, setTheme, searchQuery, setSearchQuery,
    currentUser, openModal, openWizard,
    sidebarCollapsed, setSidebarCollapsed
  } = useApp();
  const isLight = theme === 'light';

  function handleSearchChange(e) {
    setSearchQuery(e.target.value);
    navigate('/diaries');
  }

  return (
    <header>
      <button
        className="sidebar-collapse-btn corner-burger"
        aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <a href="/" className="logo header-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
        <LogoIcon />
        <span>Chili<em>Diaries</em></span>
      </a>
      <div className="wrap nav-row">
        <div className="nav-actions">
          <label className="search-box">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input type="text" placeholder="Найти сорт, гровера…" value={searchQuery} onChange={handleSearchChange} />
          </label>
          <button className="btn-icon" aria-label="Переключить тему" title="Светлая/тёмная тема" onClick={() => setTheme(isLight ? 'dark' : 'light')}>
            {isLight ? (
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            )}
          </button>
          {currentUser ? (
            <>
              <NotificationBell />
              <ProfileMenu />
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => openModal('auth')}>Войти</button>
          )}
          <button className="btn btn-primary btn-sm" id="startDiaryBtn" onClick={openWizard}>Начать дневник</button>
        </div>
      </div>
    </header>
  );
}
