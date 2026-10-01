import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppProvider } from './context/AppContext.jsx';
import App from './App.jsx';
import { loadState } from './services/persistenceService.js';
import './index.css';

// ---------------------------------------------------------------------------
// Подмена пререндер-снимка без мигания (Шаг 4.2).
//
// Пререндер (scripts/prerender.mjs) кладёт в HTML готовый контент страницы:
//   <div id="root" data-prerendered="/путь/страницы"> …снимок… </div>
// Если просто сделать createRoot(#root).render(), React выбросит снимок и покажет
// «Загрузка ChiliDiaries…», пока идут данные — контент мигнёт. Поэтому:
//   1) снимок остаётся на экране;
//   2) живое приложение строится рядом, в скрытом контейнере;
//   3) когда приложение сообщает «страница готова» (метка data-seo-ready на <html>,
//      её ставит хук useSeoMeta), снимок удаляется, а живое приложение показывается.
// Если метки нет 8 секунд — показываем живое приложение как есть (страховка).
// Без снимка (dev-режим, SPA-оболочка index.html) всё работает как раньше.
// ---------------------------------------------------------------------------

const MAX_SNAPSHOT_WAIT_MS = 8000;

const tree = (
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// '/varieties/abc/' и '/varieties/abc' — один и тот же путь
const normalizePath = (p) => (p || '/').replace(/\/+$/, '') || '/';

// Пока виден снимок, приложение при запуске на миг сбрасывает тему и сайдбар в
// значения по умолчанию (AppContext сначала ставит theme='dark', потом читает
// сохранённое). Для пользователей светлой темы это было бы миганием на весь экран.
// Здесь мы сразу (до отрисовки кадра) возвращаем сохранённые значения.
function guardUiState() {
  const saved = loadState(); // тот же ключ и формат, что у приложения
  const wantLight = saved?.theme === 'light';
  const wantCollapsed = saved?.sidebarCollapsed === true;
  const html = document.documentElement;
  const body = document.body;

  const apply = () => {
    if ((html.getAttribute('data-theme') === 'light') !== wantLight) {
      if (wantLight) html.setAttribute('data-theme', 'light');
      else html.removeAttribute('data-theme');
    }
    if (body.classList.contains('sidebar-collapsed') !== wantCollapsed) {
      body.classList.toggle('sidebar-collapsed', wantCollapsed);
    }
  };

  apply();
  const observer = new MutationObserver(apply); // колбэк выполняется до отрисовки кадра
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  observer.observe(body, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function mountOverSnapshot(snapshotRoot) {
  const html = document.documentElement;
  const stopGuard = guardUiState();

  // Живое приложение строим в скрытом контейнере. height:0 + overflow:hidden —
  // чтобы он не менял высоту страницы, но внутри всё имело реальную ширину
  // (компоненты, которые что-то измеряют при запуске, получат верные размеры).
  // Контейнер стоит ПЕРЕД снимком: пока оба существуют, getElementById() для
  // повторяющихся id (например, appMain) находит элемент живого приложения.
  const live = document.createElement('div');
  live.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  snapshotRoot.before(live);

  // ScrollToTop в App.jsx при запуске прокручивает страницу вверх — а снимок
  // может быть уже прокручен пользователем. Пока снимок на экране, глушим scrollTo.
  const originalScrollTo = window.scrollTo;
  window.scrollTo = () => {};

  html.removeAttribute('data-seo-ready'); // на случай, если метка попала в снимок

  let swapped = false;
  let timer;
  const observer = new MutationObserver(() => {
    if (html.hasAttribute('data-seo-ready')) swap();
  });

  function swap() {
    if (swapped) return;
    swapped = true;
    observer.disconnect();
    clearTimeout(timer);
    stopGuard();
    window.scrollTo = originalScrollTo;
    snapshotRoot.remove();
    live.removeAttribute('style');
    live.id = 'root';
  }

  observer.observe(html, { attributes: true, attributeFilter: ['data-seo-ready'] });
  timer = setTimeout(() => {
    // Если React упал, контейнер пуст — тогда лучше оставить снимок, чем пустой экран
    if (live.childElementCount > 0) swap();
  }, MAX_SNAPSHOT_WAIT_MS);

  ReactDOM.createRoot(live).render(tree);
}

const root = document.getElementById('root');
let snapshotPath = root.getAttribute('data-prerendered');

// Главная лежит в снимке home.html и отдаётся по адресу "/" (правило _redirects).
// Если человек зашёл прямо на /home — возвращаем адрес "/", иначе роутер покажет 404.
if (snapshotPath === '/' && ['/home', '/home.html'].includes(normalizePath(window.location.pathname))) {
  window.history.replaceState(null, '', '/' + window.location.search + window.location.hash);
}

if (snapshotPath !== null && normalizePath(snapshotPath) === normalizePath(window.location.pathname)) {
  mountOverSnapshot(root);
} else {
  if (snapshotPath !== null) {
    // Снимок другой страницы — не показываем его
    root.replaceChildren();
    root.removeAttribute('data-prerendered');
    snapshotPath = null;
  }
  ReactDOM.createRoot(root).render(tree);
}
