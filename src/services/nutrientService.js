import { NUTRIENTS } from '../data/nutrients.js';
import { ok, fail } from './_result.js';

let _store = null;
function store() {
  if (!_store) {
    _store = NUTRIENTS.map((n, i) => ({
      id: 'n' + (i + 1),
      brand: '',
      type: '',
      link: '',
      photo: null,
      sponsored: false,
      ...n
    }));
  }
  return _store;
}

export async function fetchInitialNutrients() {
  try {
    return ok(store().map((n) => ({ ...n })));
  } catch (e) {
    return fail(e);
  }
}

/** getNutrientById(id) — новый геттер, см. риски Этапа 1. */
export async function getNutrientById(id) {
  try {
    const found = store().find((n) => n.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Nutrient ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

export async function createNutrientFromForm({ name, brand, type, tag, price, rating, desc, link, photo, sponsored }) {
  try {
    const nutrient = {
      id: 'n_' + Date.now(),
      name: name || 'Новое удобрение',
      brand: brand || '',
      type: type || '',
      tag: tag || '',
      price: price || '',
      rating: Number(rating) || 0,
      desc: desc || '',
      link: link || '',
      photo: photo || null,
      sponsored: !!sponsored
    };
    return ok(nutrient);
  } catch (e) {
    return fail(e);
  }
}
