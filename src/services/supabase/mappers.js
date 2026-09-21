// Маппинг между строками таблиц Supabase (snake_case) и формой объектов,
// в которой прототип работает на фронте (camelCase, см. src/types.js).
// Один файл на все сервисы (см. комментарий в исходной версии про
// varietyRowToJs) — по мере переключения Этапа 3 сюда дописываются
// growerRowToJs, lightRowToJs, nutrientRowToJs и далее.

import { timeAgo } from '../../utils/helpers.js';

/**
 * Строка таблицы varieties (snake_case) -> объект Variety (camelCase),
 * ТОЧНО той же формы, что и элементы VARIETIES из src/data/varieties.js.
 *
 * addedBy — ИМЯ автора (в моке и в UI это строка-имя, а в БД added_by — uuid).
 * Имя приходит джойном `author:profiles!added_by(name)` в varietyService
 * (many-to-one → PostgREST отдаёт ОДИН объект, не массив). uuid автора
 * сохранён отдельно в addedById. Фолбэки, когда джойна нет или added_by
 * стал null (FK ON DELETE SET NULL / сорт добавлен админом):
 * userAdded ? 'Гровер' : 'admin' — как в моке (createVarietyFromAdminForm).
 * @param {Record<string, any>} row
 * @returns {import('../../types.js').Variety}
 */
export function varietyRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    shuMin: row.shu_min,
    shuMax: row.shu_max,
    rating: row.rating,
    capsaicinRating: row.capsaicin_rating,
    aromaRating: row.aroma_rating,
    difficulty: row.difficulty,
    days: `${row.days_min}-${row.days_max}`,
    origin: row.origin,
    photo: row.photo_url,
    desc: row.description,
    userAdded: row.user_added,
    addedBy: row.author?.name ?? (row.user_added ? 'Гровер' : 'admin'),
    addedById: row.added_by ?? null
  };
}

/**
 * Строка таблицы variety_votes -> голос в форме state varietyVotes
 * ({ varietyId, userId, overall, capsaicin, aroma, ts }) — ровно то, что
 * ждёт utils/varietyRatings.js. numeric из PostgREST может прийти строкой,
 * поэтому явный Number().
 * @param {Record<string, any>} row
 */
export function varietyVoteRowToJs(row) {
  return {
    varietyId: row.variety_id,
    userId: row.user_id,
    overall: Number(row.overall),
    capsaicin: Number(row.capsaicin),
    aroma: Number(row.aroma),
    ts: row.voted_at
  };
}

/**
 * Строка таблицы seed_bank_items -> запись банка семян в форме, которую
 * раньше создавал локальный addSeed: { id, name, varietyId, quantity,
 * status, notes, addedAt }. quantity/notes в БД nullable — приводим к ''.
 * @param {Record<string, any>} row
 */
export function seedRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    varietyId: row.variety_id,
    quantity: row.quantity ?? '',
    status: row.status,
    notes: row.notes ?? '',
    addedAt: row.added_at
  };
}

/**
 * Строка таблицы profiles (snake_case) -> объект Grower (camelCase),
 * форма — как в src/data/growers.js / src/types.js.
 *
 * diaries и followers — денормализованные счётчики в JS-форме Grower,
 * но в схеме profiles таких колонок нет: это агрегаты (count строк в
 * diaries / count строк в follows), а не собственные поля профиля.
 * Поэтому growerService запрашивает их через PostgREST embedded count
 * (см. growerService.js): `diaries:diaries(count)` и
 * `followers:follows!followed_id(count)`. Хинт `!followed_id` обязателен —
 * в follows два FK на profiles (follower_id и followed_id), без явного
 * указания колонки PostgREST не может выбрать, какой из них строить embed.
 * Результат embedded count всегда приходит как массив вида
 * [{ count: N }], в т.ч. когда N === 0 — поэтому читаем row.diaries?.[0]?.count,
 * а не row.diaries.count.
 *
 * `following` (число подписок текущего гровера на других) сюда сознательно
 * НЕ добавляется: в typedef Grower (types.js) такого поля нет, и ни один
 * компонент (GrowerCard.jsx, Growers.jsx, GrowerDetail.jsx) его не рендерит —
 * там "Мои подписки" считаются на клиенте через growers.filter(g._followed),
 * а не из строки гровера.
 *
 * _followed сюда тоже не попадает: это сессионный флаг, добавляемый в
 * AppContext.toggleFollowGrower, а не поле из БД (см. types.js).
 *
 * @param {Record<string, any>} row
 * @returns {import('../../types.js').Grower}
 */
