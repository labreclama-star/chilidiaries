# ChiliDiaries — сводка для переноса в новый чат

> Этот файл — компактный конспект для быстрого старта в новом чате.
> Полная версия истории решений — в `HANDOFF.md` (раздел «10. Подготовка
> к Supabase» и разделы выше), но для продолжения работы достаточно этого файла.

---

## 1. Суть проекта

**ChiliDiaries** — социальная платформа для гроверов острого перца (аналог
дневников выращивания + блог + Q&A + рецепты + конкурсы + каталог сортов).
Сейчас это **полностью фронтенд-прототип** (React SPA), все данные —
мок-данные в памяти + localStorage, без реального бэкенда.

**Текущая цель:** подготовить проект к миграции на **Supabase** (БД,
аутентификация, хранилище фото), **не меняя стек и не трогая UI/CSS/вёрстку**.
Next.js — в будущем, отдельным этапом, сейчас не трогаем.

Работа велась по строгому пошаговому ТЗ (7 этапов), все этапы **завершены**.

---

## 2. Ключевые архитектурные решения

- **Стек:** React + Vite + react-router-dom, чистый JS (без TypeScript),
  ванильный CSS. Комментарии в коде — на русском, имена переменных — на английском.
- **Состояние:** весь домен живёт в одном `React Context` (`src/context/AppContext.jsx`,
  ~900 строк) — growers, varieties, diaries, recipes, blogPosts, contests,
  questions, lights, nutrients, settings + сессионные списки (subscriptions,
  saved, seed bank, notifications, votes). UI-состояние (модалки, тема,
  wizard, тосты) — там же, но отдельно помечено.
- **Слой данных:** `src/data/*.js` (сид-данные) → `src/services/*.js`
  (async-обёртки, единый ответ `{data, error}`) → `AppContext.jsx` (потребление).
- **Стратегия ответа сервисов:** **`{data, error}`**, НЕ throw (кроме
  единственного legacy-компромисса — см. открытые вопросы). Обоснование: это
  форма ответа `supabase-js`, при переключении меняется только тело функции.
- **Доменная модель:** `src/domain/` — типы (JSDoc), константы, фабрики,
  валидаторы. Не зависит от источника данных (mock или real).
- **База данных (спроектирована, не развёрнута):** Postgres-схема Supabase —
  17 таблиц, RLS-политики, триггеры. См. `supabase/migrations/0001-0005`.
- **Ключевые фиксы дизайна БД относительно мока:**
  - `comments.author_id` / `answers.author_id` — реальный FK на `profiles`,
    а не имя строкой (в моке было так).
  - `follows` — отдельная таблица (в моке — булев флаг `grower._followed`).
  - `contest_participants` — ОДНА таблица (в моке было два несинхронизированных
    списка: `participantIds` на конкурсе и `joinedContestIds` на клиенте).
  - `notifications.user_id`, `seed_bank_items.user_id` — явные владельцы
    (в моке этих полей не было вообще).
  - `diaries.is_private` — добавлено заранее в схему, хотя в UI приватных
    дневников пока нет (фича не реализована).
  - `likes` — полиморфная таблица + денормализованные `likes_count`,
    поддерживаемые триггерами (было `likes`/`liked` прямо на каждой сущности).
- **Роли:** `profiles.role` (`user`/`admin`), проверяется в RLS через
  `is_admin()` — security definer функция.
- **Фото:** сегодня everywhere `base64` (`FileReader.readAsDataURL`) — в
  схеме это НЕ меняется (осталось `photo_url text`), реальная загрузка в
  Supabase Storage — отдельная будущая задача, не в этом ТЗ.

---

## 3. Структура проекта и ключевые файлы (после всех 7 этапов)

