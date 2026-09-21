// Фабрики доменных сущностей ChiliDiaries.
//
// ВАЖНО: этот файл НЕ подключён ни к services/*, ни к AppContext.jsx —
// по правилу Этапа 2 существующий код не трогаем. Сейчас в services/*.js
// уже есть свои конструкторы (createDiaryFromWizard, createWeekReport,
// createRecipeFromForm, createQuestionFromForm, createUserGrower) — они
// заточены под конкретные формы (принимают, например, объект сорта, а не id).
// Фабрики здесь — более простые и "канонические": принимают только то, что
// реально будет в строке БД (id-ссылки, а не вложенные объекты), с явными
// дефолтами. На Этапе 3 можно будет решить: либо services/* начнут звать
// эти фабрики внутри себя, либо они останутся параллельно как база для
// мигратора (Этап 6). Ничего не решаем здесь — просто готовим кирпичи.

/**
 * Транслитерация кириллицы + slugify. Нужна, потому что сегодня
 * blogPost.slug генерируется как 'article-' + Date.now() (не из title),
 * а требования Этапа 5/6 предполагают человекочитаемые slug'и.
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };
  const transliterated = String(input || '')
    .toLowerCase()
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Простой уникальный id для мок-слоя (см. риск №6 из отчёта Этапа 1 —
 *  не UUID; при заливке в Supabase мигратор сгенерирует настоящие UUID). */
function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * @param {Object} input
 * @param {string} input.name
 * @param {string} [input.loc]
 * @param {string} [input.bio]
 * @param {?string} [input.avatar]
 * @param {'user'|'admin'} [input.role]
 * @returns {import('./types.js').Grower}
 */
export function createGrower({ name, loc = '', bio = '', avatar = null, role = 'user' }) {
  return {
    id: nextId('g'),
    name,
    loc,
    bio,
    diaries: 0,
    followers: 0,
    avatar,
    online: true,
    role,
    joinedAt: new Date().toISOString(),
    banned: false,
    deleted: false
  };
}

/**
 * @param {Object} input
 * @param {string} input.title
 * @param {string} [input.desc]
 * @param {string} input.varietyId - основной сорт (первым попадёт в varietyIds)
 * @param {string[]} [input.varietyIds] - если не передано, будет [varietyId]
 * @param {string} input.growerId
 * @param {string} [input.stage] - по умолчанию первая стадия из DIARY_STAGES
 * @param {string} [input.location]
 * @param {string} [input.medium]
 * @param {string[]} [input.techniques]
 * @param {string} [input.startDate] - 'YYYY-MM-DD', по умолчанию сегодня
 * @param {?string} [input.coverPhoto]
 * @param {string} [input.reportInterval]
 * @param {number} [input.shu]
 * @returns {import('./types.js').Diary}
 */
export function createDiary({
  title, desc = '', varietyId, varietyIds, growerId, stage = 'Рассада',
  location = '', medium = '', techniques = [], startDate, coverPhoto = null,
  reportInterval = 'weekly', shu = 0
}) {
  return {
    id: nextId('d'),
    title,
    desc,
    varietyId,
    varietyIds: varietyIds && varietyIds.length ? varietyIds : [varietyId],
    growerId,
    stage,
    location,
    medium,
    techniques,
    likes: 0,
    liked: false,
    followers: 0,
    shu,
    startDate: startDate || new Date().toISOString().slice(0, 10),
    coverPhoto,
    reportInterval,
    weeks: [],
    comments: []
  };
}

/**
 * @param {Object} input
 * @param {number} input.n
 * @param {number} input.day
 * @param {string} input.title
 * @param {?string} [input.stage]
 * @param {string} [input.date] - локализованная строка; по умолчанию сегодняшняя дата в формате 'DD мес'
 * @param {string} [input.note]
 * @param {number|string} [input.temp]
 * @param {number|string} [input.hum]
 * @param {string[]} [input.photos]
 * @returns {import('./types.js').DiaryReport}
 */
export function createDiaryReport({
  n, day, title, stage = null, date, note = '', temp = '', hum = '', photos = []
}) {
  return {
    n,
    day,
    title,
    stage,
    date: date || new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
    note,
    temp,
    hum,
    photos
  };
}

/**
 * @param {Object} input
 * @param {string} input.title
 * @param {string} input.category - см. RECIPE_CATEGORIES в domain/schema.js
 * @param {string} input.growerId
 * @param {?string} [input.varietyId]
 * @param {string} [input.desc]
 * @param {string[]} [input.ingredients]
 * @param {string[]} [input.steps]
 * @param {?string} [input.photo]
 * @returns {import('./types.js').Recipe}
 */
export function createRecipe({
  title, category, growerId, varietyId = null, desc = '', ingredients = [], steps = [], photo = null
}) {
  return {
    id: nextId('r'),
    title,
    category,
    growerId,
    varietyId,
    desc,
    ingredients,
    steps,
    photo,
    likes: 0,
    liked: false,
    views: 0
  };
}

/**
 * @param {Object} input
 * @param {string} input.text
 * @param {string} input.growerId
 * @param {?string} [input.diaryId]
 * @param {?string} [input.stage] - см. QUESTION_STAGES
 * @param {?string} [input.topic] - см. QUESTION_TOPICS
 * @param {?string} [input.photo]
 * @returns {import('./types.js').Question}
 */
export function createQuestion({ text, growerId, diaryId = null, stage = null, topic = null, photo = null }) {
  const now = new Date().toISOString();
  return {
    id: nextId('q'),
    growerId,
    diaryId,
    text,
    photo,
    stage,
    topic,
    status: 'open',
    likes: 0,
    liked: false,
    createdAt: now,
    updatedAt: now,
    answers: []
  };
}
