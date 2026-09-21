// Единый формат ответа сервисов: { data, error }.
//
// Почему так, а не throw: supabase-js возвращает именно { data, error } из
// await supabase.from(...).select(...) и т.п. Если моки уже отдают такую же
// форму, на будущем переключении с mock на real меняется только ТЕЛО
// функции внутри services/*.js — сигнатура и форма ответа остаются, и
// вызывающему коду (AppContext.jsx) не нужно знать, мок это или реальный API.
//
// Используется во всех services/*.js кроме persistenceService.js (это
// localStorage-обёртка синхронного слоя, не имеет отношения к будущему API).

export function ok(data) {
  return { data, error: null };
}

export function fail(error) {
  let err;
  if (error instanceof Error) {
    err = error;
  } else if (error && typeof error === 'object' && typeof error.message === 'string') {
    // PostgrestError / AuthError из supabase-js в ряде версий — обычный
    // объект { message, code, details, hint }, а не Error. String(error)
    // дал бы "[object Object]" — именно так в тост попадал "Object".
    err = new Error(error.message);
    if (error.code) err.code = error.code;
    if (error.details) err.details = error.details;
    if (error.hint) err.hint = error.hint;
  } else {
    err = new Error(String(error));
  }
  return { data: null, error: err };
}
