import { avatarColorFor, initials } from '../utils/helpers.js';

export default function Avatar({ name, size, photo, online, showOnline }) {
  const style = { background: avatarColorFor(name) };
  if (size) {
    style.width = size;
    style.height = size;
  }
  const dotSize = size ? Math.max(8, Math.round(size * 0.28)) : 10;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {photo ? (
        <img src={photo} alt={name} className="avatar" style={{ ...style, objectFit: 'cover' }} />
      ) : (
        <div className="avatar" style={style}>{initials(name)}</div>
      )}
      {showOnline && (
        <span
          className={'online-dot' + (online ? ' is-online' : '')}
          style={{ width: dotSize, height: dotSize }}
          title={online ? 'В сети' : 'Не в сети'}
        />
      )}
    </div>
  );
}
