// Динамические SEO-теги страницы без сторонних библиотек.
//
// Как пользоваться на странице:
//   useSeoMeta({ title, description, image });
// Хук сам ставит: <title>, description, canonical, og:* и twitter:*.
// Canonical и og:url = baseUrl + текущий путь (без ?query и #hash).
// При уходе со страницы теги возвращаются к значениям по умолчанию.
//
// Хук нельзя вызывать условно — вызывайте его ДО ранних return в компоненте.
// Если данных ещё/уже нет, передавайте { title: '…не найден', noindex: true }.
//
// pending: true — теги уже можно ставить, но контент страницы ещё догружается
// (например, «лёгкий» дневник). Пока pending, метка data-seo-ready на <html>
// не ставится — по ней пререндер понимает, что страницу пора сохранять.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { baseUrl, siteName, titleSuffix, defaultMeta, staticPages, noindexPrefixes } from '../config/seo.js';

// Размеры и тип дефолтной картинки из index.html. У чужих картинок
// размер нам неизвестен — тогда эти теги убираем, чтобы не врать соцсетям.
const DEFAULT_IMAGE = { type: 'image/jpeg', width: '1200', height: '630' };

// Аккуратно обрезает текст до max символов по границе слова, добавляет «…»
export function cutText(text, max = 160) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,.;:—-]+$/, '') + '…';
}

// Делает из пути картинки полный URL (соцсети не понимают относительные)
function absoluteUrl(src) {
  if (!src || typeof src !== 'string') return null;
  if (/^(data|blob):/i.test(src)) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return 'https:' + src;
  return baseUrl + '/' + src.replace(/^\.?\//, '');
}

// Создаёт/обновляет <meta>; при пустом значении удаляет тег
function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (value == null || value === '') {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Собирает итоговые значения тегов. meta === null → значения по умолчанию.
function buildState(meta, pathname) {
  const m = meta || {};
  const path = pathname.replace(/\/+$/, '') || '/';
  const rawTitle = m.title || defaultMeta.title;
  const customImage = absoluteUrl(m.image);
  const noindex = !!m.noindex;
  return {
    documentTitle: rawTitle.includes(siteName) ? rawTitle : rawTitle + titleSuffix,
    ogTitle: rawTitle,
    description: m.description ? cutText(m.description, 160) : defaultMeta.description,
    image: customImage || defaultMeta.image,
    isDefaultImage: !customImage,
    type: m.type || 'website',
    // canonical и og:url нужны только индексируемым страницам с настроенными тегами
    url: meta && !noindex ? baseUrl + path : null,
    noindex,
  };
}

// Записывает значения в <head>
function writeState(s) {
  document.title = s.documentTitle;
  setMeta('name', 'description', s.description);
  setMeta('name', 'robots', s.noindex ? 'noindex' : null);
  setCanonical(s.url);

  setMeta('property', 'og:type', s.type);
  setMeta('property', 'og:url', s.url);
  setMeta('property', 'og:title', s.ogTitle);
  setMeta('property', 'og:description', s.description);
  setMeta('property', 'og:image', s.image);
  setMeta('property', 'og:image:alt', s.ogTitle);
  setMeta('property', 'og:image:type', s.isDefaultImage ? DEFAULT_IMAGE.type : null);
  setMeta('property', 'og:image:width', s.isDefaultImage ? DEFAULT_IMAGE.width : null);
  setMeta('property', 'og:image:height', s.isDefaultImage ? DEFAULT_IMAGE.height : null);

  setMeta('name', 'twitter:title', s.ogTitle);
  setMeta('name', 'twitter:description', s.description);
  setMeta('name', 'twitter:image', s.image);
}

/**
 * @param {null | {
 *   title?: string, description?: string, image?: string,
 *   type?: string, noindex?: boolean, pending?: boolean
 * }} meta  null — ничего не менять (страница без своих тегов)
 */
export function useSeoMeta(meta) {
  const { pathname } = useLocation();
  const active = !!meta;
  const title = meta?.title;
  const description = meta?.description;
  const image = meta?.image;
  const type = meta?.type;
  const noindex = meta?.noindex;
  const pending = !!meta?.pending;

  useEffect(() => {
    if (!active) return undefined;
    writeState(buildState({ title, description, image, type, noindex }, pathname));
    // Метка «теги И контент страницы готовы» — по ней пререндер (Шаг 4)
    // поймёт, что страницу можно сохранять. Пока pending — метку не ставим.
    if (!pending) document.documentElement.setAttribute('data-seo-ready', pathname);
    return () => {
      writeState(buildState(null, pathname));
      document.documentElement.removeAttribute('data-seo-ready');
    };
  }, [active, title, description, image, type, noindex, pending, pathname]);
}

// Компонент-обёртка: <SeoMeta title="…" noindex /> — для мест, где хук не вызвать
export function SeoMeta(props) {
  useSeoMeta(props);
  return null;
}

// Теги для страниц без динамических данных: берёт тексты из staticPages
// в src/config/seo.js. На динамических страницах (/varieties/:id и т.п.)
// ничего не делает — они ставят теги сами через useSeoMeta.
export function StaticRouteSeo() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  let meta = staticPages[path] || null;
  if (!meta && noindexPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
    meta = { title: 'Админ-панель', noindex: true };
  }
  useSeoMeta(meta);
  return null;
}
