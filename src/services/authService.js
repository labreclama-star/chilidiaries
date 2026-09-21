// Аутентификация через Supabase Auth (Этап 4).
//
// Контракты не меняются (async, { data, error } через ok()/fail()) — это
// было сделано заранее на Этапе 3 специально для того, чтобы этот файл
// можно было переписать без единой правки в AppContext.jsx/AuthModal.jsx
// (кроме самой логики login/signup/logout, см. отчёт).
//
// АДМИН-СПЕЦКЕЙС (НЕ трогаем на этом этапе — отдельная задача по ТЗ, п.4):
// логин 'admin' / ADMIN_PASSWORD полностью обходит Supabase Auth, как и
// раньше в моке. Настоящая миграция админа на Supabase Auth (роль в
// profiles.role, проверка через is_admin()) — следующий шаг.
//
// EMAIL vs IDENTIFIER — решение по п.1 ТЗ (Вариант B):
// AuthModal уже собирает email в форме регистрации (поле suEmail), поэтому
// signup всегда идёт по настоящему email, без костылей вида `<name>@local`.
// Для входа поле в форме исторически называлось "Никнейм или e-mail", но
// Supabase Auth не даёт войти по нику без отдельного RPC-резолвера
// username → email, которого пока нет в схеме (в текущих migrations я не
// нашёл такой функции — файл 0004_triggers.sql мне не прислали, см. отчёт).
// Поэтому сейчас login() ожидает в identifier именно email; текст в
// AuthModal.jsx подправлен соответственно (см. отдельный файл).
// Ник для отображения после входа берётся не из identifier, а из
// профиля (profiles.name), который AppContext.jsx подтягивает через
// getGrowerById после успешного signInWithPassword/signUp.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { uploadPhoto } from './_photo.js';

export const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'ChiliAdmin2026';

// Supabase отдаёt технические англоязычные сообщения — переводим самые
// частые на русский для UI; остальное показываем как есть (лучше, чем
// молчание, но менее приятно, чем полный словарь всех кодов ошибок).
function authErrorMessage(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Неверный e-mail или пароль';
  if (/email not confirmed/i.test(msg)) return 'Подтверди e-mail перед входом (проверь почту)';
  if (/user already registered/i.test(msg)) return 'Этот e-mail уже зарегистрирован';
  if (/password should be at least/i.test(msg)) return 'Пароль слишком короткий (минимум 8 символов)';
  return msg || 'Не удалось выполнить операцию';
}

export async function login({ identifier, password }) {
  try {
    const raw = (identifier || '').trim();

    // Сид-админ — как и раньше, полностью мимо Supabase (см. комментарий выше).
    if (raw.toLowerCase() === ADMIN_LOGIN) {
      if (password !== ADMIN_PASSWORD) {
        return fail(new Error('Неверный пароль администратора'));
      }
      return ok({ name: ADMIN_LOGIN, isAdminLogin: true });
    }

    // Обычный юзер: identifier теперь обязан быть email (см. комментарий
    // в начале файла про Вариант B).
    const { data, error } = await supabase.auth.signInWithPassword({
      email: raw,
      password
    });
    if (error) return fail(new Error(authErrorMessage(error)));

    const user = data.user;
    // name из raw_user_meta_data — заполняется при signUp() ниже и читается
    // тем же триггером handle_new_user, что создаёт строку в profiles.
    // Если по какой-то причине его нет (например, юзер создан не через эту
    // форму) — берём часть email до "@", чтобы не показывать undefined.
    const name = user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Гровер');
    return ok({ name, email: user?.email, userId: user?.id, isAdminLogin: false });
  } catch (e) {
    return fail(new Error(authErrorMessage(e)));
  }
}

// Аватар при регистрации. Вызывается ПОСЛЕ успешного signUp, потому что
// загрузка в Storage и UPDATE profiles идут от имени уже созданного
// пользователя (нужен его JWT: политики bucket 'photos' и profiles
// проверяют auth.uid()). Регистрацию НЕ роняет ни при каких ошибках:
// аккаунт уже создан, а фото можно добавить позже в профиле.
//
// Возвращает { avatarUrl, avatarSkipped }:
//  - avatarUrl — публичный URL, который РЕАЛЬНО записан в profiles.avatar_url
//    (иначе null);
//  - avatarSkipped — true, если аватар был передан, но сохранить его не вышло.
async function saveSignupAvatar({ userId, hasSession, avatar }) {
  const skipped = { avatarUrl: null, avatarSkipped: true };
  try {
    // Если в проекте включено подтверждение e-mail, signUp не возвращает
    // сессию — значит, пока пользователь не подтвердил почту, у него нет JWT,
    // и загрузка/UPDATE будут отклонены RLS. Не тратим запросы впустую.
    if (!userId || !hasSession) {
      console.warn('[authService] Аватар не сохранён: после signUp нет сессии (включено подтверждение e-mail?).');
      return skipped;
    }

    // 1) файл / data URL / blob: → Storage → публичный URL (см. _photo.js);
    //    http(s)-ссылка проходит как есть.
    const { url, error: uploadError } = await uploadPhoto(avatar);
    if (uploadError || !url) {
      console.warn('[authService] Аватар не загружен в Storage:', uploadError?.message || 'пустой URL');
      return skipped;
    }

    // 2) записываем URL в профиль. Строку profiles создаёт триггер
    //    handle_new_user внутри той же транзакции, что и запись в auth.users,
    //    поэтому к моменту возврата из signUp она уже есть. .select() нужен,
    //    чтобы отличить успех от "RLS отфильтровал строку" (0 строк, не ошибка).
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (updateError || !data) {
      console.warn('[authService] Аватар загружен, но не записан в profiles:', updateError?.message || 'профиль не найден или нет прав');
      return skipped;
    }

    return { avatarUrl: url, avatarSkipped: false };
  } catch (e) {
    console.warn('[authService] Не удалось сохранить аватар:', e?.message || e);
    return skipped;
  }
}

export async function signup({ name, email, password, avatar }) {
  try {
    const finalName = (name || '').trim() || 'Гровер';
    if (finalName.toLowerCase() === ADMIN_LOGIN) {
      return fail(new Error('Это имя зарезервировано, выбери другое'));
    }

    const { data, error } = await supabase.auth.signUp({
      email: (email || '').trim(),
      password,
      options: {
        // → raw_user_meta_data, оттуда читает handle_new_user при создании
        // строки profiles. avatar сюда НЕ кладём: base64 раздул бы JWT и
        // metadata. Аватар грузится отдельным шагом после signUp (ниже).
        data: { name: finalName }
      }
    });
    if (error) return fail(new Error(authErrorMessage(error)));

    const user = data.user;

    // Аватар — необязательный, поэтому его сбой не должен ронять регистрацию.
    let avatarUrl = null;
    let avatarSkipped = false;
    if (avatar) {
      ({ avatarUrl, avatarSkipped } = await saveSignupAvatar({
        userId: user?.id,
        hasSession: !!data.session,
        avatar
      }));
    }

    return ok({
      name: finalName,
      email: user?.email,
      userId: user?.id,
      isAdminLogin: false,
      avatarUrl,
      avatarSkipped
    });
  } catch (e) {
    return fail(new Error(authErrorMessage(e)));
  }
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return fail(new Error(authErrorMessage(error)));
    return ok(true);
  } catch (e) {
    return fail(new Error(authErrorMessage(e)));
  }
}
