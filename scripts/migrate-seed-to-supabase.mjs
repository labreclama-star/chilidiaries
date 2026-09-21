#!/usr/bin/env node
// ChiliDiaries — Этап 6: скрипт-мигратор мок-данных из src/data/*.js в Supabase.
//
// ЗАПУСК (не сделано автоматически — по правилам проекта пакеты не ставим
// без подтверждения):
//   npm install @supabase/supabase-js --save-dev
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-seed-to-supabase.mjs
//
// Нужен именно SERVICE ROLE KEY (не anon key) — скрипт создаёт пользователей
// через Auth Admin API и пишет в таблицы в обход RLS (см. 0003_rls_policies.sql).
// НИКОГДА не коммить service role key и не запускать этот скрипт против прода
// без крайней необходимости — он предназначен для первичного наполнения
// dev/staging окружения реальными мок-данными проекта (в отличие от
// supabase/migrations/0005_seed_dev.sql, который создаёт СИНТЕТИЧЕСКИЕ
// dev-данные "с нуля" — этот скрипт переносит ИМЕННО текущие src/data/*.js).
//
// ИДЕМПОТЕНТНОСТЬ ("можно перезапускать"):
//  - growers → profiles: единственная сущность, завязанная на auth.users.
//    Supabase Admin API не даёт гарантированно задать свой uuid для нового
//    пользователя на всех версиях GoTrine, поэтому сопоставление
//    "мок-id ('g1') → auth.users.id" сохраняется в scripts/.migration-id-map.json
//    при первом запуске и переиспользуется при повторных — так email/пароль
//    не создаются заново, а profiles обновляется через upsert.
//  - все остальные сущности (varieties/diaries/recipes/blogPosts/contests/
//    questions/lights/nutrients) получают ДЕТЕРМИНИРОВАННЫЙ uuid v5 из
//    мок-id (см. deterministicUuid()) — то есть 'v1' всегда превращается
//    в один и тот же uuid, и upsert по id просто обновляет существующую
//    строку при повторном запуске, без всякого кэша.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ID_MAP_CACHE_PATH = path.join(__dirname, '.migration-id-map.json');

// ---------------------------------------------------------------------------
// 0. Настройка клиента и утилиты
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Нужны переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Пример: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-seed-to-supabase.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// UUID v5-подобный детерминированный id: один и тот же мок-id ('v1', 'd3'
// и т.д.) ВСЕГДА даёт один и тот же uuid. Не устанавливаем пакет `uuid`
// (правило "не ставить пакеты без подтверждения") — собираем uuid вручную
// из sha1-хэша, формат валиден для колонки uuid в Postgres.
const NAMESPACE = 'a3f1c2e0-chilidiaries-migration-namespace';
function deterministicUuid(kind, rawId) {
  const hash = createHash('sha1').update(`${NAMESPACE}:${kind}:${rawId}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),                                   // версия 5
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // вариант RFC4122
    hash.slice(20, 32)
  ].join('-');
}

function isoDate(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Разбивает строку-диапазон вроде '80-100' на [min, max] чисел. */
function splitRange(str, fallbackMin = 0, fallbackMax = 0) {
  if (!str) return [fallbackMin, fallbackMax];
  const [a, b] = String(str).split('-').map((s) => parseInt(s.trim(), 10));
  return [Number.isFinite(a) ? a : fallbackMin, Number.isFinite(b) ? b : (Number.isFinite(a) ? a : fallbackMax)];
}

async function loadIdMapCache() {
  try {
    const raw = await readFile(ID_MAP_CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { growers: {} }; // { mockId: { authId, email } }
  }
}
async function saveIdMapCache(cache) {
  await writeFile(ID_MAP_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

const report = {}; // { tableName: { upserted: 0 } }
function track(table, count) {
  report[table] = report[table] || { upserted: 0 };
  report[table].upserted += count;
}

async function upsertBatch(table, rows, { batchSize = 200, onConflict = 'id' } = {}) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Ошибка upsert в "${table}" (batch ${i}-${i + batch.length}): ${error.message}`);
    }
  }
  track(table, rows.length);
}

// ---------------------------------------------------------------------------
// 1. Загрузка src/data/*.js через динамический import()
// ---------------------------------------------------------------------------

