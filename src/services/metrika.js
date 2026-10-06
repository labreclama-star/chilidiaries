// Загрузка Яндекс.Метрики без сторонних библиотек.
// Важно: script-тег создаём БЕЗ crossorigin="anonymous" — именно он вызывал
// CORS-блокировку запросов к mc.yandex.ru и ошибки Access-Control-Allow-Origin.

export const METRIKA_ID = 113462451;

export function initMetrika() {
  if (typeof window === 'undefined') return;
  if (window.__metrikaInited) return;
  window.__metrikaInited = true;

  (function(m, e, t, r, i, k, a) {
    m[i] = m[i] || function() { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (let j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  window.ym(METRIKA_ID, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    trackHash: true,
  });
}
