import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  fetchInitialGrowers, createUserGrower, getGrowerById,
  updateGrowerProfile, setGrowerOnline
} from '../services/growerService.js';
import { fetchInitialVarieties, insertVariety, createVarietyFromAdminForm } from '../services/varietyService.js';
import {
  fetchInitialDiaries, insertDiary, insertWeekReport, updateDiaryStage as updateDiaryStageRequest,
  getDiaryById, insertComment
} from '../services/diaryService.js';
import { fetchInitialRecipes, createRecipeFromForm, insertRecipe, incrementRecipeViewsRpc } from '../services/recipeService.js';
// Этап 5, Группа 4A: голоса за сорта, банк семян, сохранённые рецепты и
// личные данные, подгружаемые после логина.
import { fetchAllVarietyVotes, upsertVarietyVote } from '../services/varietyVoteService.js';
import { insertSeed, deleteSeed, updateSeedStatus } from '../services/seedBankService.js';
import { insertRecipeSave, deleteRecipeSave } from '../services/savedRecipeService.js';
import { fetchMyPersonalData } from '../services/personalDataService.js';
import {
  addLike, removeLike,
  addFollow, removeFollow,
  addDiarySubscription, removeDiarySubscription,
  fetchMyReactions, LIKE_TYPES
} from '../services/reactionsService.js';
import { fetchInitialPosts, createPostFromForm, insertBlogPost, incrementBlogViewsRpc } from '../services/blogService.js';
import { fetchInitialContests, createContestFromForm, insertContestParticipant } from '../services/contestService.js';
import { fetchInitialQuestions, createAnswer, insertQuestion, insertAnswer, updateQuestionStatus } from '../services/questionService.js';
import { fetchInitialLights, createLightFromForm } from '../services/lightService.js';
import { fetchInitialNutrients, createNutrientFromForm } from '../services/nutrientService.js';
import { login as loginRequest, signup as signupRequest, logout as logoutRequest } from '../services/authService.js';
import { loadState, saveState, clearState } from '../services/persistenceService.js';
// Этап 4: нужен прямой доступ к клиенту для getSession()/onAuthStateChange —
// сами login/signup/logout остаются за authService.js, здесь только
// восстановление сессии при перезагрузке страницы.
import { supabase } from '../services/supabase/client.js';

const AppContext = createContext(null);

let toastIdCounter = 1;

// Точечно правит liked/likes у одного элемента коллекции (diaries/recipes/
// questions). Чистая функция от setter'а — безопасно вызывать повторно
// для оптимистичного обновления и отката.
function patchLike(setCollection, id, liked, delta) {
  setCollection((prev) => prev.map((x) => (
    x.id === id ? { ...x, liked, likes: Math.max(0, x.likes + delta) } : x
  )));
}

// Сбрасывает сессионный флаг (liked / _followed) у всех элементов, но не
// создаёт новый массив, если сбрасывать нечего (лишний ререндер не нужен).
function withoutFlag(list, flag) {
  return list.some((x) => x[flag]) ? list.map((x) => (x[flag] ? { ...x, [flag]: false } : x)) : list;
}

const DEFAULT_SETTINGS = {
  siteName: 'ChiliDiaries',
  siteDescription: 'Социальная платформа для гроверов острого перца.',
  contactEmail: '',
  telegram: '',
  instagram: '',
  bannerEnabled: false,
  bannerText: '',
  bannerPhoto: null,
  heroPhoto: null,
  registrationEnabled: true,
  showQuestions: true,
  showFeed: true
};

