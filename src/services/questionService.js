// Mock-backed Q&A service. Same pattern as recipeService/blogService: async,
// { data, error }-shaped, so the body can become real
// `supabase.from('questions')` calls later without touching components.

import { QUESTIONS_SEED } from '../data/questions.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { questionRowToJs, answerRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';

function isoDaysAgo(days) {
  return new Date(Date.now() - (days || 0) * 24 * 60 * 60 * 1000).toISOString();
}

// ФИКС риска №8 из отчёта Этапа 1: раньше daysAgo → ISO пересчитывался
// ЗАНОВО при каждом вызове fetchInitialQuestions(), то есть createdAt/updatedAt
// сдвигались при каждой перезагрузке/повторном фетче. Теперь ISO-даты
// вычисляются один раз, при первом обращении к внутреннему хранилищу, и
// дальше не меняются — так же, как это будет с реальными created_at из БД.
let _store = null;
function store() {
  if (!_store) {
    _store = QUESTIONS_SEED.map((q, idx) => {
      const createdAt = isoDaysAgo(q.daysAgo);
      const answers = (q.answers || []).map((a, aIdx) => ({
        id: `qa${idx + 1}_${aIdx + 1}`,
        author: a.author,
        text: a.text,
        createdAt: isoDaysAgo(a.daysAgo)
      }));
      const updatedAt = answers.length ? answers[answers.length - 1].createdAt : createdAt;
      return {
        id: 'q' + (idx + 1),
        growerId: q.growerId,
        diaryId: q.diaryId || null,
        text: q.text,
        photo: q.photo || null,
        stage: q.stage || null,
        topic: q.topic || null,
        status: q.status || 'open',
        likes: q.likes || 0,
        liked: false,
        createdAt,
        updatedAt,
        answers
      };
    });
  }
  return _store;
}

// Общий select для questions + вложенных answers с именем автора каждого
// ответа. Хинт `!author_id` обязателен: у answers единственный FK на
// profiles (author_id), но явный хинт не помешает и защищает от будущей
// поломки, если на profiles появится второй FK из answers.
// PostgREST возвращает вложенный author как ОДИН объект (не массив) — это
// many-to-one, см. комментарий в answerRowToJs/mappers.js.
const QUESTION_SELECT = `
  *,
  answers:answers(*, author:profiles!author_id(name))
`;

