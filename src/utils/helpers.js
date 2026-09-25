// Pure helper functions ported 1:1 from the original ChiliDiaries prototype.
// No DOM access here — safe to use in components, services or tests.

export function heatLevelLabel(shu) {
  if (shu < 3000) return 'Мягкий';
  if (shu < 15000) return 'Тёплый';
  if (shu < 60000) return 'Острый';
  if (shu < 250000) return 'Очень острый';
  if (shu < 900000) return 'Экстремальный';
  return 'За гранью';
}

/**
 * Derives a small set of collectible-style achievement badges from a
 * grower's existing stats (diaries count, followers). Purely presentational —
 * no new data model, just a nicer way to read numbers that already exist.
 */
/** Unique variety IDs a grower has ever grown, derived from their diaries. */
export function growerVarietyIdsGrown(growerId, diaries) {
  const growerDiaries = diaries.filter((d) => d.growerId === growerId);
  const ids = new Set();
  growerDiaries.forEach((d) => {
    if (d.varietyIds && d.varietyIds.length) d.varietyIds.forEach((id) => ids.add(id));
    else if (d.varietyId) ids.add(d.varietyId);
  });
  return ids;
}

/** Unique varieties a grower has ever grown, derived from their diaries. */
export function growerVarietiesGrown(growerId, diaries, varieties) {
  const ids = growerVarietyIdsGrown(growerId, diaries);
  return [...ids].map((id) => varieties.find((v) => v.id === id)).filter(Boolean);
}

export function growerBadges(grower, varietiesGrownCount = 0, harvestedDiariesCount = 0, contestWinsCount = 0) {
  return [
    { icon: '🌱', label: 'Первый гров', unlocked: grower.diaries >= 1 },
    { icon: '📓', label: '5 дневников', unlocked: grower.diaries >= 5 },
    { icon: '🔥', label: '100+ подписчиков', unlocked: grower.followers >= 100 },
    { icon: '🏆', label: 'Топ-гровер', unlocked: grower.followers >= 400 },
    { icon: '🌶️', label: 'Коллекционер сортов', unlocked: grower.diaries >= 8 },
    { icon: '🥉', label: '10 сортов выращено', unlocked: varietiesGrownCount >= 10 },
    { icon: '🥈', label: '20 сортов выращено', unlocked: varietiesGrownCount >= 20 },
    { icon: '🥇', label: '30 сортов выращено', unlocked: varietiesGrownCount >= 30 },
    { icon: '🎖️', label: 'Закрытие сезона', unlocked: harvestedDiariesCount >= 1 },
    // Этап 6: победа в конкурсе (contest_winners.winner_user_id === grower.id).
    // В конец массива, а не в середину — чтобы не сдвинуть порядок остальных
    // бейджей в уже отрендеренных местах (профиль, карточки).
    { icon: '🏅', label: 'Победитель конкурса', unlocked: contestWinsCount >= 1 }
  ];
}

const STAGE_ORDER_FOR_PROGRESS = ['Рассада', 'Вегетация', 'Цветение', 'Плодоношение', 'Собран урожай'];

/**
 * Real, data-derived "smart stat" for a variety: what share of diaries growing
 * it have reached fruiting-or-later, and the average number of logged weeks
 * it took them to get there. Returns null if there isn't enough data yet
 * (fewer than 2 diaries of that variety) rather than inventing a number.
 */
export function varietyProgressInsight(varietyId, diaries) {
  const pool = diaries.filter((d) => d.varietyId === varietyId);
  if (pool.length < 2) return null;
  const fruitingIdx = STAGE_ORDER_FOR_PROGRESS.indexOf('Плодоношение');
  const reached = pool.filter((d) => STAGE_ORDER_FOR_PROGRESS.indexOf(d.stage) >= fruitingIdx);
  const pct = Math.round((reached.length / pool.length) * 100);
  const avgWeeks = reached.length
    ? Math.round(reached.reduce((sum, d) => sum + d.weeks.length, 0) / reached.length)
    : null;
  return { total: pool.length, pct, avgWeeks };
}

/**
 * Leaderboard scoring: rewards active, engaged, trusted growers rather than
 * just raw follower count. Weighted so a grower with many diaries and real
 * community engagement (likes, published reports) outranks someone who just
 * has a big follower number with no activity behind it.
 *
 *   10  × diaries logged           (starting your own grows)
 * +  1  × followers                (trust from the community)
 * +  2  × total likes received     (quality of the grows people see)
 * +  3  × total week-reports       (consistency of documentation)
 * + 15  × unlocked achievement badges
 */
