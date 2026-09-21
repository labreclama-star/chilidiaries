import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import {
  IconHome, IconBook, IconBookmark, IconUsers, IconTrophy, IconPepper,
  IconChefHat, IconNewspaper, IconBulb, IconDroplet, IconInfo, IconFeed, IconQuestion
} from './NavIcons.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Главная', end: true, Icon: IconHome },
  { to: '/feed', label: 'Лента', Icon: IconFeed },
  { to: '/diaries', label: 'Дневники', Icon: IconBook },
  { to: '/growers', label: 'Гроверы', Icon: IconUsers },
  { to: '/leaderboard', label: 'Рейтинг', Icon: IconTrophy },
  { to: '/varieties', label: 'Сорта', Icon: IconPepper },
  { to: '/questions', label: 'Вопросы', Icon: IconQuestion },
  { to: '/recipes', label: 'Рецепты', Icon: IconChefHat },
  { to: '/blog', label: 'Блог', Icon: IconNewspaper },
  { to: '/lights', label: 'Свет', Icon: IconBulb },
  { to: '/nutrients', label: 'Удобрения', Icon: IconDroplet },
  { to: '/contests', label: 'Конкурсы', Icon: IconTrophy },
  { to: '/how', label: 'Как это работает', Icon: IconInfo }
];

export default function Sidebar() {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed, openWizard, currentUser, settings } = useApp();
  const isLight = theme === 'light';

  const filtered = NAV_ITEMS.filter((item) => {
    if (item.to === '/feed') return settings.showFeed;
    if (item.to === '/questions') return settings.showQuestions;
    return true;
  });
  const navItems = currentUser
    ? (() => {
        const anchorIdx = filtered.findIndex((i) => i.to === '/feed');
        const insertAfter = anchorIdx !== -1 ? anchorIdx : filtered.findIndex((i) => i.to === '/');
        const next = filtered.slice();
        next.splice(insertAfter + 1, 0, { to: '/my-diaries', label: 'Мои дневники', Icon: IconBookmark });
        return next;
      })()
    : filtered;

  function toggleTheme() {
    setTheme(isLight ? 'dark' : 'light');
  }

  function handleStartDiary() {
    if (window.innerWidth <= 900) setSidebarCollapsed(true);
    openWizard();
  }

  return (
    <aside className={'sidebar' + (sidebarCollapsed ? ' collapsed' : '')} id="sidebar">
      <nav className="main-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
            title={sidebarCollapsed ? item.label : undefined}
            onClick={() => { if (window.innerWidth <= 900) setSidebarCollapsed(true); }}
          >
            <item.Icon className="nav-icon" width="18" height="18" />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="btn-icon" aria-label="Переключить тему" title="Светлая/тёмная тема" onClick={toggleTheme}>
          {isLight ? (
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          )}
        </button>
        <button className="btn btn-primary btn-sm sidebar-start-btn" style={{ flex: 1 }} onClick={handleStartDiary} title="Начать дневник">
          <span className="nav-label">Начать дневник</span>
          <svg className="sidebar-start-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </aside>
  );
}
