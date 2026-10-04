import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Насколько далеко (px) нужно потянуть фото вверх/вниз, чтобы лайтбокс закрылся
const SWIPE_CLOSE_PX = 80;
// Насколько далеко (px) нужно потянуть фото влево/вправо, чтобы перелистнуть
const SWIPE_NAV_PX = 60;
// Сколько пикселей пальцу надо пройти, чтобы понять направление жеста
const AXIS_LOCK_PX = 8;

/**
 * Full-screen photo viewer. `photos` is an array of image URLs/data-URLs,
 * `index` is which one is currently shown, `onClose` closes it, and
 * `onIndexChange` is called with the new index when the user navigates.
 *
 * На телефоне:
 *  - свайп вверх или вниз закрывает лайтбокс;
 *  - свайп влево/вправо листает фото (если их больше одного);
 *  - вверху слева — кнопка «назад».
 *
 * Рендерится через createPortal в document.body — иначе position:fixed
 * ломается, если у родителя есть transform/filter/backdrop-filter, и футер
 * «наезжает» поверх лайтбокса при прокрутке.
 */
export default function Lightbox({ photos, index, onClose, onIndexChange }) {
  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % photos.length);
  }, [index, photos.length, onIndexChange]);

  // offset — на сколько сейчас смещено фото за пальцем; dragging — палец на экране
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  // Состояние текущего жеста. axis: null (ещё не поняли) | 'h' | 'v' | 'none'
  const gesture = useRef(null);
  // После свайпа браузер может выстрелить click по оверлею — не даём ему закрыть лайтбокс
  const justSwiped = useRef(false);

  const multiPhoto = !!photos && photos.length > 1;

  function resetGesture() {
    gesture.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  }

  function handleTouchStart(e) {
    // Жест с двумя пальцами (зум) не трогаем
    if (e.touches.length !== 1) { resetGesture(); return; }
    gesture.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, axis: null, dx: 0, dy: 0 };
    setDragging(true);
  }

  function handleTouchMove(e) {
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length !== 1) { resetGesture(); return; }
    const dx = e.touches[0].clientX - g.startX;
    const dy = e.touches[0].clientY - g.startY;

    // Первые пиксели решают, куда едем: горизонталь (листаем) или вертикаль (закрываем).
    // Дальше ведём только одну ось — они не конфликтуют.
    if (g.axis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) g.axis = multiPhoto ? 'h' : 'none'; // одно фото — листать нечего
      else g.axis = 'v';
      justSwiped.current = true;
    }

    g.dx = dx;
    g.dy = dy;
    if (g.axis === 'h') setOffset({ x: dx, y: 0 });
    else if (g.axis === 'v') setOffset({ x: 0, y: dy });
  }

  function handleTouchEnd() {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    // click после свайпа приходит сразу за touchend — на это время блокируем закрытие по тапу
    if (justSwiped.current) setTimeout(() => { justSwiped.current = false; }, 60);

    if (g && g.axis === 'v' && Math.abs(g.dy) > SWIPE_CLOSE_PX) {
      onClose(); // вверх или вниз — не важно
      return;
    }
    if (g && g.axis === 'h' && Math.abs(g.dx) > SWIPE_NAV_PX) {
      setOffset({ x: 0, y: 0 }); // новое фото плавно «докатится» на место
      if (g.dx < 0) goNext(); // палец влево → следующее
      else goPrev();          // палец вправо → предыдущее
      return;
    }
    setOffset({ x: 0, y: 0 }); // не дотянули — фото возвращается на место
  }

  function handleOverlayClick() {
    if (justSwiped.current) return;
    onClose();
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    // Сохраняем прежнее значение и не даём прокрутке страницы под лайтбоксом
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  if (index == null || !photos || !photos.length) return null;

  // Пока тянем вверх/вниз — фон бледнеет; отпустили — плавно возвращается
  const fade = Math.min(Math.abs(offset.y) / 400, 0.6);
  const overlayStyle = offset.y !== 0 ? { background: `rgba(10,7,5,${0.92 * (1 - fade)})` } : undefined;
  const moved = offset.x !== 0 || offset.y !== 0;
  const imageStyle = {
    transform: moved ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
    transition: dragging ? 'none' : 'transform .2s ease'
  };

  // Портал в document.body: position:fixed перестаёт зависеть от transform/filter
  // у родителя (WeekItem / DiaryHeroGallery), поэтому футер не наезжает.
  return createPortal(
    <div
      className="lightbox-overlay"
      style={overlayStyle}
      onClick={handleOverlayClick}
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
      {multiPhoto && (
        <button
          className="lightbox-nav lightbox-prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Предыдущее фото"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      <img
        src={photos[index]}
        alt=""
        className="lightbox-image"
        style={imageStyle}
        onClick={(e) => e.stopPropagation()}
      />
      {multiPhoto && (
        <button
          className="lightbox-nav lightbox-next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Следующее фото"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
      {multiPhoto && (
        <div className="lightbox-counter">{index + 1} / {photos.length}</div>
      )}
    </div>,
    document.body
  );
}