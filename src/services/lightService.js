import { LIGHTS } from '../data/lights.js';
import { ok, fail } from './_result.js';

let _store = null;
function store() {
  if (!_store) {
    _store = LIGHTS.map((l, i) => ({
      id: 'l' + (i + 1),
      brand: '',
      type: '',
      link: '',
      photo: null,
      sponsored: false,
      ...l
    }));
  }
  return _store;
}

export async function fetchInitialLights() {
  try {
    return ok(store().map((l) => ({ ...l })));
  } catch (e) {
    return fail(e);
  }
}

/** getLightById(id) — новый геттер, см. риски Этапа 1. */
export async function getLightById(id) {
  try {
    const found = store().find((l) => l.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Light ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

export async function createLightFromForm({ name, brand, type, tag, price, rating, desc, link, photo, sponsored }) {
  try {
    const light = {
      id: 'l_' + Date.now(),
      name: name || 'Новая лампа',
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
    return ok(light);
  } catch (e) {
    return fail(e);
  }
}