```
src/
  domain/                      # Этап 2 — НОВОЕ
    types.js                   # JSDoc-типы всех сущностей
    schema.js                  # константы (реэкспорт + новые: RECIPE_CATEGORIES, BADGE_TYPES и т.д.)
    factories.js                # slugify, createGrower/Diary/DiaryReport/Recipe/Question
    validators.js               # validateDiary/Recipe/Question/Grower

  services/                    # Этап 3 — ПЕРЕРАБОТАНО
    _result.js                  # НОВОЕ: ok()/fail() хелперы {data,error}
    authService.js               # login/signup/logout, admin-логин по паролю (см. открытые вопросы)
    growerService.js             # + getGrowerById
    varietyService.js            # + getVarietyById, 2 конструктора (публичный/админский)
    diaryService.js              # fetchInitialDiaries(growers) — сигнатура НЕ менялась (см. риски)
    recipeService.js             # + getRecipeById
    blogService.js               # + getBlogPostById/BySlug, slug теперь через slugify()
    contestService.js            # + getContestById
    questionService.js           # + getQuestionById, ФИКС: createdAt/updatedAt больше не "плывут"
    lightService.js / nutrientService.js  # + getLightById/getNutrientById
    persistenceService.js        # НЕ ТРОНУТ — localStorage-слой, отдельная тема
    supabase/README.md           # Этап 7 — заметки по будущему client.js и переключению

  context/AppContext.jsx        # Этап 4 — ОБНОВЛЁН
    # 17 функций стали async: login, signup, ensureUserGrower, addVariety,
    # createDiary, addWeekReport, addRecipe, addBlogPost, addQuestion,
    # addAnswer, adminAddVariety, adminAddRecipe, adminAddBlogPost,
    # adminAnswerQuestion, adminAddContest, adminAddLight, adminAddNutrient.
    # Добавлен initError в state/контекст.

  components/                   # 4 файла обновлены под async (await + async handleSubmit):
    AddRecipeModal.jsx, AskQuestionModal.jsx, CreateDiaryWizard.jsx, WriteArticleModal.jsx
    # Остальные компоненты НЕ трогали (не использовали возвращаемое значение).

  data/*.js                     # НЕ ТРОНУТО (growers, varieties×196, diaries, recipes,
                                 #  blogPosts, questions, contests, lights, nutrients, photos, presetAvatars)
  admin/                        # НЕ ТРОНУТО (админка — отдельные страницы для каждой сущности)
  pages/                        # НЕ ТРОНУТО
  utils/helpers.js              # НЕ ТРОНУТО (DIARY_STAGES и т.д. отсюда реэкспортированы в domain/schema.js)

supabase/migrations/            # Этап 5 — НОВОЕ
  0001_init_schema.sql          # 17 таблиц: profiles, varieties, diaries, diary_varieties,
                                 #  diary_reports, diary_photos, recipes, blog_posts, questions,
                                 #  answers, comments, likes, follows, diary_subscriptions,
                                 #  badges, user_badges, contests, contest_participants,
                                 #  notifications, seed_bank_items, lights, nutrients,
                                 #  variety_votes, site_settings
  0002_indexes.sql              # индексы на все FK + slug + created_at + is_private + stage
  0003_rls_policies.sql         # is_admin() + RLS на каждой таблице
  0004_triggers.sql             # handle_new_user(), set_updated_at(), apply_like_delta(),
                                 #  notify_diary_subscribers()
  0005_seed_dev.sql             # синтетические dev-данные (12 growers + auth.users, 14 varieties,
                                 #  12 diaries+reports, recipes, blog_posts, questions+answers,
                                 #  contests, lights, nutrients, votes)

scripts/
  migrate-seed-to-supabase.mjs  # Этап 6 — НОВОЕ: переносит РЕАЛЬНЫЕ src/data/*.js в Supabase
                                 #  (не путать с 0005 — тот генерирует синтетику с нуля).
                                 #  Идемпотентен: growers через кэш .migration-id-map.json
                                 #  (auth.users нельзя надёжно создать с заданным uuid),
                                 #  остальное — детерминированный uuid v5 из мок-id.
                                 #  Пакет @supabase/supabase-js НЕ установлен (нужно подтверждение).

.env.example                    # Этап 7: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
.gitignore                      # Этап 7 — СОЗДАН С НУЛЯ (раньше отсутствовал в проекте!)
HANDOFF.md                      # дополнен разделом «10. Подготовка к Supabase»
```