export function growerRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    loc: row.loc,
    bio: row.bio,
    diaries: row.diaries?.[0]?.count ?? 0,
    followers: row.followers?.[0]?.count ?? 0,
    avatar: row.avatar_url,
    online: row.online,
    role: row.role,
    joinedAt: row.joined_at,
    banned: row.banned,
    deleted: row.deleted
  };
}

/**
 * Строка таблицы lights (snake_case) -> объект Light (camelCase),
 * форма — как в src/data/lights.js / src/types.js.
 * @param {Record<string, any>} row
 * @returns {import('../../types.js').Light}
 */
export function lightRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    type: row.type,
    tag: row.tag,
    price: row.price,
    rating: row.rating,
    desc: row.description,
    link: row.link,
    photo: row.photo_url,
    sponsored: row.sponsored
  };
}

/**
 * Строка таблицы nutrients (snake_case) -> объект Nutrient (camelCase).
 * Nutrient — форма, идентичная Light (см. types.js: "@typedef {Light} Nutrient"),
 * но таблица отдельная, поэтому маппер отдельный (не алиас) — на случай,
 * если формы разойдутся на будущих этапах, здесь не придётся выяснять,
 * какой из двух вызовов маппера трогать.
 * @param {Record<string, any>} row
 * @returns {import('../../types.js').Nutrient}
 */
export function nutrientRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    type: row.type,
    tag: row.tag,
    price: row.price,
    rating: row.rating,
    desc: row.description,
    link: row.link,
    photo: row.photo_url,
    sponsored: row.sponsored
  };
}

/**
 * Строка таблицы recipes (snake_case) -> объект Recipe (camelCase),
 * форма — как в src/data/recipes.js / src/domain/types.js.
 *
 * Сверено с моком: у Recipe НЕТ поля authorName/growerName — компоненты
 * резолвят автора через growerId сами, поэтому джойн на profiles здесь не
 * нужен (в отличие от answers.author, см. answerRowToJs).
 *
 * hidden: в src/data/recipes.js сид-записи вообще не имеют этого поля
 * (значит "не скрыто"); из БД колонка hidden приходит всегда, поэтому
 * явно привожу к boolean, чтобы не тащить null/undefined в UI-условия
 * вида `recipe.hidden && ...`.
 *
 * liked: false — сессионный флаг, в БД его нет (см. правило Группы A/B).
 *
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').Recipe}
 */
export function recipeRowToJs(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    growerId: row.grower_id,
    varietyId: row.variety_id,
    desc: row.description,
    ingredients: row.ingredients,
    steps: row.steps,
    photo: row.photo_url,
    likes: row.likes_count,
    liked: false,
    views: row.views_count,
    hidden: !!row.hidden
  };
}

/**
 * Строка таблицы blog_posts (snake_case) -> объект BlogPost (camelCase),
 * форма — как в src/data/blogPosts.js / src/domain/types.js.
 *
 * ВАЖНО (расхождение с изначальным списком расхождений в задаче Группы B):
 * в typedef BlogPost и в самом моке поле называется `excerpt`, а не `desc` —
 * маплю db.excerpt -> js.excerpt "как есть", без переименования.
 *
 * Как и у Recipe, authorName/growerName в форме BlogPost нет — джойн на
 * profiles не нужен.
 *
 * rejectReason — опциональное поле (typedef: [rejectReason]), в БД колонка
 * reject_reason скорее всего null у всех, кроме статуса 'rejected'; передаю
 * как есть (null, если не задано) — компоненты, читающие post.rejectReason,
 * должны нормально работать и с null, как с "поля нет".
 *
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').BlogPost}
 */
export function blogPostRowToJs(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    growerId: row.grower_id,
    varietyId: row.variety_id,
    photo: row.photo_url,
    tags: row.tags,
    excerpt: row.excerpt,
    content: row.content,
    date: row.published_date,
    status: row.status,
    rejectReason: row.reject_reason,
    views: row.views_count,
    likes: row.likes_count,
    liked: false
  };
}

