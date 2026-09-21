// Доменные типы ChiliDiaries — JSDoc, без TypeScript (по требованию проекта).
//
// Это описание РЕАЛЬНОЙ формы объектов, как они сегодня живут в src/data/*.js
// и src/context/AppContext.jsx (см. отчёт Этапа 1). Там, где текущая форма —
// известный компромисс мок-архитектуры (не FK, а имя строкой и т.п.), это
// отмечено в комментарии к полю с припиской "(mock)" — при проектировании
// SQL-схемы (Этап 5) такие поля меняют форму (например author:string → user_id).
//
// Файл ничего не исполняет и не импортируется существующим кодом — чистая
// документация для дальнейших этапов (валидаторы, SQL-схема, миграция).

/**
 * @typedef {Object} Grower
 * @property {string} id
 * @property {string} name
 * @property {string} loc
 * @property {string} bio
 * @property {number} diaries - денормализованный счётчик дневников
 * @property {number} followers - денормализованный счётчик подписчиков
 * @property {?string} avatar - data URL (base64) или null
 * @property {boolean} online
 * @property {'user'|'admin'} role
 * @property {string} joinedAt - ISO timestamp
 * @property {boolean} banned
 * @property {boolean} deleted - мягкое удаление
 * @property {boolean} [_followed] - (mock) сессионный флаг "текущий юзер подписан на этого гровера";
 *   не существует в сид-данных, добавляется на лету в AppContext.toggleFollowGrower.
 *   В реальной схеме — это НЕ поле гровера, а факт наличия строки в таблице follows.
 */

/**
 * @typedef {Object} Variety
 * @property {string} id
 * @property {string} name
 * @property {string} species - например 'Capsicum chinense'
 * @property {number} shuMin
 * @property {number} shuMax
 * @property {?number} rating - null у пользовательских сортов до появления голосов
 * @property {?number} capsaicinRating
 * @property {?number} aromaRating
 * @property {string} difficulty
 * @property {string} days - строка-диапазон, например '95-105' (не число!)
 * @property {string} origin
 * @property {?string} photo - URL или data URL
 * @property {string} desc
 * @property {boolean} [userAdded] - true, если добавлен через публичную форму, а не сидом/админом
 * @property {string} [addedBy] - имя гровера (mock: строка, не growerId)
 */

/**
 * @typedef {Object} DiaryReport - элемент diary.weeks; по смыслу это "отчёт", имя поля историческое
 * @property {number} n - порядковый номер отчёта в дневнике (1, 2, 3...)
 * @property {number} day - день от старта дневника на момент отчёта
 * @property {string} title
 * @property {?string} stage - null = наследует текущую стадию дневника на момент рендера
 * @property {string} date - локализованная строка вида '02 апр' (mock: НЕ ISO, не годится для сортировки/фильтра в БД как есть)
 * @property {string} note
 * @property {number|string} temp - иногда строка после toFixed()
 * @property {number|string} hum
 * @property {string[]} photos - data URL (base64) сегодня; в Supabase — URL из Storage
 */

/**
 * @typedef {Object} DiaryComment - элемент diary.comments
 * @property {string} author - (mock) ИМЯ гровера строкой, НЕ growerId — нет FK на profiles
 * @property {string} text
 * @property {string} time - (mock) человекочитаемая строка ('сейчас', '3д назад'), НЕ timestamp
 */

/**
 * @typedef {Object} Diary
 * @property {string} id
 * @property {string} title
 * @property {string} desc
 * @property {string} varietyId - основной сорт
 * @property {string[]} varietyIds - все сорта дневника (первый элемент = varietyId)
 * @property {string} growerId
 * @property {'Рассада'|'Вегетация'|'Цветение'|'Плодоношение'|'Собран урожай'} stage
 * @property {string} location - см. DIARY_LOCATIONS в domain/schema.js
 * @property {string} medium - см. DIARY_MEDIUMS в domain/schema.js
 * @property {string[]} techniques - свободные текстовые теги, фиксированного enum нет
 * @property {number} likes
 * @property {boolean} liked - сессионный флаг "лайкнул ли текущий юзер"
 * @property {number} followers - денормализовано, сегодня НЕ живое (не растёт при toggleDiarySubscription)
 * @property {number} shu - среднее по сорту на момент создания дневника
 * @property {string} startDate - 'YYYY-MM-DD'
 * @property {?string} coverPhoto - data URL или null; приоритетнее фото сорта в превью
 * @property {'daily'|'every3'|'weekly'|'custom'} reportInterval
 * @property {DiaryReport[]} weeks
 * @property {DiaryComment[]} comments
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} category - см. RECIPE_CATEGORIES
 * @property {string} growerId
 * @property {?string} varietyId
 * @property {string} desc
 * @property {string[]} ingredients
 * @property {string[]} steps
 * @property {?string} photo
 * @property {number} likes
 * @property {boolean} liked
 * @property {number} views
 * @property {boolean} [hidden] - только у записей, созданных/скрытых через админку
 */

