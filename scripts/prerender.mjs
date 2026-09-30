// Пререндер (Шаг 4.1): после "vite build" открывает каждую страницу из sitemap
// в headless-Chromium, ждёт, пока приложение загрузит данные, и сохраняет готовый
// HTML в dist/. Боты и соцсети получают страницу с контентом, а живой пользователь —
// тот же React (см. main.jsx).
//
// ГЛАВНОЕ ПРАВИЛО: скрипт НИКОГДА не роняет сборку. Любая ошибка — предупреждение,
// сайт в худшем случае остаётся обычным SPA.
//
// Настройки через переменные окружения (все необязательные):
//   SKIP_PRERENDER=1            — пропустить пререндер (быстрая локальная сборка)
//   PRERENDER_MAX=2000          — максимум страниц
//   PRERENDER_BUDGET_MIN=10     — бюджет времени, минут (лимит сборки Cloudflare — 20)
//   PRERENDER_PAGE_TIMEOUT_MS   — ожидание одной страницы (по умолч. 20000)
//   PRERENDER_HOME_TARGET=/home — куда правило _redirects отправляет "/"
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseUrl } from '../src/config/seo.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');

// ---------- НАСТРОЙКИ ----------
const CONCURRENCY = 6; // сколько вкладок открыто одновременно
const MAX_ATTEMPTS = 2; // одна повторная попытка при сбое страницы
const PAGE_TIMEOUT_MS = Number(process.env.PRERENDER_PAGE_TIMEOUT_MS) || 20000;
const MAX_PAGES = Number(process.env.PRERENDER_MAX) || 2000;
const TIME_BUDGET_MS = (Number(process.env.PRERENDER_BUDGET_MIN) || 10) * 60 * 1000;
const HOME_TARGET = process.env.PRERENDER_HOME_TARGET || '/home';
const MIN_MAIN_TEXT = 20; // минимум символов текста в <main>, иначе страница считается пустой

const log = (...args) => console.log('[prerender]', ...args);
const warn = (...args) => console.warn('[prerender] ⚠', ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errText = (e) => String(e?.message || e).split('\n')[0].slice(0, 200);

// ---------- ЧТЕНИЕ СПИСКА СТРАНИЦ ----------

// Берём адреса из dist/sitemap.xml (копия sitemap из public/ после сборки)
async function readRoutes() {
  const xml = await readFile(join(distDir, 'sitemap.xml'), 'utf8');
  const unescapeXml = (s) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
     .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const routes = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = unescapeXml(m[1].trim());
    if (!loc.startsWith(baseUrl)) {
      warn(`адрес не с baseUrl, пропускаем: ${loc}`);
      continue;
    }
    const path = (loc.slice(baseUrl.length) || '/').split('?')[0].split('#')[0];
    if (!path.startsWith('/') || seen.has(path)) continue;
    seen.add(path);
    routes.push(path);
  }
  return routes;
}

// Путь страницы → имя файла в dist. Плоская раскладка, без слэша в конце адреса:
//   /varieties/<id> → varieties/<id>.html      (Pages отдаёт как /varieties/<id>)
//   /              → home.html
// Возвращает null, если в адресе есть небезопасные символы.
function routeToFile(path) {
  if (path === '/') return 'home.html';
  const safe = [];
  for (const part of path.split('/').filter(Boolean)) {
    let decoded;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      return null;
    }
    if (!/^[A-Za-z0-9._~-]+$/.test(decoded) || decoded === '.' || decoded === '..') return null;
    safe.push(decoded);
  }
  return safe.length ? safe.join('/') + '.html' : null;
}