export function growerScore(grower, diaries) {
  const growerDiaries = diaries.filter((d) => d.growerId === grower.id);
  const totalLikes = growerDiaries.reduce((sum, d) => sum + d.likes, 0);
  const totalWeeks = growerDiaries.reduce((sum, d) => sum + d.weeks.length, 0);
  const varietiesGrownCount = growerVarietyIdsGrown(grower.id, diaries).size;
  const badgesUnlocked = growerBadges(grower, varietiesGrownCount).filter((b) => b.unlocked).length;
  return grower.diaries * 10 + grower.followers * 1 + totalLikes * 2 + totalWeeks * 3 + badgesUnlocked * 15;
}

export function rankGrowers(growers, diaries) {
  return growers
    .map((g) => ({ grower: g, score: growerScore(g, diaries) }))
    .sort((a, b) => b.score - a.score);
}

/** Day-number of the diary's most recent published report (not a live clock
 * calculation off startDate, which can produce huge/wrong numbers if the
 * start date is missing or malformed). Returns null if no reports yet. */
export function latestReportDay(diary) {
  if (!diary.weeks || diary.weeks.length === 0) return null;
  const last = diary.weeks[diary.weeks.length - 1];
  return last.day || last.n || null;
}

/**
 * Flattens the week-reports of a set of growers into a single reverse-
 * chronological feed (most recent report first), each item carrying its
 * parent diary/grower context for rendering.
 */
export function buildFeedItems(followedGrowerIds, diaries) {
  const items = [];
  diaries
    .filter((d) => followedGrowerIds.includes(d.growerId))
    .forEach((d) => {
      d.weeks.forEach((w) => {
        items.push({ diary: d, week: w });
      });
    });
  items.sort((a, b) => (b.week.day || b.week.n) - (a.week.day || a.week.n));
  return items;
}

/**
 * Recommends diaries the user might like based on the varieties they
 * already grow — same variety or same species, from growers they don't
 * already follow, excluding their own diaries.
 */