async function loadMockData() {
  const dataDir = path.join(ROOT, 'src', 'data');
  const { INITIAL_GROWERS } = await import(path.join(dataDir, 'growers.js'));
  const { VARIETIES } = await import(path.join(dataDir, 'varieties.js'));
  const { buildInitialDiaries } = await import(path.join(dataDir, 'diaries.js'));
  const { RECIPES } = await import(path.join(dataDir, 'recipes.js'));
  const { BLOG_POSTS } = await import(path.join(dataDir, 'blogPosts.js'));
  const { QUESTIONS_SEED } = await import(path.join(dataDir, 'questions.js'));
  const { CONTESTS } = await import(path.join(dataDir, 'contests.js'));
  const { LIGHTS } = await import(path.join(dataDir, 'lights.js'));
  const { NUTRIENTS } = await import(path.join(dataDir, 'nutrients.js'));

  // buildInitialDiaries(growers) — та же функция, что использует
  // diaryService.js (Этап 3) — даёт ПОЛНЫЕ объекты дневников (с weeks[] и
  // comments[], сгенерированными generateWeeks/generateComments), а не
  // только "голый" DIARY_SEED.
  const diaries = buildInitialDiaries(INITIAL_GROWERS);

  return { growers: INITIAL_GROWERS, varieties: VARIETIES, diaries, recipes: RECIPES, blogPosts: BLOG_POSTS, questions: QUESTIONS_SEED, contests: CONTESTS, lights: LIGHTS, nutrients: NUTRIENTS };
}

// ---------------------------------------------------------------------------
// 2. GROWERS → auth.users + profiles
// ---------------------------------------------------------------------------

async function migrateGrowers(growers, idMapCache) {
  const growerIdMap = {}; // mockId -> auth.users.id (uuid)

  for (const g of growers) {
    let entry = idMapCache.growers[g.id];

    if (!entry) {
      const email = `${g.id}@chilidiaries.local`;
      const password = createHash('sha1').update(`${NAMESPACE}:${g.id}`).digest('hex').slice(0, 20) + 'Aa1!';
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: g.name, migrated_from_mock_id: g.id }
      });
      if (error) {
        // Пользователь мог быть создан руками/в прошлом прогоне без записи
        // в кэше (например, кэш-файл удалили) — пытаемся найти его по email,
        // чтобы не падать и не плодить дубликаты.
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
        const found = !listErr && list?.users?.find((u) => u.email === email);
        if (!found) throw new Error(`Не удалось создать auth-пользователя для ${g.id}: ${error.message}`);
        entry = { authId: found.id, email };
      } else {
        entry = { authId: data.user.id, email };
      }
      idMapCache.growers[g.id] = entry;
    }

    growerIdMap[g.id] = entry.authId;
  }

  const profileRows = growers.map((g) => ({
    id: growerIdMap[g.id],
    name: g.name,
    loc: g.loc || '',
    bio: g.bio || '',
    avatar_url: g.avatar || null,
    online: !!g.online,
    role: g.role || 'user',
    banned: !!g.banned,
    deleted: !!g.deleted,
    joined_at: g.joinedAt || new Date().toISOString()
  }));
  await upsertBatch('profiles', profileRows);

  return growerIdMap;
}

// ---------------------------------------------------------------------------
// 3. VARIETIES
// ---------------------------------------------------------------------------

async function migrateVarieties(varieties, growers, growerIdMap) {
  const nameToAuthId = {};
  for (const g of growers) nameToAuthId[g.name] = growerIdMap[g.id];

  const varietyIdMap = {};
  const rows = varieties.map((v) => {
    const newId = deterministicUuid('variety', v.id);
    varietyIdMap[v.id] = newId;
    const [daysMin, daysMax] = splitRange(v.days, 60, 100);
    return {
      id: newId,
      name: v.name,
      species: v.species || null,
      shu_min: v.shuMin ?? null,
      shu_max: v.shuMax ?? null,
      rating: v.rating ?? null,
      capsaicin_rating: v.capsaicinRating ?? null,
      aroma_rating: v.aromaRating ?? null,
      difficulty: v.difficulty || null,
      days_min: daysMin,
      days_max: daysMax,
      origin: v.origin || 'Не указано',
      photo_url: v.photo || null,
      description: v.desc || '',
      user_added: !!v.userAdded,
      // v.addedBy в моке — имя гровера строкой (риск №2 — как и у comment.author);
      // сопоставляем по имени, если гровер не найден — оставляем null.
      added_by: v.addedBy ? (nameToAuthId[v.addedBy] || null) : null
    };
  });
  await upsertBatch('varieties', rows);
  return varietyIdMap;
}

