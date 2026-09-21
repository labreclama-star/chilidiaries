// Константы доменной модели ChiliDiaries.
//
// DIARY_STAGES / QUESTION_STAGES / QUESTION_TOPICS / REPORT_INTERVALS /
// stageColorMap уже жили в utils/helpers.js — здесь их НЕ дублируем и НЕ
// удаляем оттуда (по правилу Этапа 2), а просто реэкспортируем, чтобы
// domain/* и будущий код (валидаторы, SQL-схема, мигратор) мог брать все
// enum'ы из одного места — src/domain/schema.js.
export {
  DIARY_STAGES,
  QUESTION_STAGES,
  QUESTION_TOPICS,
  REPORT_INTERVALS,
  stageColorMap
} from '../utils/helpers.js';

// ---------------------------------------------------------------------------
// Новые константы — раньше существовали только как захардкоженные строки
// в JSX (см. отчёт Этапа 1: CreateDiaryWizard.jsx, AddRecipeModal.jsx,
// AdminContests.jsx и т.д.). Значения сверены с реальным кодом, поэтому
// сами компоненты сейчас не трогаем — они и так соответствуют этим спискам.
// ---------------------------------------------------------------------------

/** Роли гровера. В Supabase — profiles.role. */
export const GROWER_ROLES = ['user', 'admin'];

/** Категории рецептов. Значения должны совпадать с recipeCategoryColor() в utils/helpers.js. */
export const RECIPE_CATEGORIES = ['Соус', 'Приправа', 'Заготовка', 'Паста'];

/** Статус модерации статьи блога (см. AdminBlog.jsx). */
export const BLOG_STATUSES = ['pending', 'approved', 'rejected'];

/** Статус конкурса (см. AdminContests.jsx). */
export const CONTEST_STATUSES = ['upcoming', 'active', 'finished'];

/** Статус вопроса в Q&A. */
export const QUESTION_STATUSES = ['open', 'solved'];

/** Статус позиции в банке семян. */
export const SEED_STATUSES = ['have', 'want'];

/** Где выращивается растение (см. CreateDiaryWizard.jsx). */
export const DIARY_LOCATIONS = ['Дома', 'Теплица', 'Открытый грунт'];

/** Субстрат/среда выращивания (см. CreateDiaryWizard.jsx). */
export const DIARY_MEDIUMS = ['Почва', 'Кокос', 'Гидропоника'];

/**
 * Типы бейджей-достижений гровера.
 *
 * ВАЖНО: сегодня badges — это НЕ хранимая сущность. Единственный источник
 * правды для UI — функция growerBadges() в utils/helpers.js, которая
 * вычисляет бейджи на лету по статистике гровера. Эта константа НЕ
 * подключена туда и ничего не меняет в поведении приложения — она просто
 * декларативно описывает те же самые правила (icon/label/условие как текст),
 * чтобы на Этапе 5 по этому списку можно было сгенерировать таблицы
 * badges/user_badges, не выковыривая пороговые числа заново из JSX.
 * Если growerBadges() в будущем изменится — эту константу нужно обновить
 * вручную, автосинхронизации между ними нет.
 */
export const BADGE_TYPES = [
  { id: 'first_diary', icon: '🌱', label: 'Первый гров', rule: 'grower.diaries >= 1' },
  { id: 'five_diaries', icon: '📓', label: '5 дневников', rule: 'grower.diaries >= 5' },
  { id: 'followers_100', icon: '🔥', label: '100+ подписчиков', rule: 'grower.followers >= 100' },
  { id: 'top_grower', icon: '🏆', label: 'Топ-гровер', rule: 'grower.followers >= 400' },
  { id: 'variety_collector', icon: '🌶️', label: 'Коллекционер сортов', rule: 'grower.diaries >= 8' },
  { id: 'varieties_10', icon: '🥉', label: '10 сортов выращено', rule: 'varietiesGrownCount >= 10' },
  { id: 'varieties_20', icon: '🥈', label: '20 сортов выращено', rule: 'varietiesGrownCount >= 20' },
  { id: 'varieties_30', icon: '🥇', label: '30 сортов выращено', rule: 'varietiesGrownCount >= 30' },
  { id: 'season_closed', icon: '🎖️', label: 'Закрытие сезона', rule: 'harvestedDiariesCount >= 1' }
];