export function recommendDiaries(currentUserDiaries, allDiaries, varieties, excludeGrowerIds) {
  const myVarietyIds = new Set(currentUserDiaries.map((d) => d.varietyId));
  const mySpecies = new Set(
    [...myVarietyIds].map((id) => varieties.find((v) => v.id === id)).filter(Boolean).map((v) => v.species)
  );
  const myDiaryIds = new Set(currentUserDiaries.map((d) => d.id));

  const scored = allDiaries
    .filter((d) => !myDiaryIds.has(d.id) && !excludeGrowerIds.includes(d.growerId))
    .map((d) => {
      const v = varieties.find((x) => x.id === d.varietyId);
      let score = 0;
      if (myVarietyIds.has(d.varietyId)) score = 2;
      else if (v && mySpecies.has(v.species)) score = 1;
      return { diary: d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.diary);
}

export function dayCount(startDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Percentage difference between this diary's SHU and the average SHU of
 * other diaries growing the same variety (falls back to the average across
 * all diaries if it's the only one of its kind). Powers the "+24% above
 * community average" style comparison chip on diary cards.
 */
export function communityShuDelta(diary, allDiaries) {
  const sameVariety = allDiaries.filter((d) => d.varietyId === diary.varietyId && d.id !== diary.id);
  const pool = sameVariety.length ? sameVariety : allDiaries.filter((d) => d.id !== diary.id);
  if (!pool.length) return null;
  const avg = pool.reduce((sum, d) => sum + d.shu, 0) / pool.length;
  if (!avg) return null;
  return Math.round(((diary.shu - avg) / avg) * 100);
}

export function heatColor(shu) {
  if (shu < 3000) return '#7FAE55';
  if (shu < 15000) return '#A9B84A';
  if (shu < 60000) return '#D9A93B';
  if (shu < 250000) return '#E8781D';
  if (shu < 900000) return '#E8491D';
  return '#8A1F0E';
}

export function heatGaugePos(shu) {
  const max = 2200000;
  const v = Math.max(shu, 50);
  const pos = (Math.log10(v + 1) / Math.log10(max + 1)) * 100;
  return Math.min(97, Math.max(3, pos));
}

export function fmtNum(n) {
  return n.toLocaleString('ru-RU');
}

export function avatarColorFor(str) {
  const colors = ['#F2A93B', '#E8491D', '#7FAE55', '#C4831F', '#5C8A3C', '#FF6B35'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h += str.charCodeAt(i);
  return colors[h % colors.length];
}

export function initials(name) {
  const cleaned = name.replace(/[^A-Za-zА-Яа-яЁё ]/g, '');
  const parts = cleaned.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  return parts || name.slice(0, 2).toUpperCase();
}

export function podMediaStyle(variety, color) {
  if (variety && variety.photo) {
    return {
      backgroundImage: `url('${variety.photo}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }
  return {
    background: `radial-gradient(circle at 30% 20%,${color}33,var(--soil-900) 70%)`
  };
}

/**
 * Same as podMediaStyle, but for a diary card/preview: the grower's own
 * cover photo (set at diary creation) always wins over the variety's stock
 * photo — a diary preview should show what the grower actually grew, not a
 * generic catalog shot.
 */
export function diaryMediaStyle(diary, variety, color) {
  const photo = (diary && diary.coverPhoto) || (variety && variety.photo) || null;
  if (photo) {
    return {
      backgroundImage: `url('${photo}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }
  return {
    background: `radial-gradient(circle at 30% 20%,${color}33,var(--soil-900) 70%)`
  };
}

export const COMMENT_POOL = [
  'Отличный старт! А чем подкармливаешь на этой стадии?',
  'Листья выглядят немного бледновато — не нехватка ли азота?',
  'Красавцы стручки! Сколько уже собрал по весу?',
  'У меня в том сезоне этот сорт капризничал с влажностью, следи за ней.',
  'Подписался, очень интересно наблюдать за прогрессом!',
  'А досветку сколько часов держишь в сутки?',
  'Цвет на последнем фото просто огонь \uD83D\uDD25',
  'Попробуй снизить полив на этой неделе — корни скажут спасибо.',
  'Прям как у меня было на 5 неделе, всё нормально, наберись терпения.',
  'Какой субстрат используешь? Кокос или почвосмесь?'
];

export const WEEK_NOTE_POOL = {
  'Рассада': [
    'Семена проклюнулись на 9 день — чуть дольше обычного, но всходы дружные. Держу тепличку под крышкой ещё пару дней.',
    'Появились первые семядольные листья. Убрал крышку с мини-теплички, начинаю приучать к сухому воздуху комнаты.',
    'Пикировал сеянцы по отдельным стаканчикам. Корневая уже плотная, пересадка прошла без стресса.'
  ],
  'Вегетация': [
    'Куст активно набирает зелёную массу, сделал первую лёгкую подвязку. Полив по подсыханию верхнего слоя.',
    'Начал прищипку верхушки для ветвления — жду, что после топпинга пойдёт 2-3 новых побега.',
    'Подкормил комплексом с азотом, лист стал заметно темнее и плотнее за неделю.',
    'Пересадил в горшок побольше, корни уже оплели весь ком — самое время.',
    'Провёл лёгкую дефолиацию нижнего яруса листьев для лучшей вентиляции куста.'
  ],
  'Цветение': [
    'Появились первые бутоны! Снизил азот, добавил фосфор-калий по фазе.',
    'Массовое цветение — опыляю вручную мягкой кистью каждое утро, чтобы не терять завязи.',
    'Часть цветков осыпалась из-за жары под лампой, поднял светильник на 10 см и добавил обдув.'
  ],
  'Плодоношение': [
    'Завязались первые стручки! Совсем крошечные, ярко-зелёные, растут буквально на глазах.',
    'Стручки набирают размер, некоторые уже с ладонь. Куст явно просит подпорку под тяжестью урожая.',
    'На нескольких стручках заметил первые пятна цвета — начинается созревание.',
    'Основная масса стручков окрасилась, аромат в теплице стоит очень насыщенный.'
  ],
  'Собран урожай': [
    'Собрал финальную партию — куст отдал всё, что мог. Взвесил и разложил сушиться.',
    'Сделал контрольный замер остроты после сушки — ощущения полностью совпали с ожиданиями по сорту.'
  ]
};

export const WEEK_TITLES = {
  'Рассада': ['Проращивание семян', 'Первые всходы', 'Появление настоящих листьев'],
  'Вегетация': ['Активный рост', 'Формирование куста', 'Первая подкормка азотом', 'Пересадка в больший горшок'],
  'Цветение': ['Первые бутоны', 'Массовое цветение', 'Опыление вручную'],
  'Плодоношение': ['Завязались первые стручки', 'Стручки набирают размер', 'Начало окрашивания', 'Стручки почти созрели'],
  'Собран урожай': ['Финальный сбор', 'Замер остроты и веса']
};

export const REPORT_INTERVALS = [
  { value: 'daily', label: 'Каждый день', days: 1 },
  { value: 'every3', label: 'Раз в 3 дня', days: 3 },
  { value: 'weekly', label: 'Раз в неделю', days: 7 },
  { value: 'custom', label: 'Свободный график', days: 7 }
];

export function intervalDays(intervalValue) {
  const found = REPORT_INTERVALS.find((i) => i.value === intervalValue);
  return found ? found.days : 7;
}

export function intervalLabel(intervalValue) {
  const found = REPORT_INTERVALS.find((i) => i.value === intervalValue);
  return found ? found.label : 'Раз в неделю';
}

/** Suggests the next report's day-number based on the diary's chosen interval. */
export function suggestNextReportDay(diary) {
  const step = intervalDays(diary.reportInterval);
  const entries = diary.weeks || [];
  if (entries.length === 0) return step;
  const last = entries[entries.length - 1];
  return (last.day || last.n * step) + step;
}

const STAGES_ORDER = ['Рассада', 'Вегетация', 'Цветение', 'Плодоношение', 'Собран урожай'];

/** Stages a grower can pick for their diary — at creation time and later as it progresses. */
export const DIARY_STAGES = STAGES_ORDER;


/**
 * Generates a deterministic-ish array of grow reports for a diary,
 * spaced by the diary's chosen interval (default weekly) rather than a
 * hard-coded 7 days — ported and extended from the vanilla prototype's
 * generateWeeks().
 */
export function generateWeeks(stage, count, startDate, interval = 'weekly') {
  let startIdx = STAGES_ORDER.indexOf(stage);
  if (startIdx < 0) startIdx = 1;
  const stepDays = intervalDays(interval);
  const weeks = [];
  const d = new Date(startDate);
  for (let i = 0; i < count; i++) {
    const curStage = STAGES_ORDER[Math.min(Math.floor(i / 2), startIdx)];
    const titles = WEEK_TITLES[curStage] || WEEK_TITLES['Вегетация'];
    const title = titles[i % titles.length];
    const day = (i + 1) * stepDays;
    const wd = new Date(d);
    wd.setDate(wd.getDate() + day - stepDays);
    const noteOptions = WEEK_NOTE_POOL[curStage] || WEEK_NOTE_POOL['Вегетация'];
    const note = noteOptions[i % noteOptions.length];
    weeks.push({
      n: i + 1,
      day,
      title,
      stage: curStage,
      date: wd.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      note,
      temp: (22 + Math.random() * 6).toFixed(1),
      hum: (50 + Math.random() * 20).toFixed(0),
      photos: []
    });
  }
  return weeks;
}

/**
 * Generates a small set of seeded demo comments for a diary.
 * `growers` is the full growers array (needed to pick a plausible author).
 */
export function generateComments(count, seed, growers) {
  const comments = [];
  for (let i = 0; i < count; i++) {
    const g = growers[(seed + i * 3) % growers.length];
    comments.push({
      author: g.name,
      text: COMMENT_POOL[(seed + i * 5) % COMMENT_POOL.length],
      time: `${i + 1}д назад`
    });
  }
  return comments;
}

export function recipeCategoryColor(cat) {
  return { 'Соус': '#E8491D', 'Приправа': '#F2A93B', 'Заготовка': '#7FAE55', 'Паста': '#8A1F0E' }[cat] || '#E8491D';
}

export function varietyNames(diary, findVariety) {
  if (diary.varietyIds && diary.varietyIds.length > 1) {
    return diary.varietyIds
      .map((id) => findVariety(id))
      .filter(Boolean)
      .map((v) => v.name)
      .join(' + ');
  }
  const v = findVariety(diary.varietyId);
  return v ? v.name : '';
}

export const stageColorMap = {
  'Рассада': '#8B7C6B',
  'Вегетация': '#7FAE55',
  'Цветение': '#F2A93B',
  'Плодоношение': '#E8491D',
  'Собран урожай': null // resolved to the diary's own heat color at render time
};

// ---- Q&A ("Вопросы") ----

/** Growth-stage tags a question can be filed under (independent from diary.stage naming). */
export const QUESTION_STAGES = ['Прорастание', 'Вегетация', 'Цветение', 'Плодоношение', 'Харвест'];

/** Plant-part / topic tags a question can be filed under. */
export const QUESTION_TOPICS = ['Листья', 'Растение', 'Корни', 'Кормление', 'Другое'];

/**
 * Human-friendly relative time ("5 мин назад", "3 дн назад"...) for any ISO
 * timestamp. Unlike the seed-only `generateComments` pool, this is computed
 * live against the real clock, so it stays accurate as time passes.
 */
export function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес назад`;
  return `${Math.floor(months / 12)} г назад`;
}
