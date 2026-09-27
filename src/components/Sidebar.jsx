import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

const LASTSEEN_PREFIX = 'cd_lastseen:';

// Разделы, для которых считаем счётчик «нового». Пока только конкурсы —
// created_at реально пришёл в contestRowToJs. Для /varieties в этой
// итерации не подтверждено, что колонка created_at есть в БД и что она
// попадает в маппер — не выдумываем, просто не показываем счётчик для
// сортов.
const COUNTABLE_PATHS = ['/contests'];

function getLastSeen(path) {
  try {
    return localStorage.getItem(LASTSEEN_PREFIX + path);
  } catch {
    return null;
  }
}

function markSeen(path) {
  try {
    localStorage.setItem(LASTSEEN_PREFIX + path, new Date().toISOString());
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — просто не считаем счётчики.
  }
}

export default function Sidebar() {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed, openWizard, currentUser, settings, contests, showToast } = useApp();
  const isLight = theme === 'light';
  const location = useLocation();

  // Растёт при каждом заходе на countable-путь — нужен, чтобы useMemo
  // пересчитался сразу после того, как markSeen обновил localStorage
  // (сам localStorage не реактивен).
  const [seenTick, setSeenTick] = useState(0);

  useEffect(() => {
    if (!COUNTABLE_PATHS.includes(location.pathname)) return;
    // При первом заходе (нет метки) — просто выставляем метку с этого
    // момента, ничего не показывая как "уже виденное".
    markSeen(location.pathname);
    setSeenTick((t) => t + 1);
  }, [location.pathname]);

  const newCounts = useMemo(() => {
    const counts = {};
    COUNTABLE_PATHS.forEach((path) => {
      const lastSeen = getLastSeen(path);
      // Нет метки — пользователь ещё не открывал раздел, ничего не
      // "пропущено": newCount = 0.
      if (!lastSeen) {
        counts[path] = 0;
        return;
      }
      const lastSeenTime = new Date(lastSeen).getTime();
      const source = path === '/contests' ? contests : [];
      counts[path] = source.filter((item) => item.createdAt && new Date(item.createdAt).getTime() > lastSeenTime).length;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contests, seenTick]);

  function countNew(path) {
    return newCounts[path] || 0;
  }

  // Задача 6 текущего захода: разделы, скрытые админом в /admin/settings —
  // остаются в списке, но помечены бейджем и не кликабельны.
  const wipTabs = settings.wipTabs || [];
  function isWip(path) {
    return wipTabs.includes(path);
  }

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

  function handleNavClick(e, path) {
    if (isWip(path)) {
      e.preventDefault();
      showToast('Раздел в разработке');
      return;
    }
    if (window.innerWidth <= 900) setSidebarCollapsed(true);
  }

  return (
    <aside className={'sidebar' + (sidebarCollapsed ? ' collapsed' : '')} id="sidebar">
      <nav className="main-nav">
        {navItems.map((item) => {
          const newCount = countNew(item.to);
          const wip = isWip(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '') + (wip ? ' wip' : '')}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={(e) => handleNavClick(e, item.to)}
            >
              <span className="nav-icon-wrap">
                <item.Icon className="nav-icon" width="18" height="18" />
                {newCount > 0 && <span className="nav-badge">{newCount}</span>}
              </span>
              <span className="nav-label">{item.label}</span>
              {wip && <span className="nav-wip-badge">В разработке</span>}
            </NavLink>
          );
        })}
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