### Ключевой паттерн сервиса (пример — все 10 файлов однотипны)
```js
// services/_result.js
export function ok(data) { return { data, error: null }; }
export function fail(error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }; }

// services/recipeService.js (сокращённо)
import { RECIPES } from '../data/recipes.js';
import { ok, fail } from './_result.js';

let _store = null;
function store() { if (!_store) _store = RECIPES.map(r => ({ liked:false, views:r.views ?? Math.round(r.likes*6.5), photo:null, ...r })); return _store; }

export async function fetchInitialRecipes() {
  try { return ok(store().map(r => ({ ...r }))); } catch (e) { return fail(e); }
}
export async function getRecipeById(id) {
  try { const found = store().find(r => r.id === id); return found ? ok({...found}) : fail(new Error(`Recipe ${id} не найден`)); }
  catch (e) { return fail(e); }
}
export async function createRecipeFromForm({ title, category, varietyId, desc, ingredients, steps, growerId, photo }) {
  try { return ok({ id:'r_'+Date.now(), title, category, growerId, varietyId: varietyId||null, desc: desc||'...', ingredients, steps, photo: photo||null, likes:0, liked:false, views:0 }); }
  catch (e) { return fail(e); }
}
```

### Ключевой паттерн вызова в AppContext.jsx (пример)
```js
const addRecipe = useCallback(async (formData) => {
  if (!currentUser) return null;
  const { data: r, error } = await createRecipeFromForm({ ...formData, growerId: currentUser.growerId });
  if (error) { showToast(error.message || 'Не удалось опубликовать рецепт'); return null; }
  setRecipes((prev) => [r, ...prev]);
  showToast(`Рецепт «${r.title}» опубликован!`, 'success');
  return r;
}, [currentUser, showToast]);
```
Все остальные `addX`/`adminAddX` устроены так же.

---

## 4. Текущий статус

**Готово (все 7 этапов ТЗ):**
- ✅ Этап 1 — аудит.
- ✅ Этап 2 — `src/domain/`.
- ✅ Этап 3 — `services/*.js` на async + `{data,error}`.
- ✅ Этап 4 — `AppContext.jsx` + 4 компонента обновлены под async.
- ✅ Этап 5 — SQL-схема Supabase (5 файлов миграций).
- ✅ Этап 6 — скрипт-мигратор мок-данных.
- ✅ Этап 7 — `.env.example`, `.gitignore`, README, обновлённый HANDOFF.md.

**Проверено:**
- Полный `tsc --noEmit` (allowJs+jsx) по всему `src/` — 0 ошибок.
- `node --check` по всем services + скрипту-мигратору — OK.
- Логика `loadMockData()` мигратора прогнана против реальных
  `src/data/*.js` — 11 growers, 196 varieties, 14 diaries (с полными
  weeks/comments) читаются корректно.

**НЕ сделано / НЕ проверено:**
- ❌ `npm run dev` / реальная сборка Vite НЕ запускалась (нет `node_modules`
  и сети в рабочем окружении) — нужно проверить руками после распаковки.
- ❌ Реальный Supabase-проект не создан, миграции не применялись.
- ❌ `@supabase/supabase-js` не установлен.
- ❌ `src/services/supabase/client.js` не создан (только README с планом).
- ❌ Переключение `services/*.js` с mock на real НЕ начато.
- ❌ Загрузка фото в Supabase Storage — не спроектирована и не начата.
- ❌ Приватные дневники (`is_private`) — только колонка в БД, UI не готов.

---

## 5. To-Do на следующие шаги (по приоритету)

