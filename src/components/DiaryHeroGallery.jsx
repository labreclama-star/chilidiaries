import { useRef, useState } from 'react';
import PhotoFrame from './PhotoFrame.jsx';
import Lightbox from './Lightbox.jsx';

/**
 * `photos` must be a non-empty array — the caller decides what counts as
 * "no photos" and renders its own gradient/icon fallback in that case (see
 * DiaryDetail.jsx), same as before this component existed.
 */
export default function DiaryHeroGallery({ photos }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function handleScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(photos.length - 1, Math.max(0, idx)));
  }

  return (
    <>
      <div className="diary-hero-track" ref={trackRef} onScroll={handleScroll}>
        {photos.map((src, i) => (
          <div className="diary-hero-slide" key={i} onClick={() => setLightboxOpen(true)}>
            <PhotoFrame src={src} />
          </div>
        ))}
      </div>
      {photos.length > 1 && <span className="photo-count-badge">{active + 1} / {photos.length}</span>}

      {lightboxOpen && (
        <Lightbox photos={photos} index={active} onClose={() => setLightboxOpen(false)} onIndexChange={setActive} />
      )}
    </>
  );
}
