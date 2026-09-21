import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleNotifClick(n) {
    markNotificationRead(n.id);
    setOpen(false);
    navigate(`/diaries/${n.diaryId}`);
  }

  return (
    <div className="profile-menu-wrap" ref={wrapRef}>
      <button className="btn-icon notification-bell-btn" aria-label="Уведомления" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
          <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-count-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="profile-dropdown notif-dropdown">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ fontSize: 14, color: 'var(--white)' }}>Уведомления</b>
            {unreadCount > 0 && (
              <button style={{ fontSize: 11.5, color: 'var(--habanero)' }} onClick={markAllNotificationsRead}>
                Прочитать всё
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--cream-faint)', padding: '10px 2px' }}>
              Пока нет уведомлений. Подпишись на дневник, чтобы узнавать о новых отчётах.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className="profile-dropdown-item"
                  style={{ alignItems: 'flex-start', position: 'relative', paddingLeft: n.read ? 8 : 18 }}
                  onClick={() => handleNotifClick(n)}
                >
                  {!n.read && <span className="notif-unread-dot" />}
                  <div>
                    <span style={{ display: 'block', color: n.read ? 'var(--cream-faint)' : 'var(--cream)' }}>{n.message}</span>
                    <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>{timeAgo(n.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