// Этап 3, Группа B: сначала пробуем Supabase (таблица questions с JOIN на
// answers/profiles), при ошибке или пустом ответе — падаем на мок
// (store()) с console.warn.
//
// growerId вопроса без джойна: в форме Question (types.js, data/questions.js)
// нет growerName/author для самого вопроса — только у answers[] (см.
// answerRowToJs). Порядок ответов внутри вопроса — по created_at по
// возрастанию, чтобы совпадать с порядком в моке (сначала более старые
// ответы, как при появлении).
export async function fetchInitialQuestions() {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select(QUESTION_SELECT)
      .order('created_at', { referencedTable: 'answers', ascending: true });
    if (error) {
      console.warn('[questionService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(questionRowToJs));
    } else {
      console.warn('[questionService] Supabase вернул пустой список вопросов, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[questionService] Не удалось получить вопросы из Supabase, использую mock-данные:', e.message);
  }

  try {
    return ok(store().map((q) => ({ ...q, answers: q.answers.map((a) => ({ ...a })) })));
  } catch (e) {
    return fail(e);
  }
}

/** getQuestionById(id) — та же схема fallback'а, что в fetchInitialQuestions. */
export async function getQuestionById(id) {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select(QUESTION_SELECT)
      .eq('id', id)
      .order('created_at', { referencedTable: 'answers', ascending: true })
      .maybeSingle();
    if (error) {
      console.warn(`[questionService] Supabase вернул ошибку при получении вопроса ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(questionRowToJs(data));
    } else {
      console.warn(`[questionService] Supabase не нашёл вопрос ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[questionService] Не удалось получить вопрос ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((q) => q.id === id);
    return found ? ok({ ...found, answers: found.answers.map((a) => ({ ...a })) }) : fail(new Error(`Question ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Этап 3, Группа 2 (write): реальные INSERT/UPDATE без fallback'а на мок.
// createQuestionFromForm / createAnswer ниже остаются как были — их ещё
// использует админка (adminAnswerQuestion, growerId 'admin').
// ---------------------------------------------------------------------------

/**
 * insertQuestion({ growerId, text, photo, stage, topic, diaryId }).
 *
 * .select() без вложений: у только что созданного вопроса ответов нет, а
 * questionRowToJs терпит отсутствие row.answers (`row.answers || []`).
 *
 * photo: base64 в photo_url НЕ отправляется (см. _photo.js) — вопрос без
 * фото создаётся гарантированно; вернувшийся question.photo === null
 * сигнализирует вызывающему, что фото было отброшено.
 */
export async function insertQuestion({ growerId, text, photo, stage, topic, diaryId }) {
  try {
    const { data, error } = await supabase
      .from('questions')
      .insert({
        grower_id: growerId,
        text_content: text,
        photo_url: await photoUrlForDb(photo, 'questionService'),
        stage: stage || null,
        topic: topic || null,
        diary_id: diaryId || null,
        status: 'open'
      })
      .select()
      .single();
    if (error) return fail(error);
    return ok(questionRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertAnswer({ questionId, authorId, text }) -> ok(answer).
 *
 * INSERT в answers (+ имя автора через JOIN на profiles). questions.updated_at
 * клиент НЕ трогает: его поднимает SECURITY DEFINER триггер
 * answers_touch_question (AFTER INSERT на answers, функция
 * touch_question_on_answer(), миграция 0007) — прямой UPDATE questions
 * всё равно не проходил RLS (политика только для владельца вопроса).
 */
export async function insertAnswer({ questionId, authorId, text }) {
  try {
    const { data, error } = await supabase
      .from('answers')
      .insert({ question_id: questionId, author_id: authorId, text_content: text })
      .select('*, author:profiles!author_id(name)')
      .single();
    if (error) return fail(error);
    return ok(answerRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateQuestionStatus(questionId, status) — 'solved' | 'open'.
 *
 * .select('id, status') нужен, чтобы отличить "обновлено" от "RLS молча
 * отфильтровал строку": без него 0 затронутых строк выглядели бы как успех.
 */
export async function updateQuestionStatus(questionId, status) {
  try {
    const { data, error } = await supabase
      .from('questions')
      .update({ status })
      .eq('id', questionId)
      .select('id, status');
    if (error) return fail(error);
    if (!data || data.length === 0) {
      return fail(new Error('Не удалось изменить статус вопроса: вопрос не найден или нет прав (менять статус может только его автор)'));
    }
    return ok(data[0].status);
  } catch (e) {
    return fail(e);
  }
}

/** Builds a brand-new question from the "ask a question" form. */
export async function createQuestionFromForm({ text, photo, diaryId, stage, topic, growerId }) {
  try {
    const now = new Date().toISOString();
    const question = {
      id: 'q_' + Date.now(),
      growerId,
      diaryId: diaryId || null,
      text,
      photo: photo || null,
      stage: stage || null,
      topic: topic || null,
      status: 'open',
      likes: 0,
      liked: false,
      createdAt: now,
      updatedAt: now,
      answers: []
    };
    return ok(question);
  } catch (e) {
    return fail(e);
  }
}

/** Builds a new answer to append to a question's `answers` array. */
export async function createAnswer({ author, text }) {
  try {
    const answer = {
      id: 'qa_' + Date.now(),
      author,
      text,
      createdAt: new Date().toISOString()
    };
    return ok(answer);
  } catch (e) {
    return fail(e);
  }
}
