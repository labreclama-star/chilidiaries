import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Global "go back" control, mounted once above <Routes> in App.jsx so it
 * shows on every page except the home page (where there's nowhere useful to
 * go back to). Always navigates one step back in browser history.
 */
export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/') return null;

  return (
    <div className="wrap back-nav">
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Назад">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Назад
      </button>
    </div>
  );
}
