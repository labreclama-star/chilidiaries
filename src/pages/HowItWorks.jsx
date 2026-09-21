export default function HowItWorks() {
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Гид</span>
          <h1>Как работает ChiliDiaries</h1>
          <p>Всё, что нужно знать, чтобы начать вести свой дневник и стать частью сообщества.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 44, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="steps" style={{ marginBottom: 50 }}>
          <div className="step"><span className="num">01</span><h3>Регистрация</h3><p>Создай анонимный профиль за 30 секунд — без реального имени и почты для рассылок.</p></div>
          <div className="step"><span className="num">02</span><h3>Настрой дневник</h3><p>Укажи сорт, среду (почва/кокос/гидропоника), место (дом/теплица/грунт) и стартовую дату.</p></div>
          <div className="step"><span className="num">03</span><h3>Веди отчёты</h3><p>Публикуй записи в своём темпе — каждый день, раз в 3 дня или раз в неделю — с фото и параметрами: температура, влажность, подкормки.</p></div>
        </div>
        <div className="grid grid-2">
          <div className="side-card">
            <h4>Бейджи и достижения</h4>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.6 }}>За каждый завершённый дневник ты получаешь бейдж «Собранный урожай». За дневники с более чем 10 отчётами — бейдж «Мастер-гровер». Самые острые сорта в дневнике дают бейдж «Огнеед».</p>
          </div>
          <div className="side-card">
            <h4>Анонимность</h4>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.6 }}>Все дневники по умолчанию публикуются под ником. Ты сам решаешь, показывать ли точную локацию — можно указать только регион или скрыть полностью.</p>
          </div>
        </div>
      </div>
    </>
  );
}
