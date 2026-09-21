import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

/**
 * Оборачивает роуты /admin/*.
 * - Не залогинен → открывает AuthModal и ОСТАЁТСЯ на /admin (без редиректа!),
 *   чтобы после успешного входа AdminLayout сразу отрисовался на этом же URL.
 *   Раньше здесь был <Navigate to="/" />, из-за чего окно входа открывалось
 *   уже на главной странице, и после логина пользователь оставался на "/"
 *   вместо /admin — это и был баг.
 * - Залогинен, но не admin → это уже настоящий отказ в доступе, тост
 *   "Доступ запрещён" и редирект на "/".
 * - admin → рендерит children как есть.
 */
export default function ProtectedAdminRoute({ children }) {
  const { currentUser, isAdmin, activeModal, openModal, showToast } = useApp();

  useEffect(() => {
    if (!currentUser && activeModal !== 'auth') {
      openModal('auth');
    } else if (currentUser && !isAdmin) {
      showToast('Доступ запрещён');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin]);

  if (currentUser && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!currentUser) {
    // Ничего не рендерим (кроме пустого фона) — AuthModal смонтирован глобально
    // в App.jsx и откроется поверх этой же страницы. Как только currentUser
    // появится, этот же компонент перерендерится и отдаст children ниже.
    return <div className="admin-shell" />;
  }

  return children;
}

