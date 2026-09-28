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

/**
 * fetchAllBlogPosts() — фикс: fetchInitialPosts (публичный список для
 * /blog) фильтрует .eq('status', 'approved') — это правильно для
 * публичной ленты, но означает, что pending/rejected статьи никогда не
 * попадают в общий state blogPosts, и админка (AdminBlog.jsx) их не видит,
 * модерация невозможна. Эта функция — отдельный SELECT БЕЗ фильтра по
 * статусу, специально для админки: грузится в её собственный локальный
 * state через тонкий прокси в AppContext, не подмешивается в общий
 * blogPosts (публичная лента как фильтровала approved, так и фильтрует).
 *
 * Сортировка — published_date DESC (как и ожидалось от списка "последние
 * сверху"); без fallback'а на мок, как и остальные write/bulk-read функции
 * этого файла.
 */
export async function fetchAllBlogPosts() {
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_date', { ascending: false });
    if (error) return fail(error);
    return ok((data || []).map(blogPostRowToJs));
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

/**
 * updateBlogPost(id, patch) — Этап 1.3 текущего захода: реальный UPDATE
 * blog_posts для админки (AdminBlog.jsx). Partial-update. slug НЕ
 * трогаем, если не передан явно (slug используется как публичный URL
 * статьи — менять его при каждом сохранении заголовка сломало бы уже
 * расшаренные ссылки).
 */
export async function updateBlogPost(id, patch) {
  try {
    const row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.slug !== undefined) row.slug = patch.slug;
    if (patch.varietyId !== undefined) row.variety_id = patch.varietyId || null;
    if (patch.photo !== undefined) row.photo_url = await photoUrlForDb(patch.photo, 'blogService');
    if (patch.tags !== undefined) row.tags = patch.tags;
    if (patch.excerpt !== undefined) row.excerpt = patch.excerpt;
    if (patch.content !== undefined) row.content = patch.content;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.rejectReason !== undefined) row.reject_reason = patch.rejectReason;

    const { data, error } = await supabase
      .from('blog_posts')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Статья не найдена или нет прав'));
    return ok(blogPostRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** deleteBlogPost(id) — Этап 1.3. Простой DELETE (комментариев/лайков к статьям в этой схеме нет). */
export async function deleteBlogPost(id) {
  try {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) return fail(error);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * moderateBlogPost(id, decision, reason) — Этап 1.3: тонкая обёртка над
 * updateBlogPost, ничего своего не делает — просто удобное имя для
 * вызова из adminModerateBlogPost. decision: 'approved' | 'rejected'.
 */
export async function moderateBlogPost(id, decision, reason) {
  return updateBlogPost(id, {
    status: decision,
    rejectReason: decision === 'rejected' ? (reason || '') : null
  });
}

/**
 * insertBlogPostFromAdmin(data) — Этап 1.3: заменяет старый мок
 * createPostFromForm. Реальный INSERT, status сразу 'approved' (админ
 * публикует напрямую, минуя модерацию), grower_id = growerId,
 * который передаёт AppContext (currentUser.growerId залогиненного админа).
 */
export async function insertBlogPostFromAdmin({ title, varietyId, tags, content, photo, growerId }) {
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
        excerpt: paragraphs[0] ? paragraphs[0].slice(0, 140) : '',
        content: paragraphs,
        status: 'approved',
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
