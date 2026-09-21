import { Link } from 'react-router-dom';
import { LogoIcon } from './PepperIcon.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Footer() {
  const { showToast } = useApp();
  const demoClick = (e) => { e.preventDefault(); showToast('Раздел в разработке — демо-версия сайта'); };
  const socialClick = (e) => { e.preventDefault(); showToast('Соцсети — демо-режим, тут будет реальная ссылка'); };

  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="logo">
              <LogoIcon />
              <span>Chili<em>Diaries</em></span>
            </Link>
            <p>Первое сообщество гроверов острого перца. Веди дневник, сравнивай гров и находи свой идеальный уровень жгучести.</p>
            <div className="social-row">
              <a href="#" aria-label="Telegram" onClick={socialClick}><svg viewBox="0 0 24 24" fill="none"><path d="M21 4L2 11l6 2m13-9l-4 17-7-6m11-11L8 13" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></a>
              <a href="#" aria-label="Instagram" onClick={socialClick}><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" /></svg></a>
              <a href="#" aria-label="YouTube" onClick={socialClick}><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9l6 3-6 3V9Z" fill="currentColor" /></svg></a>
            </div>
          </div>
          <div><h5>Сообщество</h5><ul>
            <li><Link to="/diaries">Дневники</Link></li>
            <li><Link to="/growers">Гроверы</Link></li>
            <li><Link to="/contests">Конкурсы</Link></li>
            <li><Link to="/recipes">Рецепты</Link></li>
            <li><Link to="/blog">Блог</Link></li>
          </ul></div>
          <div><h5>Каталог</h5><ul>
            <li><Link to="/varieties">Сорта перцев</Link></li>
            <li><Link to="/lights">Освещение</Link></li>
            <li><Link to="/nutrients">Удобрения</Link></li>
          </ul></div>
          <div><h5>Инфо</h5><ul>
            <li><Link to="/how">Как это работает</Link></li>
            <li><a href="#" onClick={demoClick}>FAQ</a></li>
            <li><a href="#" onClick={demoClick}>Связаться с нами</a></li>
          </ul></div>
          <div><h5>Правовое</h5><ul>
            <li><a href="#" onClick={demoClick}>Конфиденциальность</a></li>
            <li><a href="#" onClick={demoClick}>Условия использования</a></li>
          </ul></div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ChiliDiaries.</span>
          <span>Сделано для любителей жгучего 🌶️</span>
        </div>
      </div>
    </footer>
  );
}
