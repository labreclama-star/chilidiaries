# services/supabase/ — заметки по будущей интеграции

Эта папка пуста намеренно — сюда переедет реальный клиент Supabase, когда
проект будет готов переключить `services/*.js` с mock на real (следующий шаг
после Этапа 7, см. HANDOFF.md → "Подготовка к Supabase").

## Что сюда добавить (следующий шаг, НЕ сделано в рамках Этапов 1–7)

1. **`client.js`** — создание единственного экземпляра клиента:
   ```js
   import { createClient } from '@supabase/supabase-js';

   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```
   Требует `npm install @supabase/supabase-js` (не установлен — см. правило
   проекта "не ставить пакеты без подтверждения") и заполненный `.env.local`
   (см. `.env.example` в корне проекта).

2. **Переключение `services/*.js`**. Благодаря Этапу 3 сигнатуры уже готовы —
   меняется только ТЕЛО функций, форма ответа `{data, error}` остаётся той же.
   Например, `growerService.fetchInitialGrowers()`:
   ```js
   // Было (мок, Этап 3):
   export async function fetchInitialGrowers() {
     try { return ok(store().map((g) => ({ ...g }))); }
     catch (e) { return fail(e); }
   }

   // Станет (реальный Supabase):
   import { supabase } from './supabase/client.js';
   export async function fetchInitialGrowers() {
     const { data, error } = await supabase.from('profiles').select('*');
     return error ? fail(error) : ok(data);
   }
   ```
   Компоненты и `AppContext.jsx` при этом НЕ меняются — они уже работают
   через `{data, error}` (Этап 4).

3. **Маппинг camelCase ↔ snake_case.** Таблицы в Supabase — snake_case
   (`grower_id`, `photo_url`), клиентский код — camelCase (`growerId`,
   `photo`). Нужен явный слой преобразования при чтении/записи — либо
   вручную в каждом сервисе, либо через общий `mapRow()`/`mapRows()` хелпер
   здесь же, в `services/supabase/`. Не забыть про поля, которые в SQL-схеме
   называются иначе не только по регистру (`desc` → `description`,
   `weeks` → `diary_reports`, `photos[]` внутри отчёта → отдельная таблица
   `diary_photos`) — см. `supabase/migrations/0001_init_schema.sql`.

4. **Auth.** `services/authService.js` меняет `login`/`signup`/`logout` на
   `supabase.auth.signInWithPassword`/`signUp`/`signOut`. Обрати внимание:
   сегодняшний спецкейс с админом (`ADMIN_LOGIN`/`ADMIN_PASSWORD` в
   `authService.js`) должен уйти — роль администратора в реальной схеме
   лежит в `profiles.role` (см. RLS `is_admin()` в
   `supabase/migrations/0003_rls_policies.sql`), а не проверяется по имени
   пользователя на клиенте.

5. **Фото.** Все текущие фото — `base64` data URL (см. риск №7 из отчёта
   Этапа 1). Прямая заливка такой строки в колонку `photo_url`/`avatar_url`
   технически сработает, но это анти-паттерн для Supabase (раздувает БД,
   не кэшируется CDN). Правильный путь — загрузка файла в Supabase Storage
   (`supabase.storage.from('...').upload(...)`) и сохранение возвращённого
   URL. Это отдельная задача, не входящая в Этапы 1–7 текущего ТЗ.

6. **Реалтайм (опционально, на будущее).** Лайки/комментарии/уведомления —
   кандидаты на `supabase.channel(...).on('postgres_changes', ...)`, чтобы
   не polling'ить. Не требуется для паритета с текущим мок-поведением
   (там тоже нет "живых" обновлений между вкладками).

## Что уже готово и НЕ требует изменений при переключении

- `src/domain/*` (Этап 2) — типы/константы/фабрики/валидаторы не зависят от
  источника данных.
- Форма ответа `{data, error}` во всех `services/*.js` (Этап 3).
- Все вызовы в `AppContext.jsx` и компонентах уже используют `await` и
  распаковывают `{data, error}` (Этап 4).
- SQL-схема, индексы, RLS, триггеры — `supabase/migrations/` (Этап 5).
- Скрипт первичного переноса текущих мок-данных — `scripts/migrate-seed-to-supabase.mjs`
  (Этап 6).
