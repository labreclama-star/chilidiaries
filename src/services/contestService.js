import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { contestRowToJs, participantRowToJs } from './supabase/mappers.js';
import { toError, PG_UNIQUE_VIOLATION } from './_dbError.js';
import { photoUrlForDb } from './_photo.js';

// Этап "Задача 3": мок-фолбэк (_store/store() на data/contests.js) убран —
// конкурсы теперь создаются ТОЛЬКО через админку, мок-данных больше нет.
// Пустой список из Supabase — нормальный результат (конкурсов ещё не
// создали), а не повод показывать заглушку из мока.

// Этап 3, Группа C (с правкой): таблица contest_participants
// (contest_id, user_id, joined_at) подтверждена — считаем participants
// через embedded count, как diaries/followers у гровера в Группе A.
//
// Этап "Задача 3": мок-фолбэка больше нет. Ошибка Supabase — это реальная
// ошибка (fail), а не повод тихо подсунуть моковые данные. Пустой массив —
// нормальный результат (конкурсов в БД пока нет), это ok([]), не fail.
export async function fetchInitialContests() {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*, participants_count:contest_participants(count)');
    if (error) return fail(toError(error));
    return ok((data || []).map(contestRowToJs));
  } catch (e) {
    return fail(e);
  }
}

/** getContestById(id) — Этап "Задача 3": только реальный SELECT, без мока. */
export async function getContestById(id) {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*, participants_count:contest_participants(count)')
      .eq('id', id)
      .maybeSingle();
    if (error) return fail(toError(error));
    if (!data) return fail(new Error('Конкурс не найден'));
    return ok(contestRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * fetchMyContestIds(userId) — id конкурсов, в которых юзер участвует (для
 * state joinedContestIds после логина/Cmd+R). Без fallback'а на мок.
 * contest_participants: SELECT публичный, поэтому фильтр по user_id обязателен.
 */
export async function fetchMyContestIds(userId) {
  try {
    const { data, error } = await supabase
      .from('contest_participants')
      .select('contest_id')
      .eq('user_id', userId);
    if (error) return fail(toError(error));
    return ok((data || []).map((r) => r.contest_id));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertContestParticipant({ contestId, userId }) — Этап 5, Группа 4A: INSERT в
 * contest_participants (PK contest_id+user_id; RLS: user_id = auth.uid() или
 * админ). Без fallback'а на мок.
 * Дубликат (23505) — не ошибка: юзер уже участвует (например, из другой
 * вкладки). Отдаём { duplicate: true }, чтобы AppContext не прибавил лишний
 * +1 к счётчику (та же схема, что у лайков в reactionsService).
 */
export async function insertContestParticipant({ contestId, userId }) {
  try {
    const { error } = await supabase
      .from('contest_participants')
      .insert({ contest_id: contestId, user_id: userId });
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return ok({ duplicate: true });
      return fail(toError(error));
    }
    return ok({ duplicate: false });
  } catch (e) {
    return fail(e);
  }
}

/**
 * joinContestWithDiary({ contestId, userId, diaryId }) — участие конкретным
 * дневником (голоса = лайки за период, снимок likes_at_start при привязке).
 * Без fallback'а на мок — как insertContestParticipant.
 *
 * Проверки ПЕРЕД insert (а не только на триггер check_contest_participant_diary
 * в 0013_contest_diary.sql — тот триггер защищает от прямого INSERT мимо
 * сервиса, но отдаёт голый Postgres-exception; здесь — читаемые сообщения):
 *  - дневник существует;
 *  - grower_id дневника === userId (свой);
 *  - дневник не приватный (is_private).
 *
 * likes_at_start берём из diaries.likes_count В МОМЕНТ привязки — тем
 * самым лайки до старта конкурса не считаются в дельте (см. getContestParticipants).
 *
 * Дубликат (23505, PK contest_id+user_id — юзер уже привязан своим
 * дневником) — не ошибка, как и в insertContestParticipant.
 */
export async function joinContestWithDiary({ contestId, userId, diaryId }) {
  try {
    const { data: diary, error: diaryError } = await supabase
      .from('diaries')
      .select('grower_id, likes_count, is_private')
      .eq('id', diaryId)
      .maybeSingle();
    if (diaryError) return fail(toError(diaryError));
    if (!diary) return fail(new Error(`Дневник ${diaryId} не найден`));
    if (diary.grower_id !== userId) {
      return fail(new Error('Можно участвовать в конкурсе только своим дневником'));
    }
    if (diary.is_private) {
      return fail(new Error('Дневник приватный — сделай его публичным, чтобы участвовать в конкурсе'));
    }

    const { error } = await supabase
      .from('contest_participants')
      .insert({
        contest_id: contestId,
        user_id: userId,
        diary_id: diaryId,
        likes_at_start: diary.likes_count ?? 0
      });
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return ok({ duplicate: true });
      return fail(toError(error));
    }
    return ok({ duplicate: false });
  } catch (e) {
    return fail(e);
  }
}

/**
 * getContestParticipants(contestId) — таблица результатов конкурса.
 * JOIN на profiles (имя/аватар) и diaries (заголовок + ЖИВОЙ likes_count,
 * чтобы посчитать дельту без отдельного запроса за каждым лайком).
 *
 * likesDelta = likesNow - likesAtStart — растёт по мере того, как дневник
 * получает лайки уже ПОСЛЕ привязки к конкурсу (лайки до старта не
 * считаются, т.к. попали в снимок likes_at_start).
 *
 * Сортировка (правила конкурса): likesDelta desc, при равенстве — joinedAt
 * asc (кто раньше привязался). Делается на клиенте (в мапере), а не через
 * .order() в запросе — delta - вычисляемое поле, в БД такой колонки нет.
 *
 * Без fallback'а на мок (это read по реальным участникам, у мока таких
 * данных просто нет).
 */
export async function getContestParticipants(contestId) {
  try {
    const { data, error } = await supabase
      .from('contest_participants')
      .select(`
        user_id,
        diary_id,
        likes_at_start,
        joined_at,
        profile:profiles!user_id(name, avatar_url),
        diary:diaries!diary_id(title, likes_count)
      `)
      .eq('contest_id', contestId);
    if (error) return fail(toError(error));

    const participants = (data || [])
      .map(participantRowToJs)
      .sort((a, b) => {
        if (b.likesDelta !== a.likesDelta) return b.likesDelta - a.likesDelta;
        return new Date(a.joinedAt) - new Date(b.joinedAt);
      });
    return ok(participants);
  } catch (e) {
    return fail(e);
  }
}

/**
 * declareContestWinner({ contestId, winnerUserId, winnerDiaryId, place }) —
 * UPSERT в contest_winners. Только для admin — RLS всё равно проверит
 * (is_admin() в политиках INSERT/UPDATE, см. 0013_contest_diary.sql), но
 * если вызвать не-админом, здесь придёт понятная ошибка через toError,
 * а не молчаливый провал.
 *
 * ВАЖНО (ограничение схемы, как задано в Этапе 1): contest_winners.contest_id
 * — PRIMARY KEY, т.е. на конкурс хранится РОВНО ОДНА строка. Повторный вызов
 * declareContestWinner с другим place для того же contestId ПЕРЕЗАПИШЕТ
 * предыдущую запись (upsert по contest_id), а не добавит второе место как
 * отдельную строку. Если нужно хранить топ-3 одновременно — это меняет PK
 * на (contest_id, place) и требует отдельной миграции; сейчас делаю строго
 * по присланной схеме.
 */
export async function declareContestWinner({ contestId, winnerUserId, winnerDiaryId, place }) {
  try {
    const { error } = await supabase
      .from('contest_winners')
      .upsert(
        {
          contest_id: contestId,
          winner_user_id: winnerUserId,
          winner_diary_id: winnerDiaryId,
          place
        },
        { onConflict: 'contest_id' }
      );
    if (error) return fail(toError(error));
    return ok({ contestId, winnerUserId, winnerDiaryId, place });
  } catch (e) {
    return fail(e);
  }
}

/**
 * getContestWinners(contestIds) — bulk-читалка contest_winners для
 * админ-грида (Этап 5, п.4): нужно знать, для каких конкурсов победитель уже
 * объявлен, чтобы показать бейдж вместо кнопки "Объявить победителя". Один
 * запрос на весь список карточек сразу, а не по одному на конкурс.
 * SELECT в contest_winners публичный (см. 0013_contest_diary.sql) — userId
 * не нужен.
 */
export async function getContestWinners(contestIds) {
  try {
    if (!contestIds || contestIds.length === 0) return ok([]);
    const { data, error } = await supabase
      .from('contest_winners')
      .select('contest_id, winner_user_id, winner_diary_id, place')
      .in('contest_id', contestIds);
    if (error) return fail(toError(error));
    return ok((data || []).map((row) => ({
      contestId: row.contest_id,
      winnerUserId: row.winner_user_id,
      winnerDiaryId: row.winner_diary_id,
      place: row.place
    })));
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateContest(id, patch) — partial UPDATE конкурса из админ-формы
 * (AdminContests.handleSubmit). patch приходит в camelCase (как в форме),
 * здесь переводим в snake_case колонок БД. Поле, которого нет в patch,
 * в UPDATE не попадает — partial update, а не полная перезапись строки.
 *
 * photo — реальная загрузка в Storage через photoUrlForDb (как в
 * insertContest выше), а не просто фильтр base64. Партиальность
 * сохраняется: если patch.photo не передан вообще — колонку не трогаем.
 *
 * start_date/deadline — отдельная нормализация: в БД это колонки типа
 * date, а форма шлёт их как обычный <input type="text">. Пустое поле
 * формы даёт '' — Postgres не умеет привести '' к date (ошибка 22007,
 * "invalid input syntax for type date") и отклоняет ВЕСЬ PATCH, включая
 * остальные поля (в т.ч. status). Поэтому '' (и undefined/null) here —
 * это "дата не указана", то есть SQL NULL, а не пустая строка.
 *
 * Возвращаем contestRowToJs(data) (а не сырую snake_case-строку, как
 * было раньше) — AppContext.adminAddContest/adminUpdateContest теперь
 * читают c.photo для сравнения "фото не загрузилось", им нужен camelCase.
 */
export async function updateContest(id, patch) {
  try {
    const row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.desc !== undefined) row.description = patch.desc;
    if (patch.fullDesc !== undefined) row.full_description = patch.fullDesc;
    if (patch.prize !== undefined) row.prize = patch.prize;
    if (patch.startDate !== undefined) row.start_date = patch.startDate === '' ? null : patch.startDate;
    if (patch.deadline !== undefined) row.deadline = patch.deadline === '' ? null : patch.deadline;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.sponsor !== undefined) row.sponsor = patch.sponsor;
    if (patch.rules !== undefined) row.rules = patch.rules;
    if (patch.howToJoin !== undefined) row.how_to_join = patch.howToJoin;
    if (patch.photo !== undefined) row.photo_url = await photoUrlForDb(patch.photo, 'contestService');

    const { data, error } = await supabase
      .from('contests')
      .update(row)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return fail(toError(error));
    return ok(data ? contestRowToJs(data) : null);
  } catch (e) {
    return fail(e);
  }
}

/**
 * fetchAllContestWinners() — Этап 6: глобальный список всех объявленных
 * побед для бейджа "🏅 Победитель конкурса" в AchievementBadges. В отличие
 * от getContestWinners(contestIds) выше (bulk ПО СПИСКУ id для админ-грида),
 * здесь читаем ВСЮ таблицу contest_winners сразу — бейдж рендерится в кучe
 * разных мест (профиль, карточки дневников), и грузить победы отдельно на
 * каждой странице не нужно, один раз в AppContext на старте приложения.
 * SELECT публичный — userId не нужен. Без fallback'а на мок (это реальные
 * данные, у мока их нет).
 */
export async function fetchAllContestWinners() {
  try {
    const { data, error } = await supabase
      .from('contest_winners')
      .select('contest_id, winner_user_id, winner_diary_id, place, announced_at, contest:contests!contest_id(title)');
    if (error) return fail(toError(error));
    return ok((data || []).map((row) => ({
      contestId: row.contest_id,
      contestTitle: row.contest?.title ?? '',
      winnerUserId: row.winner_user_id,
      winnerDiaryId: row.winner_diary_id,
      place: row.place,
      announcedAt: row.announced_at
    })));
  } catch (e) {
    return fail(e);
  }
}

/**
 * removeContestParticipant(contestId, userId) — DELETE из contest_participants
 * (Задача 2: модалка "Участники" в AdminContests.jsx, кнопка "Убрать").
 * PK таблицы — (contest_id, user_id), поэтому .eq() по обоим полям снимает
 * ровно одну строку. RLS на DELETE должна пускать админа (или самого юзера
 * — не наш случай здесь, тут всегда действует админ).
 */
export async function removeContestParticipant(contestId, userId) {
  try {
    const { error } = await supabase
      .from('contest_participants')
      .delete()
      .eq('contest_id', contestId)
      .eq('user_id', userId);
    if (error) return fail(toError(error));
    return ok({ contestId, userId });
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertContest(formData) — реальный INSERT в contests из админ-формы
 * "Создать конкурс" (AdminContests.handleSubmit). Раньше здесь был мок
 * createContestFromForm с id вида 'c_' + Date.now() — не-UUID, который
 * ломал getContestWinners/updateContest 400-ошибкой, как только админ
 * пытался работать с созданным так конкурсом. Без fallback'а на мок —
 * по правилам проекта для новых write-функций.
 *
 * snake_case-поля и '' → null для дат — та же логика, что в updateContest
 * (Postgres не приводит '' к типу date).
 *
 * photo — раньше base64 просто отбрасывался (не раздувать БД), теперь
 * реально грузится в Storage через photoUrlForDb/uploadPhoto (_photo.js),
 * тот же путь, что у insertVariety. Ошибку загрузки не пробрасываем сюда
 * отдельным флагом — photoUrlForDb сама глотает её и пишет null (см. её
 * комментарий); AppContext.adminAddContest определяет "фото не загрузилось"
 * сравнением входа/выхода, как уже сделано для сортов в addVariety.
 *
 * .select().single() — возвращаем ЖИВУЮ строку из БД (с реальным uuid),
 * прогнанную через contestRowToJs — тот же паттерн, что у insertVariety
 * в varietyService.js. participants_count в select не тянем: у только что
 * созданного конкурса участников физически 0, а contestRowToJs и без
 * embedded count отдаёт participants: 0 (там `?? 0`).
 */
export async function insertContest({ title, desc, fullDesc, prize, startDate, deadline, status, photo, sponsor, rules, howToJoin }) {
  try {
    const row = {
      title: title || 'Новый конкурс',
      description: desc || '',
      full_description: fullDesc || desc || '',
      prize: prize || '',
      start_date: startDate === '' || startDate == null ? null : startDate,
      deadline: deadline === '' || deadline == null ? null : deadline,
      status: status || 'upcoming',
      sponsor: sponsor || '',
      rules: rules || [],
      how_to_join: howToJoin || '',
      progress: 0,
      // Реальная загрузка в Storage (bucket 'photos'), как у insertVariety —
      // photoUrlForDb сама разбирается: null/'' → null, http(s)-URL → как
      // есть, base64/File/blob → сжимает и грузит, ошибку глотает и пишет
      // null + console.warn (не роняя весь INSERT). Если photo был передан,
      // а вернувшийся объект.photo окажется falsy — значит, загрузка не
      // удалась; это проверяется в AppContext.adminAddContest сравнением
      // входа/выхода, тем же способом, что уже в addVariety.
      photo_url: await photoUrlForDb(photo, 'contestService')
    };

    const { data, error } = await supabase
      .from('contests')
      .insert(row)
      .select()
      .single();
    if (error) return fail(toError(error));
    return ok(contestRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}
