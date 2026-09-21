/**
 * Shows a photo without ever cropping it: a blurred, scaled copy of the same
 * photo fills the box as a backdrop (so there's no awkward letterbox bars),
 * and the actual photo sits on top at `background-size:contain`, fully
 * visible. Used anywhere a user's own uploaded photo is the main thing being
 * looked at (diary hero, week report photo) — as opposed to small grid
 * thumbnails (`.pod-media` cards), which intentionally crop to a consistent
 * square/ratio like a normal photo grid.
 *
 * Must be placed inside a `position:relative;overflow:hidden` container —
 * both `.diary-hero-media` and `.week-photo-main` already are.
 */
export default function PhotoFrame({ src }) {
  if (!src) return null;
  return (
    <>
      <div className="media-backdrop" style={{ backgroundImage: `url('${src}')` }} />
      <div className="media-frame" style={{ backgroundImage: `url('${src}')` }} />
    </>
  );
}
