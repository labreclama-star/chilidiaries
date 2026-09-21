# ChiliDiaries — сводка сессии (для переноса в новый чат)

## 1. Суть проекта
ChiliDiaries — соцсеть для гроверов острого перца. Готовый фронтенд-проект на
**React 18 + Vite + JavaScript** (без TypeScript, без Next.js), ~20 публичных
страниц (главная, дневники, каталог сортов, рецепты, блог, вопросы, конкурсы,
гроверы, лента, рейтинг, свет/удобрения и т.д.), мобильная адаптация,
тёмная/светлая тема. Вся бизнес-логика — в `src/context/AppContext.jsx`,
данные — мок в `src/data/*.js`, авторизация — мок в `src/services/authService.js`.

**Задача этой сессии:** добавить полноценную админ-панель (CRUD по всему
контенту, аналитика, экспорт/импорт), сохранение изменений в localStorage,
и затем — серию UI/UX-фиксов и доработок по запросу пользователя (мобильная
адаптация, фикс шапки, аватарки при регистрации, галерея фото дневника и т.д.)

## 2. Ключевые архитектурные решения
- **Стек:** React 18, Vite, react-router-dom, чистый CSS (`src/index.css`,
  ~660 строк секций, дизайн-токены `--soil-*`, `--ember`, `--habanero` и т.д.).
  Никаких UI-библиотек (без MUI/Ant/shadcn), никаких новых npm-зависимостей.
- **Состояние:** единый `AppContext.jsx` (React Context + useState), никакого
  Redux/Zustand. Все сущности — плоские массивы в контексте: `growers`,
  `varieties`, `diaries`, `recipes`, `blogPosts`, `contests`, `questions`,
  `lights`, `nutrients`, `settings`.
- **Персистентность:** `src/services/persistenceService.js` —
  localStorage под ключом `chilidiaries_state_v1`, версионируется полем `_v`.
  При старте: если в localStorage валидные данные — используются они, иначе
  грузятся сид-данные из `src/data/*.js`. При любом изменении
  growers/varieties/diaries/recipes/blogPosts/contests/questions/lights/nutrients/settings
  — автосохранение через `useEffect`.
- **Роли и защита:** у гровера появилось поле `role: 'user'|'admin'`.
  Сид-админ — фиксированный гровер `id:'admin'` в `data/growers.js`.
  Логин `admin` — единственный, где `authService.login()` реально проверяет
  пароль (константа `ADMIN_PASSWORD` в `authService.js`); все остальные логины
  — мок без проверки пароля (как и было в проекте изначально).
  `AppContext.isAdmin` вычисляется из `growers.find(g.id===currentUser.growerId).role`.
- **Роутинг админки:** `/admin/*` — вложенные роуты в `App.jsx`, обёрнутые в
  `ProtectedAdminRoute` (редиректит на `/`, если не admin; открывает
  `AuthModal` и остаётся на `/admin`, если не залогинен — это важно, см. п.6).
  На `/admin/*` публичный шелл (Sidebar/Header/Footer/BottomNav) не рендерится,
  вместо него — `AdminLayout` (свой хедер + сайдбар/бургер-меню).
- **Данные:** `lights` и `nutrients` раньше не были в контексте вообще
  (страницы читали статические файлы напрямую) — я завёл их в контекст и
  переключил `Lights.jsx`/`Nutrients.jsx` на `useApp()`, иначе админ-CRUD по
  ним не отражался бы на сайте.

## 3. Ключевые файлы (финальные версии — в приложенном zip)

