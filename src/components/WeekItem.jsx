import { useState } from 'react';
import PepperIcon from './PepperIcon.jsx';
import PhotoFrame from './PhotoFrame.jsx';
import Lightbox from './Lightbox.jsx';
import { stageColorMap } from '../utils/helpers.js';

export default function WeekItem({ week, diaryColor }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const wc = (stageColorMap[week.stage] ?? diaryColor) || diaryColor;
  const photos = week.photos && week.photos.length ? week.photos : (week.photo ? [week.photo] : []);
  const cover = photos[0] || null;

  return (
    <div className="week-item" id={`report-day-${week.day || week.n}`}>
      <span className="week-date">День {week.day || week.n} · {week.date}</span>
      <h4>{week.title}</h4>

      <div
        className="week-photo-main"
        style={!cover ? { background: `radial-gradient(circle at 30% 20%,${wc}40,var(--soil-900) 75%)` } : undefined}
        onClick={() => cover && setLightboxIndex(0)}
      >
        <PhotoFrame src={cover} />
        {!cover && <PepperIcon color={wc} />}
        {photos.length > 1 && <span className="photo-count-badge">1 / {photos.length}</span>}
      </div>

      {photos.length > 1 && (
        <div className="week-thumb-row">
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" onClick={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      <div className="week-stats"><span>🌡 {week.temp}°C</span><span>💧 {week.hum}%</span></div>
      <p>{week.note}</p>

      {lightboxIndex != null && (
        <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </div>
  );
}