/**
 * Строка таблицы answers (JOIN на profiles по author_id) -> объект Answer
 * (camelCase), форма — как в элементах question.answers из моков.
 *
 * author — единственное место в Группе B, где реально нужен джойн: в моке
 * question.answers[].author — ИМЯ гровера строкой (см. types.js: "(mock)
 * имя строкой, НЕ growerId"), а в БД у answers есть только author_id.
 * questionService.js делает select с
 *   `answers:answers(*, author:profiles!author_id(name))`
 * — PostgREST возвращает связанный profiles-объект как ОДИН объект (не
 * массив), т.к. это many-to-one (у каждого answer один автор), поэтому
 * здесь row.author?.name, а не row.author?.[0]?.name (в отличие от counts
 * в growerRowToJs, где связь one-to-many и PostgREST возвращает массив).
 *
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').Answer}
 */
export function answerRowToJs(row) {
  return {
    id: row.id,
    author: row.author?.name ?? 'Гровер',
    text: row.text_content,
    createdAt: row.created_at
  };
}

/**
 * Строка таблицы questions (snake_case, + вложенные answers через JOIN) ->
 * объект Question (camelCase), форма — как в src/data/questions.js /
 * src/domain/types.js.
 *
 * growerId у Question не сопровождается growerName/author в форме мока —
 * джойн на profiles для самого вопроса не нужен (только для answers[],
 * см. answerRowToJs).
 *
 * @param {Record<string, any>} row - строка questions с вложенным answers[]
 * @returns {import('../../domain/types.js').Question}
 */
export function questionRowToJs(row) {
  return {
    id: row.id,
    growerId: row.grower_id,
    diaryId: row.diary_id,
    text: row.text_content,
    photo: row.photo_url,
    stage: row.stage,
    topic: row.topic,
    status: row.status,
    likes: row.likes_count,
    liked: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    answers: (row.answers || []).map(answerRowToJs)
  };
}

/**
 * Строка таблицы diary_photos -> элемент report.photos[].
 *
 * ВАЖНО: в моке (см. helpers.js: generateWeeks) report.photos — массив
 * ГОЛЫХ СТРОК (URL), не объектов: WeekItem.jsx делает `<img src={src}>`
 * прямо по элементам массива и `photos[0]` как "cover". Поэтому здесь
 * возвращаем просто row.url, а не { url: row.url } — в отличие от
 * большинства других мапперов в этом файле.
 * @param {Record<string, any>} row
 * @returns {string}
 */
export function diaryPhotoRowToJs(row) {
  return row.url;
}

/**
 * Строка таблицы diary_reports (+ вложенные diary_photos) -> объект
 * DiaryReport (camelCase), форма — как в элементах diary.weeks из мока
 * (см. helpers.js: generateWeeks).
 *
 * date: мок хранит ЛОКАЛИЗОВАННУЮ строку вида '02 апр' (НЕ ISO — см.
 * types.js), потому что WeekItem.jsx рендерит `{week.date}` как есть, без
 * форматирования. report_date из БД — настоящая дата, поэтому форматирую
 * её в тот же вид (`toLocaleDateString('ru-RU', { day:'2-digit', month:'short' })`),
 * который использует generateWeeks(), — иначе на карточке отчёта появится
 * "неправильный" формат по сравнению с остальным проектом.
 *
 * photos сортирую по position на стороне JS (а не через .order() в
 * supabase-запросе): report_reports->diary_photos — вложение ВТОРОГО
 * уровня (diaries->reports->photos), и синтаксис referencedTable для
 * такой глубины в supabase-js документирован ненадёжно — сортировка в
 * мапере детерминирована независимо от того, что вернёт PostgREST.
 *
 * @param {Record<string, any>} row - строка diary_reports с вложенным photos[]
 * @returns {import('../../domain/types.js').DiaryReport}
 */