**Новое (админка):**
```
src/services/persistenceService.js   — localStorage load/save/clear
src/services/lightService.js         — fetchInitialLights, createLightFromForm
src/services/nutrientService.js      — аналогично для удобрений
src/admin/ProtectedAdminRoute.jsx    — guard роута /admin/*
src/admin/AdminLayout.jsx            — шапка + сайдбар/бургер + <Outlet/>
src/admin/components/AdminTable.jsx  — универсальная таблица (карточки на моб.)
src/admin/components/AdminConfirmDialog.jsx
src/admin/components/AdminCharts.jsx — ручные SVG bar/line/hbar чарты
src/admin/pages/AdminDashboard.jsx   — метрики, графики за 14 дней, топ-5
src/admin/pages/AdminVarieties.jsx   — CRUD сортов
src/admin/pages/AdminDiaries.jsx     — CRUD дневников/отчётов
src/admin/pages/AdminUsers.jsx       — роли/бан/мягкое удаление
src/admin/pages/AdminRecipes.jsx     — CRUD + скрытие
src/admin/pages/AdminBlog.jsx        — модерация pending/approved/rejected
src/admin/pages/AdminQuestions.jsx   — статус/ответ от админа/CRUD
src/admin/pages/AdminContests.jsx    — CRUD + участники (participantIds)
src/admin/pages/AdminLights.jsx, AdminNutrients.jsx — CRUD
src/admin/pages/AdminSettings.jsx    — настройки сайта
src/admin/pages/AdminData.jsx        — экспорт/импорт/сброс JSON
```

**Новое (UX-доработки):**
```
src/data/presetAvatars.js            — 6 SVG-аватарок (3♂/3♀, перчики вместо
                                        глаз), v2-редизайн — жирные простые
                                        формы, читаются даже на 24px
src/components/DiaryHeroGallery.jsx  — свайпаемая галерея фото дневника
                                        (scroll-snap + счётчик "N/M" + тап
                                        открывает Lightbox)
```

**Существенно изменено:**
```
src/data/growers.js        — role/joinedAt/banned/deleted всем, +сид-админ
src/services/authService.js — проверка пароля только для admin
src/services/growerService.js — createUserGrower(name, avatar)
src/services/varietyService.js — + createVarietyFromAdminForm
src/services/contestService.js — + participantIds, createContestFromForm
src/context/AppContext.jsx — +isAdmin, +персистентность, +lights/nutrients/
                              settings state, +~30 admin*-методов, signup()
                              принимает avatar
src/App.jsx                 — вложенные /admin роуты, скрытие публичного
                              шелла на /admin/*
src/index.css                — секция ADMIN (~300 строк), фикс мобильной
                              сетки карточек (2 в ряд вместо 1), фикс
                              hero-секции, фикс шапки (position:fixed вместо
                              sticky — см. п.6), фикс переполнения в
                              таблицах/тулбарах админки, компактные кнопки
                              в админке, avatar-picker, diary-hero-track
src/pages/Lights.jsx, Nutrients.jsx — теперь из useApp(), не из data/*.js
src/pages/Growers.jsx        — скрывает deleted-гроверов
src/components/GrowerCard.jsx — бейдж "Забанен"
src/pages/Recipes.jsx        — скрывает hidden-рецепты
src/components/Sidebar.jsx, MoreSheetModal.jsx — учитывают settings.showFeed/
                              showQuestions (скрывают пункты меню)
src/components/AuthModal.jsx — учитывает settings.registrationEnabled,
                              +пикер аватарок при регистрации
src/pages/Home.jsx           — убран PhoneMockup, hero-фон из
                              settings.heroPhoto, убрана плашка "Опыт
                              сообщества"
src/pages/MyDiaries.jsx      — порядок секций: Сорта→Дневники→Конкурсы→
                              Банк семян→Рецепты
src/pages/DiaryDetail.jsx    — hero заменён на DiaryHeroGallery (все фото
                              дневника: обложка + фото всех отчётов)
src/components/Header.jsx    — position:fixed (см. п.6), без scroll-hide
README.md                    — добавлен раздел "Админка"
```

**Логин админа:** `admin` / `ChiliAdmin2026` (константа `ADMIN_PASSWORD` в
`src/services/authService.js`). После входа — вручную перейти на `/admin`.

## 4. Текущий статус
✅ Готово и проверено (синтаксически + логическими кросс-чеками, см. п.6):
- Все 13 этапов админки из первоначального плана (роли → дашборд → CRUD по
  всем 9 сущностям → настройки → экспорт/импорт → финальный ревью/README).
