import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import VarietyCard from '../components/VarietyCard.jsx';
import Avatar from '../components/Avatar.jsx';
import Reveal from '../components/Reveal.jsx';
import { TESTIMONIALS } from '../data/testimonials.js';
import { PHOTOS } from '../data/photos.js';
import { fmtNum } from '../utils/helpers.js';

const STATS = [
  { count: 1284, label: 'Дневников' },
  { count: 742, label: 'Гроверов' },
  { count: 356, label: 'Собрано урожаев' },
  { count: 46, label: 'Сортов в каталоге' }
];

const FEATURES = [
  { icon: '🌱', color: 'green', title: 'Шаг за шагом', text: 'Фиксируй каждый этап от семечки до урожая' },
  { icon: '📊', color: 'orange', title: 'Сравнивай', text: 'Сравнивай свой гров со средними показателями' },
  { icon: '🌶️', color: 'red', title: 'Учись', text: 'Учись у опытных гроверов и обменивайся опытом' },
  { icon: '⭐', color: 'purple', title: 'Получай бейджи', text: 'Получай бейджи за собранный урожай и достижения' }
];

function CountUpStat({ target, label }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const step = Math.max(1, Math.round(target / 40));
    let cur = 0;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(iv); }
      setValue(cur);
    }, 25);
    return () => clearInterval(iv);
  }, [target]);
  return (
    <div className="stat" ref={ref}>
      <b>{fmtNum(value)}+</b>
      <span>{label}</span>
    </div>
  );
}

export default function Home() {
  const { diaries, varieties, openWizard, settings } = useApp();

  const trending = diaries.slice().sort((a, b) => b.likes - a.likes).slice(0, 3);
  const featuredVarieties = varieties.filter((v) => v.photo).concat(varieties.filter((v) => !v.photo)).slice(0, 7);

  return (
    <>
      {settings.bannerEnabled && settings.bannerText && (
        <div className="site-banner">
          <div className="wrap site-banner-inner">
            {settings.bannerPhoto && <img src={settings.bannerPhoto} alt="" />}
            <span>{settings.bannerText}</span>
          </div>
        </div>
      )}
      {/* Фон hero: приоритет у settings.heroPhoto (админка), дальше дефолт PHOTOS.hero
          (/hero.webp из public/; тот же путь предзагружается в index.html через <link rel="preload">).
          Фото передаём через CSS-переменную --hero-photo, а градиент-оверлей живёт в index.css
          (.billboard-hero): тёмный по умолчанию и светлый для html[data-theme="light"]. */}
      <section
        className="hero billboard-hero"
        style={{ '--hero-photo': `url('${settings.heroPhoto || PHOTOS.hero}')` }}
      >
        <div className="wrap hero-grid hero-grid-single">
          <div>
            <span className="eyebrow">Дневник твоего урожая · Опыт сообщества · Результат</span>
            <h1>
              Веди дневник своего <em>перца</em>
            </h1>
            <p className="hero-tagline">
              <span className="tag-green">Сравнивай.</span> <span className="tag-orange">Расти.</span> <span className="tag-red">Собирай.</span>
            </p>
            <p className="lead">ChiliDiaries — площадка, где гроверы острого перца ведут пошаговые дневники: от проращивания до сбора и замера остроты.</p>

            <div className="hero-features">
              {FEATURES.map((f) => (
                <div className="feature-chip" key={f.title} data-color={f.color}>
                  <span className="feature-icon">{f.icon}</span>
                  <b>{f.title}</b>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>

            <div className="hero-ctas">
              <button className="btn cta-highlight" onClick={openWizard}>Начни свой первый дневник! →</button>
              <a href="/diaries" className="btn btn-outline">Смотреть дневники</a>
            </div>
            <div className="hero-stats">
              {STATS.map((s) => <CountUpStat key={s.label} target={s.count} label={s.label} />)}
            </div>
          </div>
        </div>
      </section>

      <Reveal as="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">На пике роста</span>
              <h2 className="section-title">Популярные <em>дневники</em> прямо сейчас</h2>
            </div>
            <a href="/diaries" className="btn btn-outline btn-sm">Все дневники →</a>
          </div>
          <div className="grid grid-3">
            {trending.map((d) => <DiaryCard key={d.id} diary={d} />)}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" style={{ paddingTop: 0 }} delay={80}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Каталог сортов</span>
              <h2 className="section-title">Сорта <em>недели</em></h2>
            </div>
            <a href="/varieties" className="btn btn-outline btn-sm">Весь каталог →</a>
          </div>
          <div className="hscroll">
            {featuredVarieties.map((v) => (
              <div className="variety-card" key={v.id}><VarietyCard variety={v} /></div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Процесс</span>
              <h2 className="section-title">Как это <em>работает</em></h2>
            </div>
          </div>
          <div className="steps">
            <div className="step"><span className="num">01</span><h3>Заведи дневник</h3><p>Выбери сорт из каталога или добавь свой, укажи среду выращивания, освещение и старт — дневник готов за минуту.</p></div>
            <div className="step"><span className="num">02</span><h3>Публикуй отчёты</h3><p>Добавляй фото и заметки в своём темпе — каждый день, раз в неделю или как удобно: рост, подкормки, проблемы. Сообщество подскажет, если что-то пошло не так.</p></div>
            <div className="step"><span className="num">03</span><h3>Собери урожай</h3><p>Отметь дневник как «Собран», добавь замер остроты и вес урожая — получи бейдж и попади в топ сезона.</p></div>
          </div>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Отзывы</span>
              <h2 className="section-title">Что говорят <em>гроверы</em></h2>
            </div>
          </div>
          <div className="grid grid-3">
            {TESTIMONIALS.map((t) => (
              <div className="testi" key={t.author}>
                <p>«{t.text}»</p>
                <footer>
                  <Avatar name={t.author} size={36} />
                  <div><b>{t.author}</b><br /><span>{t.role}</span></div>
                </footer>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="gauge-card" style={{ borderRadius: 24, padding: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <h2 className="section-title" style={{ margin: '0 0 8px' }}>Готов вырастить свой <em>Reaper</em>?</h2>
              <p className="section-sub">Присоединяйся к 742 гроверам, которые уже документируют свой сезон.</p>
            </div>
            <button className="btn btn-primary" onClick={openWizard}>Начать дневник бесплатно</button>
          </div>
        </div>
      </section>
    </>
  );
}