// ---------- МИНИ-СЕРВЕР ----------
// Отдаёт файлы из dist/, а для всего остального — index.html (как Cloudflare Pages
// в режиме SPA). Никакой магии с ".html": готовые снимки, записанные в dist,
// не могут подмешаться в загрузку других страниц.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let target = null;
      if (pathname !== '/') {
        const candidate = join(distDir, pathname);
        if (candidate.startsWith(distDir + sep)) {
          try {
            if ((await stat(candidate)).isFile()) target = candidate;
          } catch {
            // файла нет — пойдёт SPA-fallback
          }
        }
      }
      if (!target) target = join(distDir, 'index.html');
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e?.message || e));
    }
  });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolveServer({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

// ---------- ОДНА СТРАНИЦА ----------

const isApi = (url) => url.includes('/rest/v1/'); // запросы к Supabase REST
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Чистим снимок и помечаем корень — по метке data-prerendered main.jsx поймёт,
// что в HTML лежит готовый снимок (Шаг 4.2).
function finalizeHtml(html, path) {
  const cleaned = html.replace(/(<html\b[^>]*?)\sdata-seo-ready="[^"]*"/, '$1');
  const rootOpen = '<div id="root">';
  if (!cleaned.includes(rootOpen)) throw new Error('в HTML не найден <div id="root">');
  return cleaned.replace(rootOpen, () => `<div id="root" data-prerendered="${escapeAttr(path)}">`);
}

// Возвращает { html } или { skip: 'причина' }; при проблеме бросает ошибку
async function renderRoute(browser, origin, path) {
  const page = await browser.newPage();
  const apiProblems = [];
  try {
    await page.setViewport({ width: 1280, height: 900 });

    // Шрифты и видео не нужны для HTML. Картинки НЕ блокируем: часть компонентов
    // меняет вид по onLoad, и снимок получился бы с пустыми фото.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      const job = type === 'font' || type === 'media' ? req.abort() : req.continue();
      Promise.resolve(job).catch(() => {});
    });

    // Сбой запроса к Supabase = данные могли не загрузиться (приложение молча
    // подставит пустые списки или мок). Такой снимок сохранять нельзя.
    page.on('requestfailed', (req) => {
      if (isApi(req.url())) apiProblems.push(`сбой запроса ${new URL(req.url()).pathname}`);
    });
    page.on('response', (res) => {
      if (isApi(res.url()) && (res.status() >= 500 || res.status() === 429)) {
        apiProblems.push(`HTTP ${res.status()} ${new URL(res.url()).pathname}`);
      }
    });

    await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });

    // Метка ставится хуком useSeoMeta, когда теги И контент страницы окончательные
    await page.waitForFunction(
      (p) => document.documentElement.getAttribute('data-seo-ready') === p,
      { timeout: PAGE_TIMEOUT_MS },
      path
    );
    // два кадра — чтобы React успел дорисовать всё после эффектов
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    if (apiProblems.length) throw new Error(`Supabase: ${apiProblems[0]}`);

    const info = await page.evaluate(() => {
      const main = document.querySelector('main');
      return {
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
        mainText: main ? main.innerText.trim().length : 0,
        stillLoading: /Загрузка ChiliDiaries|Загружаю дневник/.test(document.body.innerText),
      };
    });

    if (/noindex/i.test(info.robots)) return { skip: 'noindex' };
    if (info.stillLoading) throw new Error('на странице остался экран загрузки');
    if (info.mainText < MIN_MAIN_TEXT) throw new Error('пустой <main>');
    const expectedCanonical = baseUrl + path;
    if (info.canonical !== expectedCanonical) {
      throw new Error(`canonical "${info.canonical}" ≠ "${expectedCanonical}"`);
    }

    return { html: finalizeHtml(await page.content(), path) };
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------- ЗАПИСЬ В dist ----------

async function writeResults(results) {
  if (results.size === 0) {
    warn('нечего записывать — сайт остаётся обычным SPA');
    return;
  }
  for (const { file, html } of results.values()) {
    const full = join(distDir, file);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, html, 'utf8');
  }
  log(`записано файлов: ${results.size}`);

  // Правило создаём ТОЛЬКО если снимок главной есть — иначе "/" осталась бы без страницы.
  if (results.has('/')) {
    await writeFile(join(distDir, '_redirects'), `/  ${HOME_TARGET}  200\n`, 'utf8');
    log(`создан dist/_redirects: "/" → ${HOME_TARGET}`);
  } else {
    warn('снимок главной не получился — _redirects не создаём, главная остаётся обычным SPA');
  }
}

// ---------- ГЛАВНАЯ ФУНКЦИЯ ----------