export function AppProvider({ children }) {
  // ---- core collections (mock data today, swappable for real fetches later) ----
  const [growers, setGrowers] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [contests, setContests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [lights, setLights] = useState([]);
  const [nutrients, setNutrients] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // Готовность auth-состояния (первичное восстановление сессии обработано
  // через onAuthStateChange/INITIAL_SESSION) — см. эффект ниже. Пока false,
  // combined "loading" в value ниже держит экран в состоянии загрузки, чтобы
  // UI не успел отрендерить "Войти" раньше, чем мы узнали реальный статус
  // сессии (баг: после 5+ минут простоя getSession() мог опередить тихий
  // refresh токена).
  const [authReady, setAuthReady] = useState(false);
  // Этап 4: сервисы теперь возвращают {data, error} — если initial load
  // когда-нибудь реально сломается (реальный Supabase недоступен и т.п.),
  // здесь будет причина вместо тихого "пустое приложение без объяснений".
  const [initError, setInitError] = useState(null);

  // ---- session / ui state ----
  const [currentUser, setCurrentUser] = useState(null); // { name, growerId }
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [joinedContestIds, setJoinedContestIds] = useState([]);
  const [subscribedDiaryIds, setSubscribedDiaryIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [savedRecipeIds, setSavedRecipeIds] = useState([]);
  const [seedBank, setSeedBank] = useState([]);
  const [varietyVotes, setVarietyVotes] = useState([]); // { varietyId, userId, overall, capsaicin, aroma, ts }

  // ---- modal orchestration (mirrors the old single-overlay-per-id pattern) ----
  const [activeModal, setActiveModal] = useState(null); // e.g. 'auth' | 'wizard' | 'addVariety' | 'addRecipe' | 'writeArticle' | 'moreSheet'
  const [modalPayload, setModalPayload] = useState(null);

  // ---- "start diary" wizard state (lives here, not in the component, so it
  //      survives the "add your own variety" side-trip started from step 1) ----
  const emptyWizard = () => ({
    step: 1,
    title: '',
    varietyIds: [],
    medium: 'Почва',
    location: 'Дома',
    date: '',
    note: '',
    photo: null,
    reportInterval: 'weekly',
    stage: 'Рассада'
  });
  const [wizard, setWizard] = useState(emptyWizard);

  // ---- toasts ----
  const [toasts, setToasts] = useState([]);

  const initialised = useRef(false);

  // ---- initial load: доменные сущности больше НЕ читаем из localStorage —
  //      единственный источник теперь Supabase (Шаг A). persistenceService
  //      остаётся, но только для чисто UI-настроек (theme, sidebarCollapsed) —
  //      их восстанавливаем здесь. Старый ключ мог содержать ВСЕ сущности
  //      прежнего формата (growers/varieties/diaries/recipes/... с мок-id
  //      вроде "v3") — это и вызывало баг с variety_id "v3" вместо настоящего
  //      UUID. Раз persisted-объект есть — забираем из него только UI-поля и
  //      чистим ключ целиком; persist-эффект ниже пересохранит его уже в
  //      новом, урезанном виде.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    (async () => {
      const persisted = loadState();
      if (persisted) {
        if (typeof persisted.theme === 'string') setTheme(persisted.theme);
        if (typeof persisted.sidebarCollapsed === 'boolean') setSidebarCollapsed(persisted.sidebarCollapsed);
        clearState();
      }

      // Этап 3/4: fetchInitial* теперь возвращают {data, error} вместо
      // "голого" массива — распаковываем здесь и только здесь, остальной
      // компонент продолжает работать с обычными массивами, как раньше.
      const growersRes = await fetchInitialGrowers();
      if (growersRes.error) {
        setInitError(growersRes.error);
        setLoading(false);
        return;
      }
      const g = growersRes.data;
      const [vRes, dRes, rRes, pRes, cRes, qRes, ltRes, ntRes, votesRes] = await Promise.all([
        fetchInitialVarieties(),
        fetchInitialDiaries(g),
        fetchInitialRecipes(),
        fetchInitialPosts(),
        fetchInitialContests(),
        fetchInitialQuestions(),
        fetchInitialLights(),
        fetchInitialNutrients(),
        // Голоса ВСЕХ юзеров (SELECT публичный): из них computeVarietyRatings
        // считает агрегат для карточек сортов, в т.ч. у гостей. votesRes НЕ
        // входит в firstError ниже — без голосов каталог живёт на стартовых
        // рейтингах сортов, это не повод показывать экран ошибки.
        fetchAllVarietyVotes()
      ]);
      const firstError = [vRes, dRes, rRes, pRes, cRes, qRes, ltRes, ntRes].find((r) => r.error)?.error;
      if (firstError) {
        setInitError(firstError);
        setLoading(false);
        return;
      }
      setGrowers(g);
      setVarieties(vRes.data);
      setDiaries(dRes.data);
      setRecipes(rRes.data);
      setBlogPosts(pRes.data);
      setContests(cRes.data);
      setQuestions(qRes.data);
      setLights(ltRes.data);
      setNutrients(ntRes.data);
      if (votesRes.error) {
        console.warn('[varietyVotes] Не удалось загрузить голоса за сорта:', votesRes.error.message);
      } else {
        setVarietyVotes(votesRes.data);
      }
      setLoading(false);
    })();
  }, []);

  // ---- persist to localStorage: ТОЛЬКО UI-настройки (theme, sidebarCollapsed).
  //      Доменные сущности (growers/varieties/diaries/recipes/blogPosts/
  //      contests/questions/lights/nutrients) отсюда убраны (Шаг A) — их
  //      источник правды теперь исключительно Supabase, localStorage больше
  //      не может подменить свежие серверные данные устаревшим мок-кэшем. ----
  useEffect(() => {
    saveState({ theme, sidebarCollapsed });
  }, [theme, sidebarCollapsed]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // ---- toasts ----
  const showToast = useCallback((message, type) => {
    const id = toastIdCounter++;
    setToasts((prev) => [...prev, { id, message, type: type || null }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // ---- modal helpers ----
  const openModal = useCallback((name, payload) => {
    setActiveModal(name);
    setModalPayload(payload || null);
  }, []);
  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalPayload(null);
  }, []);

  /** Every "Начать дневник" button (header, sidebar, hero, FAB) calls this — always a fresh start. */
  const openWizard = useCallback(() => {
    setWizard(emptyWizard());
    setActiveModal('wizard');
    setModalPayload(null);
  }, []);

  const updateWizard = useCallback((patch) => {
    setWizard((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleWizardVariety = useCallback((id) => {
    setWizard((prev) => {
      const has = prev.varietyIds.includes(id);
      return { ...prev, varietyIds: has ? prev.varietyIds.filter((x) => x !== id) : [...prev.varietyIds, id] };
    });
  }, []);

  /** Opens the "add your own variety" modal from within the wizard, without losing wizard progress. */
  const openAddVarietyFromWizard = useCallback(() => {
    openModal('addVariety', { returnTo: 'wizard' });
  }, [openModal]);

  // ---- reactions: лайки / подписки (реальный Supabase, БЕЗ мок-fallback) ----
  // pendingReactionsRef — ключи запросов, которые сейчас в полёте. Защита от
  // двойного клика: второй клик по той же кнопке, пока первый запрос не
  // завершился, игнорируется (иначе можно получить INSERT+INSERT → 23505
  // или рассинхрон оптимистичного счётчика).
  const pendingReactionsRef = useRef(new Set());

  // Восстановление "моих" лайков/подписок. Мапперы read-сервисов всегда
  // отдают liked: false (в БД такого флага нет), поэтому после загрузки
  // данных И после появления currentUser отдельным запросом берём строки
  // likes/follows/diary_subscriptions текущего юзера и накладываем на state.
  // Ждём `loading === false`, чтобы коллекции гарантированно были на месте.
  // Логаут (currentUser === null) — сбрасываем личные флаги.
  useEffect(() => {
    if (loading) return;
    const uid = currentUser?.growerId;

    if (!uid) {
      setDiaries((prev) => withoutFlag(prev, 'liked'));
      setRecipes((prev) => withoutFlag(prev, 'liked'));
      setQuestions((prev) => withoutFlag(prev, 'liked'));
      setBlogPosts((prev) => withoutFlag(prev, 'liked'));
      setGrowers((prev) => withoutFlag(prev, '_followed'));
      setSubscribedDiaryIds((prev) => (prev.length ? [] : prev));
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await fetchMyReactions(uid);
      if (cancelled) return;
      if (error) {
        console.warn('[reactions] Не удалось загрузить мои лайки/подписки:', error.message);
        return;
      }
      const likedDiaries = new Set(data.likedIds.diary);
      const likedRecipes = new Set(data.likedIds.recipe);
      const likedQuestions = new Set(data.likedIds.question);
      const likedBlogPosts = new Set(data.likedIds.blog_post);
      const followed = new Set(data.followedIds);
      setDiaries((prev) => prev.map((d) => ({ ...d, liked: likedDiaries.has(d.id) })));
      setRecipes((prev) => prev.map((r) => ({ ...r, liked: likedRecipes.has(r.id) })));
      setQuestions((prev) => prev.map((q) => ({ ...q, liked: likedQuestions.has(q.id) })));
      setBlogPosts((prev) => prev.map((p) => ({ ...p, liked: likedBlogPosts.has(p.id) })));
      setGrowers((prev) => prev.map((g) => ({ ...g, _followed: followed.has(g.id) })));
      setSubscribedDiaryIds(data.subscribedDiaryIds);
    })();
    return () => { cancelled = true; };
  }, [loading, currentUser?.growerId]);

  // Личные данные Группы 4A: банк семян, сохранённые рецепты, конкурсы, в
  // которых я участвую. Без этого после Cmd+R эти state'ы были бы пусты,
  // хотя строки в БД есть. Голоса за сорта здесь не грузим: все голоса (и
  // мои тоже) уже пришли в начальной загрузке. Логаут — сбрасываем личное.
  // fetchMyPersonalData отдаёт null для части, которая не загрузилась, — её
  // state не трогаем.
  useEffect(() => {
    const uid = currentUser?.growerId;
    if (!uid) {
      setSeedBank((prev) => (prev.length ? [] : prev));
      setSavedRecipeIds((prev) => (prev.length ? [] : prev));
      setJoinedContestIds((prev) => (prev.length ? [] : prev));
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await fetchMyPersonalData(uid);
      if (cancelled) return;
      if (error) {
        console.warn('[personalData] Не удалось загрузить личные данные:', error.message);
        return;
      }
      if (data.seedBank) setSeedBank(data.seedBank);
      if (data.savedRecipeIds) setSavedRecipeIds(data.savedRecipeIds);
      if (data.joinedContestIds) setJoinedContestIds(data.joinedContestIds);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.growerId]);

  // Общая логика лайка для diary/recipe/question: оптимистичное обновление
  // state → INSERT/DELETE в likes → откат + toast(error.message) при ошибке.
  // likes_count в БД двигает триггер apply_like_delta, вручную не трогаем.
  const toggleLikeEntity = useCallback(async ({ entityType, id, currentlyLiked, setCollection }) => {
    if (!currentUser) {
      showToast('Войди, чтобы ставить лайки');
      openModal('auth');
      return;
    }
    const key = `like:${entityType}:${id}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);

    const nextLiked = !currentlyLiked;
    patchLike(setCollection, id, nextLiked, nextLiked ? 1 : -1);

    const request = nextLiked ? addLike : removeLike;
    const { data, error } = await request({ userId: currentUser.growerId, entityType, entityId: id });
    pendingReactionsRef.current.delete(key);

    if (error) {
      patchLike(setCollection, id, currentlyLiked, nextLiked ? -1 : 1);
      showToast(error.message || 'Не удалось обновить лайк');
      return;
    }
    // Строка уже была в БД (лайк из другой вкладки): триггер не сработал,
    // поэтому оптимистичный +1 отменяем, а liked остаётся true.
    if (data?.duplicate) patchLike(setCollection, id, true, -1);
  }, [currentUser, showToast, openModal]);

  // ---- grower helpers ----
  const findGrowerById = useCallback((id) => growers.find((g) => g.id === id), [growers]);

  // Роль лежит на объекте гровера (не на currentUser), поэтому считаем isAdmin так.
  const isAdmin = !!(currentUser && growers.find((g) => g.id === currentUser.growerId)?.role === 'admin');

  const ensureUserGrower = useCallback(async (name, avatar) => {
    let g = growers.find((x) => x.id === 'u_' + name);
    if (!g) {
      const { data, error } = await createUserGrower(name, avatar);
      if (error) {
        showToast(error.message || 'Не удалось создать профиль гровера');
        return null;
      }
      g = data;
      setGrowers((prev) => [g, ...prev]);
    }
    return g;
  }, [growers, showToast]);

  // Подписка/отписка: INSERT/DELETE в follows. Счётчик followers в БД не
  // хранится (считается embed'ом при чтении), поэтому здесь только
  // оптимистичный ±1 в state. "Нельзя на себя" — и в UI, и CHECK в БД.
  const toggleFollowGrower = useCallback(async (growerId) => {
    if (currentUser && currentUser.growerId === growerId) {
      showToast('Нельзя подписаться на самого себя');
      return;
    }
    if (!currentUser) {
      showToast('Войди, чтобы подписываться на гроверов');
      openModal('auth');
      return;
    }
    const target = growers.find((g) => g.id === growerId);
    if (!target) return;

    const key = `follow:${growerId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);

    const wasFollowed = !!target._followed;
    const patch = (followed, delta) => setGrowers((prev) => prev.map((g) => (
      g.id === growerId ? { ...g, _followed: followed, followers: Math.max(0, g.followers + delta) } : g
    )));
    patch(!wasFollowed, wasFollowed ? -1 : 1);

    const request = wasFollowed ? removeFollow : addFollow;
    const { data, error } = await request({ followerId: currentUser.growerId, followedId: growerId });
    pendingReactionsRef.current.delete(key);

    if (error) {
      patch(wasFollowed, wasFollowed ? 1 : -1);
      showToast(error.message || 'Не удалось обновить подписку');
      return;
    }
    if (data?.duplicate) patch(true, -1);
  }, [currentUser, growers, showToast, openModal]);

  // ---- auth ----
  // Хелпер: положить профиль (из Supabase или из мок-фолбэка) в growers +
  // выставить online:true, не задумываясь, был ли он там раньше — общий
  // паттерн для login/signup/восстановления сессии.
  const upsertOnlineGrower = useCallback((grower) => {
    setGrowers((prev) => {
      const exists = prev.some((x) => x.id === grower.id);
      const withOnline = { ...grower, online: true };
      return exists ? prev.map((x) => (x.id === grower.id ? withOnline : x)) : [withOnline, ...prev];
    });
  }, []);

  const login = useCallback(async (identifier, password) => {
    // Этап 4: authService теперь возвращает {data, error} вместо throw
    // (см. Этап 3) — распаковываем здесь вместо try/catch.
    const { data: user, error } = await loginRequest({ identifier, password });
    if (error) {
      showToast(error.message || 'Не удалось войти');
      return null;
    }

    // Сид-админ логинится в фиксированного гровера id:'admin' (см. data/growers.js) —
    // мимо Supabase/profiles полностью, как и раньше.
    if (user.isAdminLogin) {
      const g = growers.find((x) => x.id === 'admin');
      if (!g) {
        showToast('Не удалось войти');
        return null;
      }
      if (g.banned) {
        showToast('Аккаунт заблокирован');
        return null;
      }
      upsertOnlineGrower(g);
      setCurrentUser({ name: user.name, growerId: g.id });
      showToast(`С возвращением, ${user.name}!`, 'success');
      return g;
    }

    // Обычный юзер: profiles.id === auth.users.id, тащим настоящий профиль
    // через growerService (уже на Supabase, см. Этап 3, Группа A).
    const { data: g, error: profileError } = await getGrowerById(user.userId);
    if (profileError || !g) {
      showToast('Не удалось загрузить профиль');
      return null;
    }
    if (g.banned) {
      showToast('Аккаунт заблокирован');
      return null;
    }
    upsertOnlineGrower(g);
    setCurrentUser({ name: g.name, growerId: g.id });
    showToast(`С возвращением, ${g.name}!`, 'success');
    return g;
  }, [growers, showToast, upsertOnlineGrower]);

  // avatar (File или base64 data-URL из AuthModal.jsx, 4-й аргумент) уходит
  // в authService.signup(). Сам base64 в БД/JWT не попадает: authService
  // грузит файл в Supabase Storage (bucket 'photos', см. services/_photo.js)
  // и записывает в profiles.avatar_url только короткую публичную ссылку.
  // Если загрузка не удалась — регистрация НЕ падает, аккаунт создаётся без
  // фото (authService вернёт avatarSkipped: true, ниже покажем тост).
  const signup = useCallback(async (name, email, password, avatar) => {
    if (!settings.registrationEnabled) {
      showToast('Регистрация временно отключена администратором');
      return null;
    }
    const { data: user, error } = await signupRequest({ name, email, password, avatar });
    if (error) {
      showToast(error.message || 'Не удалось зарегистрироваться');
      return null;
    }

    // profiles-запись создаёт триггер handle_new_user (0004_triggers.sql) —
    // обычно к этому моменту он уже сработал, но триггер выполняется в
    // отдельной транзакции на стороне БД, так что делаем несколько попыток
    // с небольшой паузой перед тем, как считать это ошибкой.
    let g = null;
    for (let attempt = 0; attempt < 3 && !g; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400));
      const { data: profile } = await getGrowerById(user.userId);
      if (profile) g = profile;
    }

    if (!g) {
      // Профиль не нашёлся (триггер не успел / что-то не так со схемой) —
      // не блокируем регистрацию пользователя, который уже создан в
      // auth.users, но честно предупреждаем, что это временная заглушка.
      showToast('Аккаунт создан, но профиль пока не синхронизирован — обнови страницу через минуту', 'error');
      // Передаём только уже загруженный публичный URL (не base64/File) —
      // если аватар не загрузился, avatarUrl === null и запись без фото.
      g = await ensureUserGrower(user.name, user.avatarUrl);
      if (!g) return null;
    }

    upsertOnlineGrower(g);
    setCurrentUser({ name: g.name, growerId: g.id });
    if (user.avatarSkipped) {
      showToast('Аккаунт создан, но фото загрузить не удалось — добавишь его позже в профиле.');
    } else {
      showToast('Аккаунт создан! Теперь заведём твой первый дневник.', 'success');
    }
    return g;
  }, [ensureUserGrower, showToast, settings.registrationEnabled, upsertOnlineGrower]);

  const logout = useCallback(async () => {
    const { error } = await logoutRequest();
    if (error) {
      showToast(error.message || 'Не удалось выйти');
      return;
    }
    setGrowers((prev) => prev.map((x) => (x.id === currentUser?.growerId ? { ...x, online: false } : x)));
    setCurrentUser(null);
  }, [currentUser, showToast]);

  // currentUserRef — актуальное значение currentUser для использования
  // внутри стабильного (подписанного один раз, deps не включают currentUser)
  // колбэка onAuthStateChange ниже. Обычное замыкание держало бы значение
  // currentUser на момент подписки (null) и никогда не увидело бы, что юзер
  // уже восстановлен/вошёл, — отсюда и дублирующие фетчи профиля.
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Общая логика восстановления currentUser из Supabase-сессии — используется
  // для INITIAL_SESSION, SIGNED_IN и TOKEN_REFRESHED (см. эффект ниже).
  // Если currentUser уже соответствует session.user.id — ничего не делаем
  // (например, login()/signup() уже выставили currentUser сами, и вскоре
  // после этого прилетит SIGNED_IN от того же входа — дублировать
  // getGrowerById не нужно).
  const restoreUserFromSession = useCallback(async (session) => {
    if (!session?.user) return;
    if (currentUserRef.current?.growerId === session.user.id) return;
    const { data: g } = await getGrowerById(session.user.id);
    if (!g) return;
    upsertOnlineGrower(g);
    setCurrentUser({ name: g.name, growerId: g.id });
  }, [upsertOnlineGrower]);

  // Подписка на смену сессии: истёк токен, вышли/зашли в другой вкладке,
  // и — что чинит текущий баг — начальная гидратация при открытии страницы.
  //
  // Раньше initial-восстановление делал отдельный ручной вызов
  // supabase.auth.getSession() (после того как основной loading становился
  // false). После 5+ минут простоя это создавало race: access-токен уже
  // протух, и getSession() мог вернуть сессию ДО того, как клиент Supabase
  // успел тихо обновить токен в фоне — currentUser оставался пустым до
  // следующего Cmd+R (к которому обновлённый токен уже лежал в localStorage).
  //
  // INITIAL_SESSION из onAuthStateChange диспатчится ровно один раз и ровно
  // после того, как клиент полностью закончил инициализацию (включая silent
  // refresh протухшего токена) — это официально рекомендованная замена
  // прямому getSession() для гидратации при загрузке страницы.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'INITIAL_SESSION':
          // Сессии может и не быть (анонимный посетитель) — currentUser
          // просто останется null, но authReady всё равно должен выставиться,
          // иначе loading (см. value ниже) никогда не отпустит экран.
          restoreUserFromSession(session).finally(() => setAuthReady(true));
          break;
        case 'SIGNED_IN':
          restoreUserFromSession(session);
          break;
        case 'TOKEN_REFRESHED':
          // Если session.user.id совпадает с currentUser — ничего не делаем
          // (restoreUserFromSession и так это проверяет), обрабатываем
          // отдельно только случай "currentUser пуст, а сессия есть" —
          // например токен обновился в фоне другой вкладкой, пока эта была
          // залогинена как гость.
          if (session?.user && !currentUserRef.current) {
            restoreUserFromSession(session);
          }
          break;
        case 'SIGNED_OUT':
          setCurrentUser((prev) => {
            if (prev) {
              setGrowers((gs) => gs.map((x) => (x.id === prev.growerId ? { ...x, online: false } : x)));
            }
            return null;
          });
          break;
        default:
          break;
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [restoreUserFromSession]);

  // growersRef — актуальный growers для отката внутри стабильных колбэков.
  // setOnlineStatus не должен менять identity при каждом изменении growers
  // (его могут вызывать из эффектов), поэтому читаем через ref.
  const growersRef = useRef(growers);
  useEffect(() => {
    growersRef.current = growers;
  }, [growers]);

  /**
   * Toggle the "online" indicator for the logged-in user on/off.
   * Этап 5: UPDATE profiles SET online. Тихий — без тостов: оптимистично
   * меняем state, при ошибке откатываем и пишем только console.warn.
   */
  const setOnlineStatus = useCallback(async (online) => {
    const uid = currentUserRef.current?.growerId;
    if (!uid) return;
    const next = !!online;
    const prevOnline = !!growersRef.current.find((g) => g.id === uid)?.online;
    const patch = (value) => setGrowers((prev) => prev.map((g) => (g.id === uid ? { ...g, online: value } : g)));
    patch(next);
    const { error } = await setGrowerOnline(uid, next);
    if (error) {
      console.warn('[online] Не удалось сохранить онлайн-статус:', error.message);
      patch(prevOnline);
    }
  }, []);

  /**
   * Edits the logged-in user's public profile (name/bio/loc/avatar all live on the grower record).
   * Этап 5: UPDATE profiles (только name/bio/loc/avatar_url, см. growerService).
   * State обновляем значениями, которые реально сохранились в БД. Метод стал
   * асинхронным: вызывающий код не обязан ждать — итог виден по тосту.
   */
  const updateProfile = useCallback(async (patch) => {
    if (!currentUser) return null;
    const key = 'profile:update';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      const uid = currentUser.growerId;
      const { data, error } = await updateGrowerProfile(uid, patch);
      if (error) {
        showToast(error.message || 'Не удалось обновить профиль');
        return null;
      }
      const { profile, avatarSkipped } = data;
      if (profile) {
        setGrowers((prev) => prev.map((g) => (g.id === uid ? { ...g, ...profile } : g)));
        if (profile.name !== currentUser.name) {
          setCurrentUser((prev) => (prev ? { ...prev, name: profile.name } : prev));
        }
      }
      if (avatarSkipped) {
        // Загрузка фото поддерживается (Supabase Storage). avatarSkipped здесь
        // значит, что конкретный файл не загрузился (>5 МБ, не изображение,
        // сеть) — прежний аватар в БД при этом не тронут.
        showToast('Профиль обновлён, но новое фото не загрузилось — попробуй другой файл (до 5 МБ)');
      } else {
        showToast('Профиль обновлён', 'success');
      }
      return profile;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast]);

  // ---- varieties ----
  // Этап 5: INSERT в varieties (user_added = true, added_by = мой uuid).
  // Фото грузится в Storage внутри insertVariety (см. services/_photo.js).
  // Если фото было передано, а photo_url вернулся null — загрузка не удалась
  // (файл > 5 МБ, сеть и т.п.); сорт при этом сохраняется, предупреждаем тостом.
  const addVariety = useCallback(async (formData, opts) => {
    if (!currentUser) {
      showToast('Войди, чтобы добавить сорт');
      return null;
    }
    const key = 'variety:new';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      const { data: v, error } = await insertVariety({ ...formData, addedById: currentUser.growerId });
      if (error) {
        showToast(error.message || 'Не удалось добавить сорт');
        return null;
      }
      setVarieties((prev) => [v, ...prev]);
      const photoDropped = !!formData.photo && !v.photo;
      showToast(
        photoDropped
          ? `Сорт «${v.name}» добавлен без фото. Фото не загрузилось — попробуй файл поменьше (до 5 МБ)`
          : `Сорт «${v.name}» добавлен в каталог!`,
        'success'
      );
      if (opts && opts.returnToWizard) {
        setWizard((prev) => (prev.varietyIds.includes(v.id) ? prev : { ...prev, varietyIds: [...prev.varietyIds, v.id] }));
        setActiveModal('wizard');
        setModalPayload(null);
      }
      return v;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast]);

  /**
   * Голосование за сорт по трём шкалам (общий рейтинг, капсаицин, аромат).
   * Этап 5: один голос на юзера на сорт — upsert в variety_votes (PK
   * variety_id+user_id). Формулу агрегата не трогаем: computeVarietyRatings
   * (utils/varietyRatings.js) считает её из state varietyVotes, а мы после
   * успеха кладём туда сохранённый голос (заменяя мой прежний). values —
   * { overall, capsaicin, aroma }; `rating` принимается как синоним overall.
   */
  const voteVariety = useCallback(async (varietyId, values) => {
    if (!currentUser) {
      showToast('Войди, чтобы оценить сорт');
      openModal('auth');
      return;
    }
    const key = `vote:${varietyId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      const { data: vote, error } = await upsertVarietyVote({
        varietyId,
        userId: currentUser.growerId,
        overall: values?.overall ?? values?.rating,
        capsaicin: values?.capsaicin,
        aroma: values?.aroma
      });
      if (error) {
        showToast(error.message || 'Не удалось сохранить оценку');
        return;
      }
      setVarietyVotes((prev) => {
        const idx = prev.findIndex((v) => v.varietyId === vote.varietyId && v.userId === vote.userId);
        if (idx === -1) return [...prev, vote];
        const next = prev.slice();
        next[idx] = vote;
        return next;
      });
      showToast('Спасибо за оценку!', 'success');
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast, openModal]);

  // ---- diaries ----
  const toggleLikeDiary = useCallback((diaryId) => {
    const diary = diaries.find((d) => d.id === diaryId);
    if (!diary) return;
    return toggleLikeEntity({ entityType: LIKE_TYPES.DIARY, id: diaryId, currentlyLiked: !!diary.liked, setCollection: setDiaries });
  }, [diaries, toggleLikeEntity]);

  // Список дневников — "облегчённый" (weeks/comments — заглушки для DiaryCard,
  // diary._partial === true, см. diaryListRowToJs). Странице дневника нужны
  // настоящие отчёты/фото/комментарии — этот метод подтягивает полный
  // дневник через getDiaryById и подменяет им запись в state. liked/likes
  // берём из state (там уже наложены "мои лайки" и оптимистичные правки),
  // а не из свежей строки. Дневник, которого нет в списке (например,
  // приватный по прямой ссылке), в state НЕ добавляем — иначе он утёк бы в
  // каталог; такой случай вернёт полный объект, но не сохранит его.
  const loadFullDiary = useCallback(async (diaryId) => {
    const { data, error } = await getDiaryById(diaryId);
    if (error || !data) {
      showToast(error?.message || 'Не удалось загрузить дневник');
      return null;
    }
    setDiaries((prev) => prev.map((d) => (
      d.id === diaryId ? { ...data, liked: d.liked, likes: d.likes, _partial: false } : d
    )));
    return data;
  }, [showToast]);

  const createDiary = useCallback(async (wizardData) => {
    if (!currentUser) return null;
    // Теперь это реальный INSERT — защита от двойного клика по «Создать дневник»,
    // иначе в БД появятся два дневника.
    const key = 'create-diary';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      // grower_id в БД берётся из auth.uid() внутри RPC (см. миграцию 0008),
      // поэтому growerId в сервис больше не передаём.
      const { data: diary, error } = await insertDiary(wizardData);
      if (error) {
        showToast(error.message || 'Не удалось создать дневник');
        return null;
      }
      setDiaries((prev) => [diary, ...prev]);
      setGrowers((prev) => prev.map((g) => (g.id === currentUser.growerId ? { ...g, diaries: g.diaries + 1 } : g)));
      showToast(`Дневник «${diary.title}» создан!`, 'success');
      return diary;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast]);

  const addWeekReport = useCallback(async (diaryId, reportData) => {
    const key = `report:${diaryId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      const target = diaries.find((d) => d.id === diaryId);
      const diaryTitle = target ? target.title : 'дневник';
      const { data: week, error, warning } = await insertWeekReport({
        ...reportData,
        diaryId,
        weekNumber: (target?.weeks.length || 0) + 1
      });
      if (error) {
        showToast(error.message || 'Не удалось опубликовать отчёт');
        return;
      }
      setDiaries((prev) => prev.map((d) => (d.id === diaryId ? { ...d, weeks: [...d.weeks, week] } : d)));
      // warning — отчёт сохранён, но фото прикрепить не удалось (см. insertWeekReport)
      if (warning) showToast(warning);
      else showToast('Отчёт опубликован!', 'success');
      if (subscribedDiaryIds.includes(diaryId)) {
        setNotifications((prev) => [
          { id: 'n_' + Date.now(), diaryId, message: `Новый отчёт в дневнике «${diaryTitle}»`, read: false, createdAt: new Date().toISOString() },
          ...prev
        ]);
      }
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [showToast, diaries, subscribedDiaryIds]);

  /**
   * Owner-only: moves a diary to a new growth stage. Reaching "Собран урожай"
   * ("harvest collected") is treated as closing out the season — it's what
   * unlocks the "Закрытие сезона" achievement badge (see growerBadges).
   */
  const updateDiaryStage = useCallback(async (diaryId, stage) => {
    if (!currentUser) {
      showToast('Войди, чтобы изменить стадию дневника');
      return;
    }
    const key = `stage:${diaryId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      // UPDATE проходит только у владельца (RLS); при отказе сервис вернёт error.
      // Состояние обновляем ПОСЛЕ ответа БД, чтобы не показать "сезон закрыт" зря.
      const { data: savedStage, error } = await updateDiaryStageRequest(diaryId, stage);
      if (error) {
        showToast(error.message || 'Не удалось обновить стадию дневника');
        return;
      }
      setDiaries((prev) => prev.map((d) => (d.id === diaryId ? { ...d, stage: savedStage } : d)));
      if (savedStage === 'Собран урожай') {
        showToast('Сезон закрыт! 🎖️ Получен бейдж «Закрытие сезона»', 'success');
      } else {
        showToast('Стадия дневника обновлена', 'success');
      }
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast]);

  // ---- diary subscriptions + notifications ----
  // Подписка на обновления дневника: INSERT/DELETE в diary_subscriptions.
  // Toast об успехе — только после ответа БД (чтобы не показать "подписан",
  // а следом "ошибка"); state обновляется оптимистично.
  const toggleDiarySubscription = useCallback(async (diaryId, diaryTitle) => {
    if (!currentUser) {
      showToast('Войди, чтобы подписаться на обновления дневника');
      openModal('auth');
      return;
    }
    const key = `sub:${diaryId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);

    const wasSub = subscribedDiaryIds.includes(diaryId);
    const add = (prev) => (prev.includes(diaryId) ? prev : [...prev, diaryId]);
    const drop = (prev) => prev.filter((id) => id !== diaryId);
    setSubscribedDiaryIds(wasSub ? drop : add);

    const request = wasSub ? removeDiarySubscription : addDiarySubscription;
    const { error } = await request({ userId: currentUser.growerId, diaryId });
    pendingReactionsRef.current.delete(key);

    if (error) {
      setSubscribedDiaryIds(wasSub ? add : drop);
      showToast(error.message || 'Не удалось изменить подписку');
      return;
    }
    if (wasSub) {
      showToast('Подписка на обновления отключена');
    } else {
      showToast(`Ты подписан на обновления «${diaryTitle}»`, 'success');
    }
  }, [currentUser, subscribedDiaryIds, showToast, openModal]);

  const markNotificationRead = useCallback((notifId) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // INSERT в comments. Тост об успехе — только после ответа БД. Возвращает
  // созданный комментарий (или null при гостевом/неудачном вызове), чтобы
  // форма могла очищать поле ввода только при успехе.
  const addComment = useCallback(async (diaryId, text) => {
    if (!currentUser) {
      showToast('Войди, чтобы оставить комментарий');
      openModal('auth');
      return null;
    }
    const key = `comment:${diaryId}`;
    if (pendingReactionsRef.current.has(key)) return null; // защита от двойного клика
    pendingReactionsRef.current.add(key);
    try {
      const { data: comment, error } = await insertComment({ diaryId, authorId: currentUser.growerId, text });
      if (error) {
        showToast(error.message || 'Не удалось опубликовать комментарий');
        return null;
      }
      setDiaries((prev) => prev.map((d) => (
        d.id === diaryId ? { ...d, comments: [...d.comments, comment] } : d
      )));
      showToast('Комментарий опубликован', 'success');
      return comment;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast, openModal]);

  // ---- recipes ----
  const addRecipe = useCallback(async (formData) => {
    if (!currentUser) return null;
    const { data: r, error } = await insertRecipe({ ...formData, growerId: currentUser.growerId });
    if (error) {
      showToast(error.message || 'Не удалось опубликовать рецепт');
      return null;
    }
    setRecipes((prev) => [r, ...prev]);
    showToast(`Рецепт «${r.title}» опубликован!`, 'success');
    return r;
  }, [currentUser, showToast]);

  const toggleLikeRecipe = useCallback((recipeId) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    return toggleLikeEntity({ entityType: LIKE_TYPES.RECIPE, id: recipeId, currentlyLiked: !!recipe.liked, setCollection: setRecipes });
  }, [recipes, toggleLikeEntity]);

  // Просмотр рецепта: сразу +1 в state (мгновенный UX), затем фоном RPC
  // increment_recipe_views (security definer, миграция 0011) — views_count в
  // БД двигаем не UPDATE-ом (RLS пустит только владельца), а через функцию.
  // Ошибку НЕ откатываем и тостом не показываем: не критично, если счётчик
  // не увеличился. Защита от двойного вызова — на стороне страницы
  // (useRef в RecipeDetail: один вызов на открытие рецепта).
  const incrementRecipeViews = useCallback((recipeId) => {
    setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, views: (r.views ?? 0) + 1 } : r)));
    incrementRecipeViewsRpc(recipeId).then(({ error }) => {
      if (error) console.warn('[views] Не удалось обновить счётчик просмотров рецепта:', error.message);
    });
  }, []);

  // Сохранить/убрать рецепт: оптимистичный state → INSERT/DELETE в recipe_saves →
  // откат + toast(error.message) при ошибке. Тост успеха — после ответа БД.
  // Дубликат (23505, уже сохранён) для INSERT — не ошибка.
  const toggleSaveRecipe = useCallback(async (recipeId) => {
    if (!currentUser) {
      showToast('Войди, чтобы сохранять рецепты в профиль');
      openModal('auth');
      return;
    }
    const key = `save:${recipeId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    const wasSaved = savedRecipeIds.includes(recipeId);
    const apply = (saved) => setSavedRecipeIds((prev) => {
      if (saved) return prev.includes(recipeId) ? prev : [...prev, recipeId];
      return prev.filter((id) => id !== recipeId);
    });
    apply(!wasSaved);
    try {
      const request = wasSaved ? deleteRecipeSave : insertRecipeSave;
      const { error } = await request({ userId: currentUser.growerId, recipeId });
      if (error) {
        apply(wasSaved);
        showToast(error.message || 'Не удалось обновить сохранённые рецепты');
        return;
      }
      showToast(wasSaved ? 'Рецепт убран из сохранённых' : 'Рецепт сохранён в профиль', wasSaved ? null : 'success');
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, savedRecipeIds, showToast, openModal]);

  // ---- seed bank (personal seed inventory) ----
  // Этап 5: seed_bank_items (RLS — только свои строки). add/remove — после
  // ответа БД, toggle статуса — оптимистично с откатом.
  const addSeed = useCallback(async (seedData) => {
    if (!currentUser) {
      showToast('Войди, чтобы вести банк семян');
      openModal('auth');
      return null;
    }
    const name = (seedData?.name || varieties.find((v) => v.id === seedData?.varietyId)?.name || '').trim();
    if (!name) {
      showToast('Укажи название сорта');
      return null;
    }
    const key = 'seed:new';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      const { data: seed, error } = await insertSeed({
        userId: currentUser.growerId,
        name,
        varietyId: seedData.varietyId,
        quantity: seedData.quantity,
        status: seedData.status, // 'have' = есть семена, 'want' = ищу семена
        notes: seedData.notes
      });
      if (error) {
        showToast(error.message || 'Не удалось добавить семена');
        return null;
      }
      setSeedBank((prev) => [seed, ...prev]);
      showToast('Сорт добавлен в банк семян', 'success');
      return seed;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, varieties, showToast, openModal]);

  const removeSeed = useCallback(async (seedId) => {
    const key = `seed:${seedId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      const { error } = await deleteSeed(seedId);
      if (error) {
        showToast(error.message || 'Не удалось удалить семена');
        return;
      }
      setSeedBank((prev) => prev.filter((s) => s.id !== seedId));
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [showToast]);

  const toggleSeedStatus = useCallback(async (seedId) => {
    const seed = seedBank.find((s) => s.id === seedId);
    if (!seed) return;
    const key = `seed:${seedId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    const prevStatus = seed.status;
    const nextStatus = prevStatus === 'have' ? 'want' : 'have';
    const apply = (status) => setSeedBank((prev) => prev.map((s) => (s.id === seedId ? { ...s, status } : s)));
    apply(nextStatus);
    try {
      const { error } = await updateSeedStatus(seedId, nextStatus);
      if (error) {
        apply(prevStatus);
        showToast(error.message || 'Не удалось изменить статус семян');
      }
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [seedBank, showToast]);

  // ---- blog ----
  // INSERT в blog_posts со status='pending'. Обложка грузится в Storage внутри
  // insertBlogPost (см. services/_photo.js); если фото было, а photo_url
  // вернулся null — загрузка не удалась, предупреждаем тостом.
  const addBlogPost = useCallback(async (formData) => {
    if (!currentUser) return null;
    const key = 'blog:new';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      const { data: p, error } = await insertBlogPost({ ...formData, growerId: currentUser.growerId });
      if (error) {
        showToast(error.message || 'Не удалось отправить статью');
        return null;
      }
      setBlogPosts((prev) => [p, ...prev]);
      const photoDropped = !!formData.photo && !p.photo;
      showToast(
        photoDropped
          ? `Статья «${p.title}» отправлена на модерацию без обложки. Фото не загрузилось — попробуй файл поменьше (до 5 МБ)`
          : `Статья «${p.title}» отправлена на модерацию`,
        'success'
      );
      return p;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast]);

  // Этап 5: тот же toggleLikeEntity, что у diary/recipe/question
  // (entity_type = 'blog_post'; likes_count двигает триггер apply_like_delta).
  const toggleLikeBlogPost = useCallback((postId) => {
    const post = blogPosts.find((p) => p.id === postId);
    if (!post) return;
    return toggleLikeEntity({ entityType: LIKE_TYPES.BLOG_POST, id: postId, currentlyLiked: !!post.liked, setCollection: setBlogPosts });
  }, [blogPosts, toggleLikeEntity]);

  // Просмотр статьи: та же схема, что у incrementRecipeViews — оптимистичный
  // +1 в state, затем фоном RPC increment_blog_views (миграция 0011); при
  // ошибке только console.warn, без отката. Защита от двойного вызова — на
  // странице (countedRef в BlogDetail).
  const incrementBlogViews = useCallback((postId) => {
    setBlogPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, views: (p.views ?? 0) + 1 } : p)));
    incrementBlogViewsRpc(postId).then(({ error }) => {
      if (error) console.warn('[views] Не удалось обновить счётчик просмотров статьи:', error.message);
    });
  }, []);

  // ---- contests ----
  // Этап 5: INSERT в contest_participants. Оптимистично: joinedContestIds и
  // счётчик participants → при ошибке откат + toast(error.message). Дубликат
  // (23505) — не ошибка: юзер уже участвует, счётчик из БД уже включает его,
  // поэтому оптимистичный +1 отменяем.
  const joinContest = useCallback(async (contestId) => {
    if (!currentUser) {
      showToast('Войди, чтобы участвовать в конкурсе');
      openModal('auth');
      return;
    }
    if (joinedContestIds.includes(contestId)) return;
    const key = `join:${contestId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);

    const bump = (delta) => setContests((prev) => prev.map((c) => (
      c.id === contestId ? { ...c, participants: Math.max(0, c.participants + delta) } : c
    )));
    setJoinedContestIds((prev) => (prev.includes(contestId) ? prev : [...prev, contestId]));
    bump(1);

    try {
      const { data, error } = await insertContestParticipant({ contestId, userId: currentUser.growerId });
      if (error) {
        setJoinedContestIds((prev) => prev.filter((id) => id !== contestId));
        bump(-1);
        showToast(error.message || 'Не удалось присоединиться к конкурсу');
        return;
      }
      if (data?.duplicate) {
        bump(-1);
        showToast('Ты уже участвуешь в конкурсе');
        return;
      }
      showToast('Ты участвуешь в конкурсе!', 'success');
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, joinedContestIds, showToast, openModal]);

  // ---- Q&A ("Вопросы") ----
  const addQuestion = useCallback(async (formData) => {
    if (!currentUser) {
      showToast('Войди, чтобы задать вопрос');
      openModal('auth');
      return null;
    }
    const key = 'question:new';
    if (pendingReactionsRef.current.has(key)) return null;
    pendingReactionsRef.current.add(key);
    try {
      // Фото грузится в Storage внутри insertQuestion (см. services/_photo.js).
      // Если фото было, а photo_url вернулся null — загрузка не удалась.
      const { data: q, error } = await insertQuestion({ ...formData, growerId: currentUser.growerId });
      if (error) {
        showToast(error.message || 'Не удалось опубликовать вопрос');
        return null;
      }
      setQuestions((prev) => [q, ...prev]);
      const photoDropped = !!formData.photo && !q.photo;
      showToast(
        photoDropped
          ? 'Вопрос опубликован без фото. Фото не загрузилось — попробуй файл поменьше (до 5 МБ)'
          : 'Вопрос опубликован!',
        'success'
      );
      return q;
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast, openModal]);

  const addAnswer = useCallback(async (questionId, text) => {
    if (!currentUser) {
      showToast('Войди, чтобы ответить на вопрос');
      openModal('auth');
      return;
    }
    const key = `answer:${questionId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      const { data: answer, error } = await insertAnswer({ questionId, authorId: currentUser.growerId, text });
      if (error) {
        showToast(error.message || 'Не удалось опубликовать ответ');
        return;
      }
      // В БД questions.updated_at поднимает триггер answers_touch_question;
      // локально выставляем то же значение сразу — вопрос всплывает в ленте
      // без перезагрузки (created_at ответа = now() в момент INSERT, как у триггера).
      setQuestions((prev) => prev.map((q) => {
        if (q.id !== questionId) return q;
        return { ...q, answers: [...q.answers, answer], updatedAt: answer.createdAt };
      }));
      showToast('Ответ опубликован', 'success');
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, showToast, openModal]);

  const toggleLikeQuestion = useCallback((questionId) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    return toggleLikeEntity({ entityType: LIKE_TYPES.QUESTION, id: questionId, currentlyLiked: !!question.liked, setCollection: setQuestions });
  }, [questions, toggleLikeEntity]);

  // Переключатель solved <-> open (как в моке). UPDATE в БД, state и тост —
  // только после подтверждения; если RLS не пустил (не владелец), сервис
  // вернёт понятную ошибку, а не молчаливый "успех".
  const markSolved = useCallback(async (questionId) => {
    if (!currentUser) {
      showToast('Войди, чтобы изменить статус вопроса');
      openModal('auth');
      return;
    }
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    const key = `solve:${questionId}`;
    if (pendingReactionsRef.current.has(key)) return;
    pendingReactionsRef.current.add(key);
    try {
      const nextStatus = question.status === 'solved' ? 'open' : 'solved';
      const { data: status, error } = await updateQuestionStatus(questionId, nextStatus);
      if (error) {
        showToast(error.message || 'Не удалось изменить статус вопроса');
        return;
      }
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, status } : q)));
      showToast(status === 'solved' ? 'Вопрос отмечен как решённый' : 'Вопрос снова открыт', 'success');
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  }, [currentUser, questions, showToast, openModal]);

  // ================= АДМИН-ДЕЙСТВИЯ (Этапы 4-12) =================
  // Все функции ниже не проверяют isAdmin сами — это ответственность
  // ProtectedAdminRoute (роуты) и того, что кнопки/формы физически недоступны
  // за пределами /admin. Общий паттерн — как у остальных мутаций выше:
  // setState + showToast.

  // ---- сорта ----
  const adminAddVariety = useCallback(async (formData) => {
    const { data: v, error } = await createVarietyFromAdminForm(formData);
    if (error) {
      showToast(error.message || 'Не удалось добавить сорт');
      return null;
    }
    setVarieties((prev) => [v, ...prev]);
    showToast(`Сорт «${v.name}» добавлен`, 'success');
    return v;
  }, [showToast]);

  const adminUpdateVariety = useCallback((id, patch) => {
    setVarieties((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    showToast('Сорт обновлён', 'success');
  }, [showToast]);

  /** Считает, сколько дневников ссылаются на сорт (для предупреждения перед удалением). */
  const countDiariesUsingVariety = useCallback((varietyId) => (
    diaries.filter((d) => d.varietyId === varietyId || (Array.isArray(d.varietyIds) && d.varietyIds.includes(varietyId))).length
  ), [diaries]);

  const adminDeleteVariety = useCallback((id) => {
    const usedByCount = countDiariesUsingVariety(id);
    if (usedByCount > 0) {
      showToast(`Нельзя удалить: сорт используется в ${usedByCount} дневник(ах)`);
      return false;
    }
    setVarieties((prev) => prev.filter((v) => v.id !== id));
    showToast('Сорт удалён', 'success');
    return true;
  }, [countDiariesUsingVariety, showToast]);

  // ---- дневники ----
  const adminUpdateDiary = useCallback((id, patch) => {
    setDiaries((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    showToast('Дневник обновлён', 'success');
  }, [showToast]);

  const adminDeleteWeekReport = useCallback((diaryId, weekN) => {
    setDiaries((prev) => prev.map((d) => (d.id === diaryId ? { ...d, weeks: d.weeks.filter((w) => w.n !== weekN) } : d)));
    showToast('Отчёт удалён', 'success');
  }, [showToast]);

  const adminDeleteDiary = useCallback((id) => {
    const target = diaries.find((d) => d.id === id);
    if (target) {
      setGrowers((prev) => prev.map((g) => (g.id === target.growerId ? { ...g, diaries: Math.max(0, g.diaries - 1) } : g)));
    }
    setDiaries((prev) => prev.filter((d) => d.id !== id));
    showToast('Дневник удалён', 'success');
  }, [diaries, showToast]);

  // ---- пользователи ----
  const adminSetGrowerRole = useCallback((growerId, role) => {
    setGrowers((prev) => prev.map((g) => (g.id === growerId ? { ...g, role } : g)));
    showToast(role === 'admin' ? 'Назначен администратором' : 'Права администратора сняты', 'success');
  }, [showToast]);

  const adminSetGrowerBanned = useCallback((growerId, banned) => {
    setGrowers((prev) => prev.map((g) => (g.id === growerId ? { ...g, banned } : g)));
    showToast(banned ? 'Гровер забанен' : 'Гровер разбанен', 'success');
  }, [showToast]);

  /** Мягкое удаление — сохраняем данные (дневники/рецепты и т.п.), просто помечаем `deleted`. */
  const adminSetGrowerDeleted = useCallback((growerId, deleted) => {
    setGrowers((prev) => prev.map((g) => (g.id === growerId ? { ...g, deleted } : g)));
    showToast(deleted ? 'Гровер помечен как удалённый' : 'Гровер восстановлен', 'success');
  }, [showToast]);

  // ---- рецепты ----
  const adminAddRecipe = useCallback(async (formData) => {
    const { data: r, error } = await createRecipeFromForm({ ...formData, growerId: 'admin' });
    if (error) {
      showToast(error.message || 'Не удалось создать рецепт');
      return null;
    }
    const withHidden = { ...r, hidden: false };
    setRecipes((prev) => [withHidden, ...prev]);
    showToast(`Рецепт «${r.title}» создан`, 'success');
    return withHidden;
  }, [showToast]);

  const adminUpdateRecipe = useCallback((id, patch) => {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    showToast('Рецепт обновлён', 'success');
  }, [showToast]);

  const adminDeleteRecipe = useCallback((id) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    showToast('Рецепт удалён', 'success');
  }, [showToast]);

  const adminToggleRecipeHidden = useCallback((id) => {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, hidden: !r.hidden } : r)));
  }, []);

  // ---- блог ----
  const adminAddBlogPost = useCallback(async (formData) => {
    const { data: p, error } = await createPostFromForm({ ...formData, growerId: 'admin' });
    if (error) {
      showToast(error.message || 'Не удалось опубликовать статью');
      return null;
    }
    const published = { ...p, status: 'approved' };
    setBlogPosts((prev) => [published, ...prev]);
    showToast(`Статья «${p.title}» опубликована`, 'success');
    return published;
  }, [showToast]);

  const adminUpdateBlogPost = useCallback((id, patch) => {
    setBlogPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    showToast('Статья обновлена', 'success');
  }, [showToast]);

  const adminDeleteBlogPost = useCallback((id) => {
    setBlogPosts((prev) => prev.filter((p) => p.id !== id));
    showToast('Статья удалена', 'success');
  }, [showToast]);

  const adminModerateBlogPost = useCallback((id, decision, reason) => {
    setBlogPosts((prev) => prev.map((p) => (p.id === id ? {
      ...p,
      status: decision,
      rejectReason: decision === 'rejected' ? (reason || '') : ''
    } : p)));
    showToast(decision === 'approved' ? 'Статья одобрена' : 'Статья отклонена', 'success');
  }, [showToast]);

  // ---- вопросы ----
  const adminUpdateQuestion = useCallback((id, patch) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    showToast('Вопрос обновлён', 'success');
  }, [showToast]);

  const adminDeleteQuestion = useCallback((id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    showToast('Вопрос удалён', 'success');
  }, [showToast]);

  const adminAnswerQuestion = useCallback(async (questionId, text) => {
    const { data: answer, error } = await createAnswer({ author: 'Администратор', text });
    if (error) {
      showToast(error.message || 'Не удалось опубликовать ответ');
      return;
    }
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, answers: [...q.answers, answer], updatedAt: answer.createdAt } : q)));
    showToast('Ответ опубликован от имени администратора', 'success');
  }, [showToast]);

  // ---- конкурсы ----
  const adminAddContest = useCallback(async (formData) => {
    const { data: c, error } = await createContestFromForm(formData);
    if (error) {
      showToast(error.message || 'Не удалось создать конкурс');
      return null;
    }
    setContests((prev) => [c, ...prev]);
    showToast(`Конкурс «${c.title}» создан`, 'success');
    return c;
  }, [showToast]);

  const adminUpdateContest = useCallback((id, patch) => {
    setContests((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    showToast('Конкурс обновлён', 'success');
  }, [showToast]);

  const adminDeleteContest = useCallback((id) => {
    setContests((prev) => prev.filter((c) => c.id !== id));
    showToast('Конкурс удалён', 'success');
  }, [showToast]);

  const adminAddContestParticipant = useCallback((contestId, growerId) => {
    setContests((prev) => prev.map((c) => {
      if (c.id !== contestId) return c;
      if (c.participantIds.includes(growerId)) return c;
      const participantIds = [...c.participantIds, growerId];
      return { ...c, participantIds, participants: participantIds.length };
    }));
    showToast('Участник добавлен', 'success');
  }, [showToast]);

  const adminRemoveContestParticipant = useCallback((contestId, growerId) => {
    setContests((prev) => prev.map((c) => {
      if (c.id !== contestId) return c;
      const participantIds = c.participantIds.filter((id) => id !== growerId);
      return { ...c, participantIds, participants: participantIds.length };
    }));
    showToast('Участник удалён', 'success');
  }, [showToast]);

  // ---- свет ----
  const adminAddLight = useCallback(async (formData) => {
    const { data: l, error } = await createLightFromForm(formData);
    if (error) {
      showToast(error.message || 'Не удалось добавить лампу');
      return null;
    }
    setLights((prev) => [l, ...prev]);
    showToast('Лампа добавлена', 'success');
    return l;
  }, [showToast]);

  const adminUpdateLight = useCallback((id, patch) => {
    setLights((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    showToast('Лампа обновлена', 'success');
  }, [showToast]);

  const adminDeleteLight = useCallback((id) => {
    setLights((prev) => prev.filter((l) => l.id !== id));
    showToast('Лампа удалена', 'success');
  }, [showToast]);

  // ---- удобрения ----
  const adminAddNutrient = useCallback(async (formData) => {
    const { data: n, error } = await createNutrientFromForm(formData);
    if (error) {
      showToast(error.message || 'Не удалось добавить удобрение');
      return null;
    }
    setNutrients((prev) => [n, ...prev]);
    showToast('Удобрение добавлено', 'success');
    return n;
  }, [showToast]);

  const adminUpdateNutrient = useCallback((id, patch) => {
    setNutrients((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    showToast('Удобрение обновлено', 'success');
  }, [showToast]);

  const adminDeleteNutrient = useCallback((id) => {
    setNutrients((prev) => prev.filter((n) => n.id !== id));
    showToast('Удобрение удалено', 'success');
  }, [showToast]);

  // ---- настройки сайта ----
  const adminUpdateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    showToast('Настройки сохранены', 'success');
  }, [showToast]);

  // ---- экспорт / импорт / сброс ----
  const adminExportData = useCallback(() => ({
    growers, varieties, diaries, recipes, blogPosts, contests, questions, lights, nutrients, settings
  }), [growers, varieties, diaries, recipes, blogPosts, contests, questions, lights, nutrients, settings]);

  const adminImportData = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      showToast('Некорректный файл');
      return false;
    }
    const required = ['growers', 'varieties', 'diaries', 'recipes', 'blogPosts', 'contests', 'questions'];
    const missing = required.filter((k) => !Array.isArray(data[k]));
    if (missing.length) {
      showToast('В файле не хватает разделов: ' + missing.join(', '));
      return false;
    }
    setGrowers(data.growers);
    setVarieties(data.varieties);
    setDiaries(data.diaries);
    setRecipes(data.recipes);
    setBlogPosts(data.blogPosts);
    setContests(data.contests.map((c) => ({ participantIds: [], ...c })));
    setQuestions(data.questions);
    setLights(Array.isArray(data.lights) ? data.lights : []);
    setNutrients(Array.isArray(data.nutrients) ? data.nutrients : []);
    setSettings(data.settings && typeof data.settings === 'object' ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS);
    showToast('Данные загружены', 'success');
    return true;
  }, [showToast]);

  const adminResetToSeed = useCallback(() => {
    clearState();
    window.location.reload();
  }, []);

  const value = {
    loading: loading || !authReady, initError,
    growers, varieties, diaries, recipes, blogPosts, contests, questions, lights, nutrients, settings,
    currentUser, login, signup, logout, updateProfile, setOnlineStatus, isAdmin,
    theme, setTheme,
    sidebarCollapsed, setSidebarCollapsed,
    searchQuery, setSearchQuery,
    activeModal, modalPayload, openModal, closeModal,
    wizard, openWizard, updateWizard, toggleWizardVariety, openAddVarietyFromWizard,
    toasts, showToast,
    findGrowerById,
    toggleFollowGrower,
    addVariety,
    varietyVotes, voteVariety,
    toggleLikeDiary, loadFullDiary, createDiary, addWeekReport, addComment, updateDiaryStage,
    subscribedDiaryIds, toggleDiarySubscription,
    notifications, markNotificationRead, markAllNotificationsRead,
    addRecipe,
    toggleLikeRecipe, incrementRecipeViews, toggleSaveRecipe, savedRecipeIds,
    seedBank, addSeed, removeSeed, toggleSeedStatus,
    addBlogPost, toggleLikeBlogPost, incrementBlogViews,
    joinContest, joinedContestIds,
    addQuestion, addAnswer, toggleLikeQuestion, markSolved,

    // ---- админ ----
    adminAddVariety, adminUpdateVariety, adminDeleteVariety, countDiariesUsingVariety,
    adminUpdateDiary, adminDeleteWeekReport, adminDeleteDiary,
    adminSetGrowerRole, adminSetGrowerBanned, adminSetGrowerDeleted,
    adminAddRecipe, adminUpdateRecipe, adminDeleteRecipe, adminToggleRecipeHidden,
    adminAddBlogPost, adminUpdateBlogPost, adminDeleteBlogPost, adminModerateBlogPost,
    adminUpdateQuestion, adminDeleteQuestion, adminAnswerQuestion,
    adminAddContest, adminUpdateContest, adminDeleteContest, adminAddContestParticipant, adminRemoveContestParticipant,
    adminAddLight, adminUpdateLight, adminDeleteLight,
    adminAddNutrient, adminUpdateNutrient, adminDeleteNutrient,
    adminUpdateSettings,
    adminExportData, adminImportData, adminResetToSeed
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
