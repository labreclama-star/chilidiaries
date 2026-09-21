import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: '90px 0', textAlign: 'center' }}>
      <span className="eyebrow" style={{ justifyContent: 'center' }}>404</span>
      <h1 style={{ margin: '14px 0 10px' }}>Такого стручка не нашлось</h1>
      <p style={{ color: 'var(--cream-dim)', marginBottom: 26 }}>
        Страница, которую ты ищешь, не существует или была перемещена.
      </p>
      <Link to="/" className="btn btn-primary">На главную</Link>
    </div>
  );
}
