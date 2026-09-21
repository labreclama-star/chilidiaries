import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

const LINKS = [
  { to: '/feed', label: 'Лента' },
  { to: '/growers', label: 'Гроверы' },
  { to: '/leaderboard', label: 'Рейтинг гроверов' },
  { to: '/questions', label: 'Вопросы' },
  { to: '/recipes', label: 'Рецепты' },
  { to: '/blog', label: 'Блог' },
  { to: '/lights', label: 'Освещение' },
  { to: '/nutrients', label: 'Удобрения' },
  { to: '/contests', label: 'Конкурсы' },
  { to: '/how', label: 'Как это работает' }
];

export default function MoreSheetModal() {
  const navigate = useNavigate();
  const { activeModal, closeModal, currentUser, openModal, showToast, settings } = useApp();

  const links = LINKS.filter((l) => {
    if (l.to === '/feed') return settings.showFeed;
    if (l.to === '/questions') return settings.showQuestions;
    return true;
  });

  function goTo(to) {
    closeModal();
    navigate(to);
  }

  function handleLogin() {
    closeModal();
    if (currentUser) {
      showToast(`Ты уже вошёл как ${currentUser.name}`);
      return;
    }
    openModal('auth');
  }

  return (
    <Modal isOpen={activeModal === 'moreSheet'} onClose={closeModal}>
      <h2>Ещё</h2>
      <p className="sub">Остальные разделы сайта</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentUser && (
          <a
            href="/my-diaries"
            className="chip"
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '13px 16px' }}
            onClick={(e) => { e.preventDefault(); goTo('/my-diaries'); }}
          >
            Мои дневники
          </a>
        )}
        {links.map((l) => (
          <a
            key={l.to}
            href={l.to}
            className="chip"
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '13px 16px' }}
            onClick={(e) => { e.preventDefault(); goTo(l.to); }}
          >
            {l.label}
          </a>
        ))}
        <a
          href="#"
          className="chip"
          style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '13px 16px' }}
          onClick={(e) => { e.preventDefault(); handleLogin(); }}
        >
          {currentUser ? currentUser.name : 'Войти / Регистрация'}
        </a>
      </div>
    </Modal>
  );
}
