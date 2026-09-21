import { BLOG_POSTS } from '../data/blogPosts.js';
import { ok, fail } from './_result.js';
import { slugify } from '../domain/factories.js';
import { supabase } from './supabase/client.js';
import { blogPostRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';

// Deterministic-looking seed engagement numbers (not random on every load,
// so the UI doesn't jitter between renders/refreshes of the mock data).
function seedViews(index) {
  return 480 + (index * 137) % 2600;
}
function seedLikes(index) {
  return 12 + (index * 7) % 180;
}

let _store = null;
function store() {
  if (!_store) {
    _store = BLOG_POSTS.map((p, i) => ({
      ...p,
      status: 'approved', // seed content is already published
      views: seedViews(i),
      likes: seedLikes(i),
      liked: false
    }));
  }
  return _store;
}

// Этап 3, Группа B: сначала пробуем Supabase (таблица blog_posts), при
// ошибке или пустом ответе — падаем на мок (store()) с console.warn.
//
// Джойн на profiles здесь НЕ нужен: в форме BlogPost (types.js,
// data/blogPosts.js) нет authorName/growerName.
//
// РЕШЕНИЕ, которое стоит проверить (не чистый маппинг колонок): мок в
// store() принудительно ставил всем сид-записям status:'approved' — то
// есть публичный список ВСЕГДА показывал только "опубликованные" статьи.
// В реальной БД status — настоящая колонка (pending/approved/rejected), и
// без фильтра сюда попадут черновики на модерации и отклонённые статьи.
// Поэтому fetchInitialPosts (публичный список для /blog) фильтрует
// .eq('status', 'approved'), воспроизводя эффективное поведение мока.
// getBlogPostById/getBlogPostBySlug фильтр НЕ применяют (открывают пост
// по id/slug независимо от статуса) — в моке такой фильтрации тоже не
// было. Если это неверно для твоего UI (например, автор должен видеть
// свой pending-пост по прямой ссылке, а посторонний — нет), скажи, поправим
// отдельно — это уже вопрос авторизации, а не просто маппинга полей.
export async function fetchInitialPosts() {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('status', 'approved');
    if (error) {
      console.warn('[blogService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(blogPostRowToJs));
    } else {
      console.warn('[blogService] Supabase вернул пустой список статей, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[blogService] Не удалось получить статьи из Supabase, использую mock-данные:', e.message);
  }

  try {
    return ok(store().map((p) => ({ ...p })));
  } catch (e) {
    return fail(e);
  }
}

/** getBlogPostById(id) — та же схема fallback'а, что в fetchInitialPosts (без фильтра по статусу, см. комментарий выше). */
export async function getBlogPostById(id) {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.warn(`[blogService] Supabase вернул ошибку при получении статьи ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(blogPostRowToJs(data));
    } else {
      console.warn(`[blogService] Supabase не нашёл статью ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[blogService] Не удалось получить статью ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((p) => p.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Blog post ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

/** getBlogPostBySlug(slug) — та же схема fallback'а (без фильтра по статусу, см. комментарий выше). */
export async function getBlogPostBySlug(slug) {
  try {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      console.warn(`[blogService] Supabase вернул ошибку при получении статьи по slug "${slug}", использую mock-данные:`, error.message);
    } else if (data) {
      return ok(blogPostRowToJs(data));
    } else {
      console.warn(`[blogService] Supabase не нашёл статью со slug "${slug}", пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[blogService] Не удалось получить статью со slug "${slug}" из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((p) => p.slug === slug);
    return found ? ok({ ...found }) : fail(new Error(`Blog post со slug "${slug}" не найден`));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertBlogPost({ growerId, title, content, excerpt, photo, tags, varietyId })
 * — Этап 3, Группа 2 (write). Без fallback'а на мок.
 *
 * status всегда 'pending' (модерация), published_date — сегодня. slug строится
 * так же, как в createPostFromForm (slugify + Date.now() для уникальности).
 *
 * photo: base64 в photo_url не отправляется (см. _photo.js). Если вернувшийся
 * post.photo === null при непустом photo на входе — фото было отброшено.
 *
 * ВНИМАНИЕ (RLS): .insert().select() требует, чтобы SELECT-политика blog_posts
 * позволяла автору прочитать СВОЮ pending-строку. Если SELECT-политика только
 * "status = 'approved'", INSERT откатится с "new row violates row-level
 * security policy" — тогда в политику нужно добавить `or grower_id = auth.uid()`.
 *
 * createPostFromForm ниже остаётся как был — его использует админка.
 */
export async function insertBlogPost({ growerId, title, content, excerpt, photo, tags, varietyId }) {
  try {
    const paragraphs = Array.isArray(content) ? content : content ? [String(content)] : [];
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        grower_id: growerId,
        title,
        slug: slugify(title) + '-' + Date.now(),
        variety_id: varietyId || null,
        photo_url: await photoUrlForDb(photo, 'blogService'),
        tags: tags && tags.length ? tags : ['острый перец'],
        excerpt: excerpt || (paragraphs[0] ? paragraphs[0].slice(0, 140) : ''),
        content: paragraphs,
        status: 'pending',
        published_date: new Date().toISOString().slice(0, 10)
      })
      .select()
      .single();
    if (error) return fail(error);
    return ok(blogPostRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * incrementBlogViewsRpc(postId) — Этап 5, Группа 4B: +1 к blog_posts.views_count.
 *
 * Идёт через RPC increment_blog_views (security definer, миграция 0011), а не
 * через .update(): по RLS обновить чужую статью может только владелец/админ,
 * а просмотры засчитываются и гостям. Без fallback'а на мок; вызывающий код
 * (AppContext.incrementBlogViews) при ошибке только пишет console.warn.
 * Ошибку отдаём через fail(error) — как и остальные write-функции файла.
 */
export async function incrementBlogViewsRpc(postId) {
  try {
    const { error } = await supabase.rpc('increment_blog_views', { post_id: postId });
    if (error) return fail(error);
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

// Write-функция — по правилам Этапа 3 не трогаем, остаётся на моке.
export async function createPostFromForm({ title, varietyId, tags, content, photo, growerId }) {
  try {
    const post = {
      id: 'b_' + Date.now(),
      // Раньше было 'article-' + Date.now() (не читаемо, не из title —
      // риск №5 из отчёта Этапа 1). slug не используется сейчас ни в
      // роутинге, ни в компонентах (проверено), так что менять формат
      // безопасно; Date.now() в конце сохраняет уникальность.
      slug: slugify(title) + '-' + Date.now(),
      title,
      growerId,
      varietyId: varietyId || null,
      photo: photo || null,
      tags: tags && tags.length ? tags : ['острый перец'],
      excerpt: content[0] ? content[0].slice(0, 140) : '',
      content,
      date: new Date().toISOString().slice(0, 10),
      status: 'pending', // goes to moderation — only visible to its author until approved
      views: 0,
      likes: 0,
      liked: false
    };
    return ok(post);
  } catch (e) {
    return fail(e);
  }
}
