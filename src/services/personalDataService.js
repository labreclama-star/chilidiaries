// Личные данные пользователя, которые грузятся ПОСЛЕ логина (Этап 5, Группа 4A).
// Дополняет fetchMyReactions (лайки/подписки — reactionsService.js): после
// Cmd+R state seedBank / savedRecipeIds / joinedContestIds иначе был бы пуст.
//
// Голоса за сорта сюда НЕ входят: SELECT на variety_votes публичный, и ВСЕ
// голоса (включая мои — computeVarietyRatings/findUserVote фильтруют по
// userId) приходят в начальной загрузке через fetchAllVarietyVotes().
//
// Каждая часть грузится независимо: если одна упала (например, миграция
// 0009 ещё не применена), остальные всё равно доедут. Упавшая часть
// приходит как null — AppContext её не трогает. Если упали ВСЕ — { error }.

import { ok, fail } from './_result.js';
import { fetchMySeeds } from './seedBankService.js';
import { fetchMySavedRecipeIds } from './savedRecipeService.js';
import { fetchMyContestIds } from './contestService.js';

/**
 * @returns {Promise<{ data: { seedBank: object[]|null, savedRecipeIds: string[]|null, joinedContestIds: string[]|null } | null, error: Error|null }>}
 */
export async function fetchMyPersonalData(userId) {
  const [seedBank, savedRecipeIds, joinedContestIds] = await Promise.all([
    fetchMySeeds(userId),
    fetchMySavedRecipeIds(userId),
    fetchMyContestIds(userId)
  ]);
  return combine({ seedBank, savedRecipeIds, joinedContestIds });
}

function combine(parts) {
  const data = {};
  let firstError = null;
  let succeeded = 0;
  for (const [key, res] of Object.entries(parts)) {
    if (res.error) {
      console.warn(`[personalDataService] Не удалось загрузить ${key}:`, res.error.message);
      if (!firstError) firstError = res.error;
      data[key] = null;
    } else {
      data[key] = res.data;
      succeeded += 1;
    }
  }
  return succeeded === 0 ? fail(firstError) : ok(data);
}
