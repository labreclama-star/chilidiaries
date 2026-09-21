/**
 * Community rating logic for varieties.
 *
 * Каждый сорт в каталоге уже имеет "стартовые" значения rating/
 * capsaicinRating/aromaRating (задаются при добавлении сорта — либо
 * дефолт 0, либо оценка автора карточки). Мы считаем эти стартовые числа
 * как бы средним по BASE_VOTE_WEIGHT "виртуальных" голосов — это защищает
 * рейтинг от резких скачков от одного-двух первых реальных голосов
 * (классический байесовский сглаженный рейтинг, как у IMDb/BoardGameGeek),
 * но по мере роста реальных голосов сообщество всё сильнее "перетягивает"
 * число на себя: когда голосов сообщества становится ощутимо больше
 * BASE_VOTE_WEIGHT, итоговое число практически полностью определяется
 * реальными оценками.
 *
 * voice/vote shape: { varietyId, userId, overall, capsaicin, aroma, ts }
 * Один пользователь — один голос на сорт: повторное голосование заменяет
 * его же предыдущий голос (не суммируется).
 */

export const BASE_VOTE_WEIGHT = 20;

function weightedAvg(seed, votes, key) {
  const sum = votes.reduce((acc, v) => acc + (v[key] || 0), 0);
  return (seed * BASE_VOTE_WEIGHT + sum) / (BASE_VOTE_WEIGHT + votes.length);
}

/** All votes cast for a given variety. */
export function votesForVariety(allVotes, varietyId) {
  return allVotes.filter((v) => v.varietyId === varietyId);
}

/** This user's own vote for a variety, if they voted before (for pre-filling the form). */
export function findUserVote(allVotes, varietyId, userId) {
  return allVotes.find((v) => v.varietyId === varietyId && v.userId === userId) || null;
}

/**
 * Computed, community-adjusted ratings for a variety: the three averages
 * plus how many real community votes stand behind them.
 */
export function computeVarietyRatings(variety, allVotes) {
  const votes = votesForVariety(allVotes, variety.id);
  return {
    overall: weightedAvg(variety.rating || 0, votes, 'overall'),
    capsaicin: weightedAvg(variety.capsaicinRating || 0, votes, 'capsaicin'),
    aroma: weightedAvg(variety.aromaRating || 0, votes, 'aroma'),
    voteCount: votes.length
  };
}