// ---------------------------------------------------------------------------
// 4. DIARIES (+ diary_varieties, diary_reports, diary_photos, comments)
// ---------------------------------------------------------------------------

async function migrateDiaries(diaries, growerIdMap, varietyIdMap) {
  const diaryIdMap = {};
  const diaryRows = [];
  const diaryVarietyRows = [];
  const reportRows = []; // { diaryMockId, ...fields } — id отчёта назначим после вставки дневника, report_number уникален в рамках diary_id
  const photoRows = [];

  for (const d of diaries) {
    const newId = deterministicUuid('diary', d.id);
    diaryIdMap[d.id] = newId;

    diaryRows.push({
      id: newId,
      title: d.title,
      description: d.desc || '',
      variety_id: varietyIdMap[d.varietyId],
      grower_id: growerIdMap[d.growerId],
      stage: d.stage,
      location: d.location || '',
      medium: d.medium || '',
      techniques: d.techniques || [],
      shu: d.shu ?? null,
      start_date: isoDate(d.startDate) || isoDate(new Date()),
      cover_photo_url: d.coverPhoto || null,
      report_interval: d.reportInterval || 'weekly',
      is_private: false, // в моке приватности не было — весь контент публичный
      likes_count: d.likes || 0
    });

    for (const vId of d.varietyIds || [d.varietyId]) {
      if (varietyIdMap[vId]) diaryVarietyRows.push({ diary_id: newId, variety_id: varietyIdMap[vId] });
    }

    (d.weeks || []).forEach((w, idx) => {
      reportRows.push({
        diary_id: newId,
        report_number: w.n ?? idx + 1,
        day_number: w.day ?? null,
        title: w.title || '',
        stage: w.stage || null,
        note: w.note || '',
        temp_c: w.temp ? Number(w.temp) : null,
        humidity: w.hum ? Number(w.hum) : null,
        // w.date в моке — локализованная строка ('02 апр'), НЕ парсим её
        // (риск №6 из отчёта Этапа 1) — считаем report_date от start_date
        // дневника, это единственный надёжный источник в текущих мок-данных.
        report_date: isoDate(new Date(new Date(d.startDate).getTime() + (idx + 1) * 7 * 24 * 3600 * 1000)),
        _photos: w.photos || [], // временное поле, обработаем после вставки отчётов
        _diaryMockId: d.id
      });
    });

    // Комментарии переносятся отдельным проходом в migrateComments() —
    // там нужен полный список growers по ИМЕНИ (comment.author — имя
    // строкой, риск №2), а не по мок-id, который есть здесь.
  }

  await upsertBatch('diaries', diaryRows);
  if (diaryVarietyRows.length) await upsertBatch('diary_varieties', diaryVarietyRows, { onConflict: 'diary_id,variety_id' });

  // diary_reports не имеет предсказуемого uuid из мок-данных (в моке у
  // отчётов вообще нет id) — используем детерминированный uuid от
  // "diaryMockId:reportNumber", это и даёт идемпотентность upsert.
  const reportRowsFinal = reportRows.map((r) => ({
    id: deterministicUuid('report', `${r._diaryMockId}:${r.report_number}`),
    diary_id: r.diary_id,
    report_number: r.report_number,
    day_number: r.day_number,
    title: r.title,
    stage: r.stage,
    note: r.note,
    temp_c: r.temp_c,
    humidity: r.humidity,
    report_date: r.report_date
  }));
  if (reportRowsFinal.length) await upsertBatch('diary_reports', reportRowsFinal);

  // Фото отчётов — печатаем в diary_photos, id тоже детерминированный.
  reportRows.forEach((r, i) => {
    (r._photos || []).forEach((url, pIdx) => {
      photoRows.push({
        id: deterministicUuid('photo', `${r._diaryMockId}:${r.report_number}:${pIdx}`),
        diary_report_id: reportRowsFinal[i].id,
        url, // ВНИМАНИЕ: если это base64 data URL (а не настоящий URL), сюда
             // попадёт огромная строка — перед реальной миграцией такие
             // фото нужно сначала залить в Supabase Storage и передать
             // сюда уже настоящий Storage URL (это отдельная задача, не
             // часть текущего Этапа 6, см. HANDOFF.md).
        position: pIdx
      });
    });
  });
  if (photoRows.length) await upsertBatch('diary_photos', photoRows);

  return diaryIdMap;
}