export function diaryReportRowToJs(row) {
  const photos = (row.photos || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(diaryPhotoRowToJs);
  return {
    n: row.report_number,
    day: row.day_number,
    title: row.title,
    stage: row.stage,
    date: row.report_date ? new Date(row.report_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '',
    note: row.note,
    temp: row.temp_c,
    hum: row.humidity,
    photos
  };
}

/**
 * Строка таблицы comments (JOIN на profiles по author_id) -> объект
 * DiaryComment (camelCase), форма — как в элементах diary.comments из
 * мока (см. helpers.js: generateComments).
 *
 * time: мок кладёт ФЕЙКОВУЮ человекочитаемую строку (`${i+1}д назад`),
 * сгенерированную один раз при сборке сид-данных, а НЕ настоящий
 * относительный возраст. В БД у comments есть настоящий created_at, и в
 * helpers.js уже есть готовая живая функция timeAgo(iso) для именно этого
 * случая (используется где-то ещё в проекте для реального "N мин назад").
 * Использую её здесь, чтобы Comment.jsx (который просто рендерит
 * comment.time как есть) получил корректную строку без необходимости
 * трогать сам компонент.
 *
 * @param {Record<string, any>} row - строка comments с вложенным author:{name}
 * @returns {import('../../domain/types.js').DiaryComment}
 */
export function commentRowToJs(row) {
  // author в Comment.jsx — СТРОКА (имя). PostgREST отдаёт вложенный
  // author как объект { name }, поэтому берём .name; строку принимаем как есть.
  const authorName = typeof row.author === 'string' ? row.author : row.author?.name;
  return {
    id: row.id, // нужен родителю для key={comment.id}
    author: authorName || 'Гровер',
    authorId: row.author_id,
    text: row.text_content,
    time: timeAgo(row.created_at)
  };
}

/**
 * Список id сортов дневника: diaries.variety_id (основной) + вложенный
 * diary_varieties(variety_id) (все выбранные).
 *
 * Инвариант типа Diary "varietyIds[0] === varietyId" сохраняется: основной
 * сорт всегда идёт первым, остальные — после него без дублей (порядок в
 * junction не гарантирован — там нет position).
 *
 * Если diary_varieties не пришёл ИЛИ пришёл пустым (старые дневники без
 * строк в junction, либо RLS не отдаёт junction-строки чужого дневника) —
 * получается [variety_id], то есть прежнее поведение. Голое
 * `row.diary_varieties?.map(...) ?? [row.variety_id]` в случае [] вернуло бы
 * пустой массив, потому что ?? срабатывает только на null/undefined.
 *
 * @param {Record<string, any>} row
 * @returns {string[]}
 */
function varietyIdsFromRow(row) {
  const primary = row.variety_id;
  const all = (row.diary_varieties || []).map((dv) => dv.variety_id).filter(Boolean);
  if (!primary) return all;
  return [primary, ...all.filter((id) => id !== primary)];
}

/**
 * Строка таблицы diaries (snake_case, + опционально вложенные
 * reports:diary_reports(*, photos:diary_photos(*)) и
 * comments:comments(*, author:profiles!author_id(name))) -> объект Diary
 * (camelCase), форма — как в src/data/diaries.js / src/domain/types.js.
 *
 * Работает в двух режимах в зависимости от того, что выбрал select в
 * diaryService.js:
 *  - "облегчённый" (список для каталога, без reports/comments) — тогда
 *    row.reports/row.comments отсутствуют, и weeks/comments становятся [].
 *  - "полный" (getDiaryById) — с вложенными данными.
 * Оба случая покрыты через `row.reports || []` / `row.comments || []`.
 *
 * ИЗВЕСТНЫЙ ПРОБЕЛ СХЕМЫ (см. отчёт Этапа 3, Группа C — как и с
 * diaries/followers у гровера в Группе A, это осознанный временный
 * дефолт, а не ошибка маппинга):
 *  - varietyIds теперь собирается из вложенного diary_varieties(variety_id)
 *    (junction-таблица, Группа 3) — см. varietyIdsFromRow.
 *  - followers: в diaries нет такой колонки (сам типа Diary отмечает это
 *    поле как "денормализовано, сегодня НЕ живое") — ставлю 0.
 *
 * is_private НЕ попадает в возвращаемый объект: этого поля нет в typedef
 * Diary, компоненты о нём не знают (фильтрация происходит на уровне
 * запроса в diaryService.js, а не в форме объекта).
 *
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').Diary}
 */
export function diaryRowToJs(row) {
  const weeks = (row.reports || [])
    .map(diaryReportRowToJs)
    .sort((a, b) => a.n - b.n);
  const comments = (row.comments || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(commentRowToJs);
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    varietyId: row.variety_id,
    varietyIds: varietyIdsFromRow(row),
    growerId: row.grower_id,
    stage: row.stage,
    location: row.location,
    medium: row.medium,
    techniques: row.techniques || [],
    likes: row.likes_count ?? 0,
    liked: false,
    followers: 0, // TODO(Этап 3+): нет денормализованного счётчика в diaries, см. комментарий выше
    shu: row.shu,
    startDate: row.start_date,
    coverPhoto: row.cover_photo_url,
    reportInterval: row.report_interval,
    weeks,
    comments,
    _partial: false
  };
}

/**
 * Лёгкая версия diaryRowToJs — для fetchInitialDiaries (список для
 * каталога/карточек), а НЕ для getDiaryById (там нужен diaryRowToJs с
 * полными weeks/comments).
 *
 * Понадобилась после проверки DiaryCard.jsx: карточка дневника читает
 * diary.comments.length (счётчик комментариев в футере) и передаёт diary
 * в latestReportDay(diary) из helpers.js, которая берёт ПОСЛЕДНИЙ элемент
 * diary.weeks (`diary.weeks[length-1].day || .n`) — то есть ей нужен не
 * весь отчёт, а только его day/n, и порядок элементов массива должен быть
 * по возрастанию дня (иначе "последний" окажется не последним по времени).
 *
 * Соответствующий select в diaryService.js:
 *   reports:diary_reports(day_number), comments:comments(count)
 * — облегчённый, без title/note/photos/author и без полного списка
 * комментариев, чтобы карточки каталога не тащили тяжёлые вложенные данные.
 *
 * comments: намеренно НЕ настоящий массив комментариев, а массив нужной
 * длины (Array.from({length})) — этого достаточно для `.length` в
 * DiaryCard.jsx, но НЕЛЬЗЯ маппить/итерировать по содержимому этого
 * массива (элементы — undefined). Если где-то на карточке понадобится
 * реальный текст/автор комментария, это уже не "лёгкий список".
 *
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').Diary}
 */
export function diaryListRowToJs(row) {
  const weeks = (row.reports || [])
    .slice()
    .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
    .map((r) => ({ day: r.day_number, n: null }));
  const commentsCount = row.comments?.[0]?.count ?? 0;
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    varietyId: row.variety_id,
    varietyIds: varietyIdsFromRow(row),
    growerId: row.grower_id,
    stage: row.stage,
    location: row.location,
    medium: row.medium,
    techniques: row.techniques || [],
    likes: row.likes_count ?? 0,
    liked: false,
    followers: 0, // TODO(Этап 3+): см. комментарий в diaryRowToJs
    shu: row.shu,
    startDate: row.start_date,
    coverPhoto: row.cover_photo_url,
    reportInterval: row.report_interval,
    weeks,
    comments: Array.from({ length: commentsCount }),
    // ВАЖНО: weeks/comments здесь — заглушки только для DiaryCard (.length /
    // latestReportDay). Страница дневника НЕ должна рендерить их, пока
    // _partial === true — сначала loadFullDiary(id) из AppContext.
    _partial: true
  };
}

/**
 * Строка таблицы contests (snake_case) -> объект Contest (camelCase),
 * форма — как в src/data/contests.js / src/domain/types.js.
 *
 * participants: подтверждена таблица contest_participants
 * (contest_id, user_id, joined_at) — считаю через embedded count.
 * participantIds оставляю [] — это администраторский список (мок:
 * "НЕЗАВИСИМ от joinedContestIds"), на публичных страницах не
 * рендерится; если понадобится реальный список участников для админки,
 * это отдельный подзапрос/страница, не текущий геттер.
 * @param {Record<string, any>} row
 * @returns {import('../../domain/types.js').Contest}
 */
export function contestRowToJs(row) {
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    fullDesc: row.full_description,
    prize: row.prize,
    progress: row.progress,
    participants: row.participants_count?.[0]?.count ?? 0,
    participantIds: [],
    deadline: row.deadline,
    startDate: row.start_date,
    status: row.status,
    photo: row.photo_url,
    sponsor: row.sponsor,
    rules: row.rules || [],
    howToJoin: row.how_to_join
  };
}
