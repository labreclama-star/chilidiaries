import { useApp } from '../context/AppContext.jsx';

export default function ToastStack() {
  const { toasts } = useApp();
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.type === 'success' ? ' success' : '')}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
