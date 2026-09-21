import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoIcon } from '../components/PepperIcon.jsx';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Дашборд', end: true },
  { to: '/admin/varieties', label: 'Сорта' },
  { to: '/admin/diaries', label: 'Дневники' },
  { to: '/admin/users', label: 'Гроверы' },
  { to: '/admin/recipes', label: 'Рецепты' },
  { to: '/admin/blog', label: 'Блог' },
  { to: '/admin/questions', label: 'Вопросы' },
  { to: '/admin/contests', label: 'Конкурсы' },
  { to: '/admin/lights', label: 'Свет' },
  { to: '/admin/nutrients', label: 'Удобрения' },
  { to: '/admin/settings', label: 'Настройки' },
  { to: '/admin/data', label: 'Экспорт / Импорт' }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Закрывать шторку меню при переходе на другой раздел админки (мобильный сценарий).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <button
          className="admin-burger"
          aria-label={drawerOpen ? 'Закрыть меню' : 'Открыть меню'}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <div className="admin-brand">
          <LogoIcon />
          <span className="admin-brand-text">Chili<em>Diaries</em></span>
          <span className="admin-badge">Админка</span>
        </div>

        <button className="btn btn-ghost btn-sm admin-exit" onClick={() => navigate('/')}>
          ← На сайт
        </button>
      </header>

      <div className="admin-body">
        <nav className={'admin-sidebar' + (drawerOpen ? ' open' : '')} aria-label="Меню админки">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'admin-nav-item' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {drawerOpen && <div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