/**
 * @typedef {Object} BlogPost
 * @property {string} id
 * @property {string} slug - (mock) сегодня 'article-' + Date.now(), не из title
 * @property {string} title
 * @property {string} growerId
 * @property {?string} varietyId
 * @property {?string} photo
 * @property {string[]} tags
 * @property {string} excerpt
 * @property {string[]} content - абзацы
 * @property {string} date - 'YYYY-MM-DD'
 * @property {'pending'|'approved'|'rejected'} status
 * @property {string} [rejectReason]
 * @property {number} views
 * @property {number} likes
 * @property {boolean} liked
 */

/**
 * @typedef {Object} Contest
 * @property {string} id
 * @property {string} title
 * @property {string} desc
 * @property {string} fullDesc
 * @property {string} prize
 * @property {number} progress - 0..100
 * @property {number} participants - денормализованный счётчик
 * @property {string[]} participantIds - (mock) администраторский список участников;
 *   НЕЗАВИСИМ от joinedContestIds (сессионный список текущего юзера на клиенте) — не синхронизированы
 * @property {string} deadline - произвольная строка, не дата
 * @property {string} startDate - произвольная строка, не дата
 * @property {'upcoming'|'active'|'finished'} status
 * @property {?string} photo
 * @property {string} sponsor
 * @property {string[]} rules
 * @property {string} howToJoin
 */

/**
 * @typedef {Object} Answer - элемент question.answers
 * @property {string} id
 * @property {string} author - (mock) имя строкой, НЕ growerId
 * @property {string} text
 * @property {string} createdAt - ISO
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} growerId
 * @property {?string} diaryId
 * @property {string} text
 * @property {?string} photo
 * @property {?string} stage - см. QUESTION_STAGES (отдельный набор от DIARY_STAGES!)
 * @property {?string} topic - см. QUESTION_TOPICS
 * @property {'open'|'solved'} status
 * @property {number} likes
 * @property {boolean} liked
 * @property {string} createdAt - ISO
 * @property {string} updatedAt - ISO, двигается вперёд при новом ответе
 * @property {Answer[]} answers
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} diaryId
 * @property {string} message
 * @property {boolean} read
 * @property {string} createdAt - ISO
 * (mock: нет userId — подразумевается "уведомления текущего пользователя сессии")
 */

/**
 * @typedef {Object} Badge - НЕ хранимая сущность сегодня, вычисляется growerBadges() в utils/helpers.js
 * @property {string} icon
 * @property {string} label
 * @property {boolean} unlocked
 */

/**
 * @typedef {Object} SeedBankItem
 * @property {string} id
 * @property {string} name
 * @property {?string} varietyId
 * @property {string} quantity - свободная строка
 * @property {'have'|'want'} status
 * @property {string} notes
 * @property {string} addedAt - ISO
 * (mock: нет growerId/userId — банк один на сессию, не на пользователя явно)
 */

/**
 * @typedef {Object} Light - лампа (каталог оборудования); аналогичной формы Nutrient
 * @property {string} id
 * @property {string} name
 * @property {string} brand
 * @property {string} type
 * @property {string} tag
 * @property {string} price - строка с валютой, например '7 990 ₽'
 * @property {number} rating
 * @property {string} desc
 * @property {string} link
 * @property {?string} photo
 * @property {boolean} sponsored
 */

/** @typedef {Light} Nutrient - идентичная форма, отдельная таблица/коллекция */

/**
 * @typedef {Object} VarietyVote
 * @property {string} varietyId
 * @property {string} userId - growerId проголосовавшего
 * @property {number} overall
 * @property {number} capsaicin
 * @property {number} aroma
 * @property {string} ts - ISO
 * (один голос на пару varietyId+userId; повторное голосование заменяет запись)
 */

/**
 * @typedef {Object} Settings - синглтон настроек сайта (не массив, не имеет id)
 * @property {string} siteName
 * @property {string} siteDescription
 * @property {string} contactEmail
 * @property {string} telegram
 * @property {string} instagram
 * @property {boolean} bannerEnabled
 * @property {string} bannerText
 * @property {?string} bannerPhoto
 * @property {?string} heroPhoto
 * @property {boolean} registrationEnabled
 * @property {boolean} showQuestions
 * @property {boolean} showFeed
 */

export {};
