import { useEffect, useCallback } from 'react';

/**
 * Full-screen photo viewer. `photos` is an array of image URLs/data-URLs,
 * `index` is which one is currently shown, `onClose` closes it, and
 * `onIndexChange` is called with the new index when the user navigates.
 */
export default function Lightbox({ photos, index, onClose, onIndexChange }) {
  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % photos.length);
  }, [index, photos.length, onIndexChange]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  if (index == null || !photos || !photos.length) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Закрыть">&times;</button>
      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Предыдущее фото"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      <img
        src={photos[index]}
        alt=""
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
      {photos.length > 1 && (
        <button
          className="lightbox-nav lightbox-next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Следующее фото"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
      {photos.length > 1 && (
        <div className="lightbox-counter">{index + 1} / {photos.length}</div>
      )}
    </div>
  );
}