async function main() {
  if (process.env.SKIP_PRERENDER === '1') {
    log('SKIP_PRERENDER=1 — пропускаем');
    return;
  }
  if (!existsSync(join(distDir, 'index.html'))) {
    warn('нет dist/index.html — сначала нужен "vite build"');
    return;
  }

  let routes;
  try {
    routes = await readRoutes();
  } catch (e) {
    warn(`не удалось прочитать dist/sitemap.xml: ${errText(e)}`);
    return;
  }
  if (routes.length === 0) {
    warn('в sitemap нет страниц');
    return;
  }
  if (routes.length > MAX_PAGES) {
    warn(`страниц ${routes.length}, берём первые ${MAX_PAGES} (PRERENDER_MAX)`);
    routes = routes.slice(0, MAX_PAGES);
  }

  let puppeteer;
  try {
    const mod = await import('puppeteer');
    puppeteer = mod.default ?? mod;
  } catch (e) {
    warn(`пакет puppeteer не найден (${errText(e)}) — пропускаем пререндер`);
    return;
  }

  // Убираем следы прошлого запуска, чтобы _redirects и home.html не остались «сиротами»
  await rm(join(distDir, '_redirects'), { force: true });
  await rm(join(distDir, 'home.html'), { force: true });

  const total = routes.length;
  const startedAt = Date.now();
  const results = new Map(); // путь → { file, html }
  const counts = { ok: 0, skipped: 0, failed: 0 };
  const failures = [];
  let done = 0;
  let next = 0;
  let budgetHit = false;

  let server;
  let browser;
  try {
    const started = await startServer();
    server = started.server;
    const origin = started.origin;

    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--lang=ru-RU'],
    });
    log(`старт: ${total} стр., вкладок: ${CONCURRENCY}, Chrome ${await browser.version()}`);

    async function handle(path) {
      const file = routeToFile(path);
      if (!file) {
        done++;
        counts.skipped++;
        log(`– ${done}/${total} пропуск (небезопасный адрес) ${path}`);
        return;
      }
      let lastError;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const t0 = Date.now();
        try {
          const r = await renderRoute(browser, origin, path);
          done++;
          if (r.skip) {
            counts.skipped++;
            log(`– ${done}/${total} пропуск (${r.skip}) ${path}`);
          } else {
            results.set(path, { file, html: r.html });
            counts.ok++;
            log(`✓ ${done}/${total} ${path} (${((Date.now() - t0) / 1000).toFixed(1)} с)`);
          }
          return;
        } catch (e) {
          lastError = e;
          if (attempt < MAX_ATTEMPTS) await sleep(500);
        }
      }
      done++;
      counts.failed++;
      failures.push(`${path} — ${errText(lastError)}`);
      warn(`✗ ${done}/${total} ${path}: ${errText(lastError)}`);
    }

    async function worker() {
      for (;;) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          budgetHit = true;
          return;
        }
        const i = next++;
        if (i >= total) return;
        await handle(routes[i]);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch (e) {
    warn(`пререндер прерван: ${errText(e)}`);
  } finally {
    await browser?.close().catch(() => {});
    server?.close();
  }

  if (budgetHit) warn(`вышло время (${TIME_BUDGET_MS / 60000} мин): необработано ${Math.max(0, total - done)} стр.`);

  try {
    await writeResults(results);
  } catch (e) {
    warn(`ошибка записи файлов: ${errText(e)}`);
  }

  log(
    `Готово за ${Math.round((Date.now() - startedAt) / 1000)} с: ` +
    `сохранено ${counts.ok}, пропущено ${counts.skipped}, с ошибкой ${counts.failed}`
  );
  if (failures.length) {
    warn('страницы с ошибкой (остаются обычным SPA):');
    failures.slice(0, 20).forEach((f) => warn('  ' + f));
    if (failures.length > 20) warn(`  …и ещё ${failures.length - 20}`);
  }
}

main()
  .catch((e) => warn(`неожиданная ошибка: ${errText(e)}`))
  .finally(() => process.exit(0)); // всегда успешно: сборка не должна падать из-за пререндера
