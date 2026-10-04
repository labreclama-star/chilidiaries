import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PepperIcon from './PepperIcon.jsx';
import Avatar from './Avatar.jsx';
import Badge from './Badge.jsx';
import StarRating from './StarRating.jsx';
import { MiniHeatGauge } from './HeatGauge.jsx';
import { heatColor, fmtNum, podMediaStyle } from '../utils/helpers.js';
import { computeVarietyRatings } from '../utils/varietyRatings.js';
import { useApp } from '../context/AppContext.jsx';

export default function VarietyCard({ variety }) {
  const { varietyVotes, growers } = useApp();
  const avgShu = (variety.shuMin + variety.shuMax) / 2;
  const color = heatColor(avgShu);
  const ratings = computeVarietyRatings(variety, varietyVotes);

  // Автор сорта (только для сортов «от сообщества»). В данных сорта addedById —
  // uuid гровера, addedBy — имя. Гровера ищем по id: так подтянется его аватар.
  // Если гровера в списке нет (например, удалён) — показываем имя из addedBy без фото.
  const author = variety.userAdded && variety.addedById
    ? growers.find((x) => x.id === variety.addedById)
    : null;
  const authorName = author ? author.name : (variety.userAdded ? variety.addedBy : null);

  // Описание в превью обрезано до 5 строк (CSS .variety-desc). Кнопку «Показать
  // полностью» показываем, только если текст реально не влез: сравниваем полную
  // высоту текста с видимой. Пересчитываем при смене текста, ширины окна и
  // после загрузки шрифтов (от них зависит число строк).
  const descRef = useRef(null);
  const [isClamped, setIsClamped] = useState(false);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return undefined;
    const check = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener('resize', check);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
    return () => window.removeEventListener('resize', check);
  }, [variety.desc]);

  return (
    <Link to={`/varieties/${variety.id}`} className="card" style={{ cursor: 'pointer' }}>
      <div className="pod-media" style={podMediaStyle(variety, color)}>
        <Badge kind="heat">{fmtNum(variety.shuMax)} SHU</Badge>
        {!variety.photo && <PepperIcon color={color} />}
        {variety.userAdded && (
          <Badge kind="stage" style={{ right: 10, left: 'auto' }}>от сообщества</Badge>
        )}
      </div>
      <div className="card-body">
        <h3>{variety.name}</h3>
        <span style={{ fontSize: 11.5, color: 'var(--cream-faint)' }}>{variety.species}</span>
        <StarRating value={ratings.overall} compact />
        <MiniHeatGauge shu={avgShu} />
        <p ref={descRef} className="variety-desc" style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>{variety.desc}</p>
        {/* Вся карточка — уже ссылка на /varieties/:id, поэтому здесь span, а не вложенный <a> */}
        {isClamped && <span className="variety-more">Показать полностью →</span>}
        <div className="card-tags">
          <Badge>Сложность: {variety.difficulty}</Badge>
          <Badge>{variety.days} дн.</Badge>
        </div>
        {/* Строка автора — обычный div, а не ссылка: вся карточка уже <Link>, вложенные ссылки нельзя */}
        {authorName && (
          <div className="card-meta">
            <Avatar name={authorName} photo={author?.avatar} size={20} />
            <span>{authorName}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