- Персистентность в localStorage.
- Раунд UX-фиксов: фикс мобильной сетки (2 карточки в ряд), фикс шапки
  (см. открытые вопросы — теперь `position:fixed`), убран мокап телефона,
  фото главного экрана через админку, галерея фото в дневнике, редизайн
  аватарок, фикс переполнения текста/кнопок в админке на мобильном.

⏳ Не сделано / не проверено:
- **Ни разу не запускался реальный `npm run build`/`npm run dev`** — в
  песочнице этой сессии нет доступа к сети для `npm install`. Вся проверка
  шла через: (а) TypeScript-транспилятор в режиме JSX как синтаксис-чекер по
  всем 118 файлам, (б) подсчёт баланса `{}` в CSS, (в) рантайм-симуляция
  сервисов/персистентности через транспиляцию на Node, (г) для аватарок и
  верстки админ-таблицы — реальный рендер через headless Chromium
  (Playwright) с реальным `index.css` и замер `scrollWidth`. Это даёт высокую
  уверенность, но **не заменяет реальный `npm run dev` в браузере** —
  обязательно прогнать перед деплоем.

## 5. To-Do (следующие шаги, по приоритету)
1. **[Высокий]** Пользователь запускает `npm install && npm run dev` локально,
   проходит полный QA: логин под admin, CRUD по каждой из 9 сущностей,
   экспорт/импорт JSON, сброс к сид-данным, регистрация с выбором аватарки,
   открытие дневника (галерея фото), мобильная версия на реальном телефоне.
2. **[Средний]** Решить, должны ли тумблеры `showFeed`/`showQuestions` в
   `/admin/settings` **блокировать сами роуты** `/feed` и `/questions`, а не
   только прятать пункты меню (сейчас — только прячут, см. открытые вопросы).
3. **[Средний]** Удалить неиспользуемый файл `src/components/PhoneMockup.jsx`
   (осиротел после удаления мокапа с главной, физически не мешает, но мёртвый
   код).
4. **[Низкий]** Если планируется реальный бэкенд — все `admin*`-методы в
   `AppContext.jsx` и persistence-слой придётся переключить с
   localStorage/мока на реальные API-запросы (архитектурно уже разделены
   по сущностям, миграция локальная по каждому методу).
5. **[Низкий]** При желании — дальше полировать иллюстрации пресет-аватарок
   (сейчас v2, жирные простые формы, читаются от 24px до 140px — проверено
   рендером, но это не профессиональная иллюстрация).

## 6. Открытые вопросы / нерешённое
- **Баг с шапкой:** `position:sticky` на хэдере не работал стабильно —
  причина в `html,body{overflow-x:clip}` (известная особенность CSS: как
  только на body задан overflow, sticky-позиционирование потомков может
  вести себя непредсказуемо, особенно в Safari). Исправлено переключением
  на `position:fixed` + компенсирующий `padding-top` на `.app-main`. **Не
  проверено в реальном браузере** (только логически) — если проблема
  повторится, следующий шаг — проверить, не ломает ли `overflow-x:clip`
  на html/body что-то ещё (например, `.admin-header`/`.admin-sidebar`,
  которые тоже используют `position:sticky` и потенциально подвержены
  той же особенности, но пока на них жалоб не было).
- Отклонённые статьи блога (`status:'rejected'`) хранятся вместе с
  остальными, просто не показываются публично — отдельного архива/фильтра
  "только отклонённые для аудита" нет.
- `participantIds` конкурса (админское ручное управление) — независимый
  список от кнопки "Участвовать" на публичной странице (сессионный
  `joinedContestIds`). Это осознанное решение по ТЗ Этапа 9, но стоит
  проговорить, не путает ли это пользователя в реальном использовании.
- Пароль админа лежит открытым текстом в исходниках
  (`ADMIN_PASSWORD` в `authService.js`) — нормально для мок-проекта, но
  **обязательно** заменить на реальную аутентификацию перед любым публичным
  деплоем.