/** Комментарии переносим отдельным проходом — нужен полный список growers по имени. */
async function migrateComments(diaries, diaryIdMap, growers, growerIdMap) {
  const nameToAuthId = {};
  for (const g of growers) nameToAuthId[g.name] = growerIdMap[g.id];

  const rows = [];
  let skipped = 0;
  for (const d of diaries) {
    for (const [idx, c] of (d.comments || []).entries()) {
      const authorId = nameToAuthId[c.author];
      if (!authorId) { skipped++; continue; } // автор не найден среди growers — см. риск №2 из отчёта Этапа 1
      rows.push({
        id: deterministicUuid('comment', `${d.id}:${idx}`),
        diary_id: diaryIdMap[d.id],
        author_id: authorId,
        text_content: c.text
        // c.time ('сейчас'/'Nд назад') — не переносим, created_at = now() по умолчанию в БД (риск №2)
      });
    }
  }
  if (rows.length) await upsertBatch('comments', rows);
  return skipped;
}

// ---------------------------------------------------------------------------
// 5. RECIPES
// ---------------------------------------------------------------------------

async function migrateRecipes(recipes, growerIdMap, varietyIdMap) {
  const rows = recipes.map((r) => ({
    id: deterministicUuid('recipe', r.id),
    title: r.title,
    category: r.category,
    grower_id: growerIdMap[r.growerId] || null,
    variety_id: r.varietyId ? (varietyIdMap[r.varietyId] || null) : null,
    description: r.desc || '',
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    photo_url: r.photo || null,
    likes_count: r.likes || 0,
    views_count: r.views ?? Math.round((r.likes || 0) * 6.5), // та же формула, что в recipeService.js
    hidden: !!r.hidden
  }));
  await upsertBatch('recipes', rows);
}

// ---------------------------------------------------------------------------
// 6. BLOG_POSTS
// ---------------------------------------------------------------------------

async function migrateBlogPosts(posts, growerIdMap, varietyIdMap) {
  const rows = posts.map((p) => ({
    id: deterministicUuid('blogPost', p.id),
    slug: p.slug || `article-${p.id}`,
    title: p.title,
    grower_id: growerIdMap[p.growerId] || null,
    variety_id: p.varietyId ? (varietyIdMap[p.varietyId] || null) : null,
    photo_url: p.photo || null,
    tags: p.tags || [],
    excerpt: p.excerpt || '',
    content: p.content || [],
    status: p.status || 'approved', // сид блога в моке считается уже опубликованным (см. blogService.js)
    reject_reason: p.rejectReason || '',
    views_count: p.views || 0,
    published_date: isoDate(p.date)
  }));
  await upsertBatch('blog_posts', rows);
}

// ---------------------------------------------------------------------------
// 7. QUESTIONS + ANSWERS
// ---------------------------------------------------------------------------

async function migrateQuestions(questions, growerIdMap, diaryIdMap) {
  const questionIdMap = {};
  const rows = questions.map((q, idx) => {
    const mockId = 'q' + (idx + 1); // questionService.js присваивает id так же
    const newId = deterministicUuid('question', mockId);
    questionIdMap[mockId] = newId;
    return {
      id: newId,
      grower_id: growerIdMap[q.growerId] || null,
      diary_id: q.diaryId ? (diaryIdMap[q.diaryId] || null) : null,
      text_content: q.text,
      photo_url: q.photo || null,
      stage: q.stage || null,
      topic: q.topic || null,
      status: q.status || 'open',
      // createdAt/updatedAt пересчитываются questionService.js из daysAgo при
      // каждом старте приложения (риск №8, исправлен на Этапе 3 внутри
      // сервиса, но исходные QUESTIONS_SEED по-прежнему хранят daysAgo, а
      // не готовый ISO) — фиксируем ЗДЕСЬ раз и навсегда как момент миграции.
      created_at: new Date(Date.now() - (q.daysAgo || 0) * 86400000).toISOString()
    };
  });
  await upsertBatch('questions', rows);

  const answerRows = [];
  // Примечание: имена авторов ответов сопоставляются с profiles.id в
  // migrateAnswers() — там есть полный список growers, здесь его нет
  // намеренно (эта функция получает только growerIdMap по мок-id).
  questions.forEach((q, idx) => {
    const mockId = 'q' + (idx + 1);
    (q.answers || []).forEach((a, aIdx) => {
      answerRows.push({
        id: deterministicUuid('answer', `${mockId}:${aIdx}`),
        question_id: questionIdMap[mockId],
        _authorName: a.author,
        text_content: a.text,
        created_at: new Date(Date.now() - (a.daysAgo || 0) * 86400000).toISOString()
      });
    });
  });
  return { questionIdMap, answerRows };
}

