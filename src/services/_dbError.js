// Общие хелперы для write-сервисов Группы 4A.
//
// toError: PostgrestError в зависимости от версии supabase-js может быть
// обычным объектом, а не Error — тогда fail() из _result.js превратил бы его
// в "[object Object]". Явно вытаскиваем message (та же логика, что в
// reactionsService.js, там она осталась локальной — тот файл не трогаем).
export const PG_UNIQUE_VIOLATION = '23505';

export function toError(error) {
  const err = new Error(error?.message || 'Ошибка запроса к базе данных');
  err.code = error?.code;
  return err;
}
