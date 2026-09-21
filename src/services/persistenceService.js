// Простая обёртка над localStorage для персистентности контента, которым
// управляет админка. Версионируем сохранённый объект (`_v`) — если структура
// сущностей когда-нибудь поменяется несовместимо, старые данные в браузере
// пользователя просто не подхватятся (loadState вернёт null) и приложение
// откатится на сид-данные, а не упадёт с ошибкой парсинга/рендера.

const STORAGE_KEY = 'chilidiaries_state_v1';
const STATE_VERSION = 1;

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed._v !== STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _v: STATE_VERSION }));
    return true;
  } catch {
    // localStorage может быть недоступен (приватный режим Safari, забитая квота
    // и т.п.) — тихо игнорируем, приложение продолжает работать в памяти.
    return false;
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