async function migrateAnswers(answerRows, growers, growerIdMap) {
  const nameToAuthId = {};
  for (const g of growers) nameToAuthId[g.name] = growerIdMap[g.id];
  const adminGrower = growers.find((g) => g.role === 'admin');
  const adminAuthId = adminGrower ? growerIdMap[adminGrower.id] : null;
  const rows = [];
  let skipped = 0;
  for (const a of answerRows) {
    const authorId = a._authorName === 'Администратор' ? adminAuthId : nameToAuthId[a._authorName];
    if (!authorId) { skipped++; continue; }
    rows.push({ id: a.id, question_id: a.question_id, author_id: authorId, text_content: a.text_content, created_at: a.created_at });
  }
  if (rows.length) await upsertBatch('answers', rows);
  return skipped;
}

// ---------------------------------------------------------------------------
// 8. CONTESTS
// ---------------------------------------------------------------------------

async function migrateContests(contests) {
  const rows = contests.map((c) => ({
    id: deterministicUuid('contest', c.id),
    title: c.title,
    description: c.desc || '',
    full_description: c.fullDesc || c.desc || '',
    prize: c.prize || '',
    progress: c.progress || 0,
    deadline: isoDate(c.deadline),
    start_date: isoDate(c.startDate),
    status: c.status || 'upcoming',
    photo_url: c.photo || null,
    sponsor: c.sponsor || '',
    rules: c.rules || [],
    how_to_join: c.howToJoin || ''
  }));
  await upsertBatch('contests', rows);
}

// ---------------------------------------------------------------------------
// 9. LIGHTS / NUTRIENTS
// ---------------------------------------------------------------------------

async function migrateEquipment(table, items) {
  const rows = items.map((it, i) => ({
    id: deterministicUuid(table, it.id || `${table}-${i}`),
    name: it.name,
    brand: it.brand || '',
    type: it.type || '',
    tag: it.tag || '',
    price: it.price || '',
    rating: it.rating || 0,
    description: it.desc || '',
    link: it.link || '',
    photo_url: it.photo || null,
    sponsored: !!it.sponsored
  }));
  await upsertBatch(table, rows);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('Читаю src/data/*.js...');
  const mock = await loadMockData();

  const idMapCache = await loadIdMapCache();

  console.log('Мигрирую growers → auth.users + profiles...');
  const growerIdMap = await migrateGrowers(mock.growers, idMapCache);
  await saveIdMapCache(idMapCache); // сохраняем сразу — если скрипт упадёт дальше, пользователи уже не потеряются

  console.log('Мигрирую varieties...');
  const varietyIdMap = await migrateVarieties(mock.varieties, mock.growers, growerIdMap);

  console.log('Мигрирую diaries (+ отчёты, фото)...');
  const diaryIdMap = await migrateDiaries(mock.diaries, growerIdMap, varietyIdMap);

  console.log('Мигрирую comments...');
  const skippedComments = await migrateComments(mock.diaries, diaryIdMap, mock.growers, growerIdMap);

  console.log('Мигрирую recipes...');
  await migrateRecipes(mock.recipes, growerIdMap, varietyIdMap);

  console.log('Мигрирую blogPosts...');
  await migrateBlogPosts(mock.blogPosts, growerIdMap, varietyIdMap);

  console.log('Мигрирую questions + answers...');
  const { answerRows } = await migrateQuestions(mock.questions, growerIdMap, diaryIdMap);
  const skippedAnswers = await migrateAnswers(answerRows, mock.growers, growerIdMap);

  console.log('Мигрирую contests...');
  await migrateContests(mock.contests);

  console.log('Мигрирую lights и nutrients...');
  await migrateEquipment('lights', mock.lights);
  await migrateEquipment('nutrients', mock.nutrients);

  console.log('\n=== ОТЧЁТ ПО МИГРАЦИИ ===');
  for (const [table, stats] of Object.entries(report)) {
    console.log(`  ${table.padEnd(20)} ${stats.upserted} записей залито/обновлено`);
  }
  if (skippedComments) console.log(`  ⚠ пропущено комментариев (автор не найден среди growers): ${skippedComments}`);
  if (skippedAnswers) console.log(`  ⚠ пропущено ответов (автор не найден среди growers): ${skippedAnswers}`);
  console.log('\nГотово.');
}

main().catch((err) => {
  console.error('Миграция прервана с ошибкой:', err);
  process.exit(1);
});