**Приоритет 1 — проверить, что ничего не сломано:**
1. Распаковать архив поверх текущего проекта, `npm install`, `npm run dev`,
   вручную пройтись по сценариям: логин/регистрация, создание дневника,
   добавление отчёта, рецепта, статьи, вопроса/ответа — везде, где были
   изменения на async.
2. Проверить админку: добавление сорта/рецепта/статьи/конкурса/лампы/удобрения,
   ответ администратора на вопрос.

**Приоритет 2 — развернуть Supabase:**
3. Создать проект в Supabase, прогнать `supabase/migrations/0001` →
   `0005` по порядку (0005 — опционально, только для dev-проверки схемы).
4. `npm install @supabase/supabase-js` (с подтверждением пользователя).
5. Создать `src/services/supabase/client.js` (шаблон уже в README рядом).

**Приоритет 3 — переключение с mock на real:**
6. По одному файлу переключать `services/*.js` с mock-тела на реальные
   Supabase-запросы — сигнатуры и `{data,error}` уже готовы, компоненты/
   AppContext трогать не придётся.
7. Убрать спецкейс admin-логина по паролю из `authService.js`, перейти на
   `supabase.auth.signInWithPassword`/`signUp` + `profiles.role`.
8. Прогнать `scripts/migrate-seed-to-supabase.mjs` на dev-проекте, перенести
   реальные мок-данные (а не синтетику из 0005).

**Приоритет 4 — доработки не по этому ТЗ:**
9. Загрузка фото в Supabase Storage вместо base64.
10. UI для приватных дневников (колонка `is_private` в БД уже готова).
11. Решить, что делать с `lights`/`nutrients` — включать ли в реальный продакшн
    так же, как остальные сущности (см. открытые вопросы).

---

## 6. Открытые вопросы / нерешённое

1. **`authService.js` — компромисс с throw vs {data,error}.** Изначально
   сервис использовал `throw`, пришлось перевести на общий `{data,error}` и
   сразу поправить `login`/`signup` в `AppContext.jsx` (иначе всё бы сломалось).
   Технически это единственный сервис, где вообще была смена контракта на
   лету — стоит перепроверить, не осталось ли где-то в компонентах старых
   `try/catch` вокруг `login`/`signup`, которые я мог пропустить (искал только
   в `AuthModal.jsx`/`AppContext.jsx`, но не проверял абсолютно все файлы).
2. **`addWeekReport` — потенциальный риск гонки.** Номер отчёта
   (`weekNumber`) теперь считается из снэпшота `diaries` в замыкании
   `useCallback`, а не внутри `setState`-апдейтера, как было раньше. При
   очень быстрой повторной отправке форм это теоретически может дать
   неверную нумерацию. На практике не воспроизведено, но не покрыто тестом.
3. **`lights`/`nutrients`** — не входили в исходный список 12 сущностей
   ТЗ, но реально существуют в коде и попали в SQL-схему/мигратор. Не
   уточнялось, нужны ли они в финальной продакшн-схеме Supabase или это
   было временное решение мок-этапа.
4. **Фото (`base64`)** — сознательно вынесено за рамки текущего ТЗ
   (только `photo_url text` в схеме, без реальной интеграции со Storage).
   Нужно отдельное ТЗ на этот кусок работы.
5. **`0005_seed_dev.sql` вставляет напрямую в `auth.users`** с
   плейсхолдер-паролем (не настоящий bcrypt-хэш) — годится только для
   проверки структуры данных, НЕ для логина под dev-пользователями. Если
   нужен рабочий логин на dev/staging — использовать
   `scripts/migrate-seed-to-supabase.mjs` (создаёт пользователей через
   Auth Admin API) вместо `0005`.
6. **Ни разу не запускался реальный `npm run dev`** за всю работу над этим
   ТЗ (нет `node_modules`/сети в рабочем окружении) — весь контроль
   качества шёл через `tsc --noEmit` и ручной код-ревью. Это самый большой
   риск: возможны runtime-ошибки, не видимые статическому анализу
   (например, неправильно посчитанный порядок `await`, гонки состояния).
