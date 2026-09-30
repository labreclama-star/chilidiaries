// Генерирует public/sitemap.xml и public/robots.txt перед сборкой.
// Запускается автоматически из "npm run build".
// Supabase читаем напрямую через REST (fetch), без supabase-js:
// так скрипт работает на любой версии Node (20, 22) и на Cloudflare Pages.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { baseUrl } from '../src/config/seo.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(rootDir, 'public');

// ---------- НАСТРОЙКИ (менять только здесь) ----------

// Статичные публичные страницы.
// /admin и /my-diaries сюда НЕ попадают — они закрыты от поисковиков.
// /lights и /nutrients закомментированы: они скрыты «в разработке».
// Когда откроете вкладки — раскомментируйте.
const staticPaths = [
  '/',
  '/feed',
  '/diaries',
  '/growers',
  '/varieties',
  // '/lights',
  // '/nutrients',
  '/contests',
  '/leaderboard',
  '/recipes',
  '/questions',
  '/blog',
  '/how',
];

// Динамические страницы: префикс адреса + таблица в Supabase.
// Названия таблиц сверены с мапперами (src/services/supabase/mappers.js).
// filter — необязательные параметры PostgREST: убирают скрытые/удалённые записи.
const dynamicSources = [
  { prefix: '/varieties', table: 'varieties' },
  { prefix: '/diaries', table: 'diaries' },
  {
    prefix: '/recipes',
    table: 'recipes',
    // скрытые админом рецепты не показываем (hidden может быть null)
    filter: { or: '(hidden.is.null,hidden.eq.false)' },
  },
  {
    prefix: '/blog',
    table: 'blog_posts',
    // в sitemap только одобренные модерацией статьи (pending / rejected — не попадают)
    filter: { status: 'eq.approved' },
  },
  { prefix: '/questions', table: 'questions' },
  {
    prefix: '/growers',
    table: 'profiles',
    // забаненных и удалённых гроверов не показываем.
    // Два условия объединяем через одно and=(...), чтобы не повторять or=
    filter: {
      and: '(or(banned.is.null,banned.eq.false),or(deleted.is.null,deleted.eq.false))',
    },
  },
];

// Что закрываем в robots.txt
const disallowPaths = ['/admin', '/my-diaries'];

// Сколько строк просим за один запрос (Supabase отдаёт максимум 1000)
const PAGE_SIZE = 1000;

// ---------- КОД ----------

// Экранируем символы, которые ломают XML
const escapeXml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Читаем ключи Supabase: из .env локально или из переменных Cloudflare на деплое
const env = loadEnv('production', rootDir, 'VITE_');
const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''); // без слэша в конце
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabase) {
  console.warn('[seo] Нет VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — sitemap будет только из статичных страниц');
}

// Забираем все id из таблицы порциями по 1000 —
// так работает и с 5 записями, и с 5000.
async function fetchAllIds(table, filter = {}) {
  const ids = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select: 'id',
      order: 'id.asc', // стабильный порядок, чтобы страницы не «плыли»
      limit: String(PAGE_SIZE),
      offset: String(offset),
      ...filter,
    });

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(20000), // не ждём дольше 20 секунд
    });

    if (!res.ok) {
      // При ошибке PostgREST отдаёт JSON вида { message: '...' }
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) message += `: ${body.message}`;
      } catch {
        // тело не JSON — оставляем только статус
      }
      throw new Error(message);
    }

    const rows = await res.json();
    ids.push(...rows.map((row) => row.id));
    if (rows.length < PAGE_SIZE) break; // получили меньше 1000 — это последняя порция
  }
  return ids;
}

async function main() {
  const paths = [...staticPaths];

  if (hasSupabase) {
    for (const { prefix, table, filter } of dynamicSources) {
      try {
        const ids = await fetchAllIds(table, filter);
        ids.forEach((id) => paths.push(`${prefix}/${encodeURIComponent(id)}`));
        console.log(`[seo] ${table}: ${ids.length} стр.`);
      } catch (err) {
        // Не роняем сборку — просто пропускаем этот раздел
        console.warn(`[seo] Не удалось прочитать "${table}": ${err.message}`);
      }
    }
  }

  const urls = paths
    .map((p) => `  <url><loc>${escapeXml(baseUrl + p)}</loc></url>`)
    .join('\n');
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  const robots =
    `User-agent: *\nAllow: /\n` +
    disallowPaths.map((p) => `Disallow: ${p}`).join('\n') +
    `\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

  mkdirSync(publicDir, { recursive: true });
  writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemap);
  writeFileSync(resolve(publicDir, 'robots.txt'), robots);
  console.log(`[seo] Готово: sitemap.xml (${paths.length} URL) и robots.txt`);
}

main().catch((err) => {
  // Последняя страховка: даже при неожиданной ошибке сборку не роняем
  console.warn(`[seo] Неожиданная ошибка: ${err.message}`);
});
