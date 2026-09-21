// Валидаторы доменных сущностей ChiliDiaries.
//
// Единый формат ответа: { valid: boolean, errors: { [field]: string } }.
// Не бросаем исключения — вызывающий код (сегодня — никто, эти функции
// пока никуда не подключены) сам решает, что делать с ошибками (показать
// в форме, залогировать при миграции и т.д.). Компоненты и services на
// этом этапе НЕ трогаем и никуда эти валидаторы не подключаем — они готовы
// для Этапа 3/4, когда формы начнут вызывать их перед отправкой.

import { RECIPE_CATEGORIES, QUESTION_STAGES, QUESTION_TOPICS } from './schema.js';

function makeResult(errors) {
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {import('./types.js').Diary} diary
 * @returns {{valid: boolean, errors: Object<string,string>}}
 */
export function validateDiary(diary) {
  const errors = {};
  if (!diary) return makeResult({ _root: 'Дневник не передан' });

  if (!diary.title || !diary.title.trim()) errors.title = 'Укажи название дневника';
  if (!diary.varietyId) errors.varietyId = 'Выбери сорт';
  if (!diary.growerId) errors.growerId = 'Не указан автор дневника';
  if (!diary.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(diary.startDate)) {
    errors.startDate = 'Дата старта должна быть в формате YYYY-MM-DD';
  }
  if (diary.varietyIds && !diary.varietyIds.includes(diary.varietyId)) {
    errors.varietyIds = 'varietyId должен входить в varietyIds';
  }

  return makeResult(errors);
}

/**
 * @param {import('./types.js').Recipe} recipe
 * @returns {{valid: boolean, errors: Object<string,string>}}
 */
export function validateRecipe(recipe) {
  const errors = {};
  if (!recipe) return makeResult({ _root: 'Рецепт не передан' });

  if (!recipe.title || !recipe.title.trim()) errors.title = 'Укажи название рецепта';
  if (!recipe.category || !RECIPE_CATEGORIES.includes(recipe.category)) {
    errors.category = `Категория должна быть одной из: ${RECIPE_CATEGORIES.join(', ')}`;
  }
  if (!recipe.growerId) errors.growerId = 'Не указан автор рецепта';
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    errors.ingredients = 'Добавь хотя бы один ингредиент';
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    errors.steps = 'Добавь хотя бы один шаг приготовления';
  }

  return makeResult(errors);
}

/**
 * @param {import('./types.js').Question} question
 * @returns {{valid: boolean, errors: Object<string,string>}}
 */
export function validateQuestion(question) {
  const errors = {};
  if (!question) return makeResult({ _root: 'Вопрос не передан' });

  if (!question.text || !question.text.trim()) errors.text = 'Опиши свой вопрос';
  if (!question.growerId) errors.growerId = 'Не указан автор вопроса';
  if (question.stage != null && !QUESTION_STAGES.includes(question.stage)) {
    errors.stage = `Стадия должна быть одной из: ${QUESTION_STAGES.join(', ')}`;
  }
  if (question.topic != null && !QUESTION_TOPICS.includes(question.topic)) {
    errors.topic = `Тема должна быть одной из: ${QUESTION_TOPICS.join(', ')}`;
  }

  return makeResult(errors);
}

/**
 * Бонус к списку из ТЗ: пригодится сразу, как только Этап 3 начнёт
 * прогонять createUserGrower/createGrower через валидацию.
 * @param {import('./types.js').Grower} grower
 * @returns {{valid: boolean, errors: Object<string,string>}}
 */
export function validateGrower(grower) {
  const errors = {};
  if (!grower) return makeResult({ _root: 'Гровер не передан' });

  if (!grower.name || !grower.name.trim()) errors.name = 'Укажи имя';

  return makeResult(errors);
}
