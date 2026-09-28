import { useEffect, useCallback, useRef, useState } from 'react';

// Насколько далеко (px) нужно потянуть фото вниз, чтобы лайтбокс закрылся
const SWIPE_CLOSE_PX = 80;

/**
 * Full-screen photo viewer. `photos` is an array of image URLs/data-URLs,
 * `index` is which one is currently shown, `onClose` closes it, and
 * `onIndexChange` is called with the new index when the user navigates.
 *
 * На телефоне: свайп вниз закрывает лайтбокс, вверху слева — кнопка «назад».
 */
export default function Lightbox({ photos, index, onClose, onIndexChange }) {
  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % photos.length);
  }, [index, photos.length, onIndexChange]);

  // Свайп вниз: dragY — на сколько сейчас смещено фото, dragging — палец на экране
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStart = useRef(null); // { x, y } или null, если жест не наш

  function handleTouchStart(e) {
    // Жест с двумя пальцами (зум) не трогаем
    if (e.touches.length !== 1) { touchStart.current = null; return; }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setDragging(true);
  }

  function handleTouchMove(e) {
    if (!touchStart.current) return;
    const dy = e.touches[0].clientY - touchStart.current.y;
    const dx = e.touches[0].clientX - touchStart.current.x;
    // Учитываем только движение вниз, и только если оно больше боковой составляющей
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy);
    else setDragY(0);
  }

  function handleTouchEnd() {
    const shouldClose = touchStart.current && dragY > SWIPE_CLOSE_PX;
    touchStart.current = null;
    setDragging(false);
    if (shouldClose) {
      onClose();
      return;
    }
    setDragY(0); // не дотянули — фото возвращается на место
  }

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

  // Пока тянем — фон бледнеет, фото едет за пальцем; отпустили — плавно возвращается
  const fade = Math.min(dragY / 400, 0.6);
  const overlayStyle = dragY > 0 ? { background: `rgba(10,7,5,${0.92 * (1 - fade)})` } : undefined;
  const imageStyle = {
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : 'transform .2s ease'
  };

  return (
    <div
      className="lightbox-overlay"
      style={overlayStyle}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Кнопка «назад» — видна только на телефоне (см. index.css), вверху слева */}
      <button
        className="lightbox-back"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Назад"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
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
        style={imageStyle}
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
