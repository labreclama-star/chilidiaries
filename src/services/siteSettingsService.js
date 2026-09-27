import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { settingsRowToJs } from './supabase/mappers.js';
import { toError } from './_dbError.js';
import { photoUrlForDb } from './_photo.js';

/**
 * fetchSiteSettings() — читает единственную строку site_settings (id = true).
 * SELECT публичный (см. RLS в 0015_site_settings_wip_tabs.sql и исходную
 * миграцию site_settings) — читать можно и гостю, поэтому вызывается из
 * стартового Promise.all в AppContext без проверки currentUser.
 */
export async function fetchSiteSettings() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) return fail(toError(error));
    if (!data) return fail(new Error('site_settings: строка не найдена'));
    return ok(settingsRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateSiteSettings(patch) — partial UPDATE по id=true (строка одна,
 * INSERT не нужен и не разрешён RLS-политикой). patch приходит в camelCase
 * (как AdminSettings.form), здесь переводим в snake_case колонок БД —
 * тот же паттерн, что updateContest в contestService.js.
 *
 * bannerPhoto/heroPhoto — реальная загрузка в Storage через photoUrlForDb
 * (как photo в contestService/insertVariety): null/'' → null, готовый
 * http(s)-URL → как есть, base64/File → сжимает и грузит. Если ключа в
 * patch вообще нет — колонку не трогаем (partial update, а не перезапись
 * всей строки); если он есть и равен null (кнопка "Убрать фото" в
 * AdminSettings) — photoUrlForDb(null, ...) вернёт null, и колонка
 * реально очистится.
 *
 * RLS: UPDATE только для is_admin() — если вызвать не-админом (например,
 * мок-логином admin/ChiliAdmin2026 мимо Supabase), придёт понятная ошибка
 * через toError, а не молчаливый провал.
 */
export async function updateSiteSettings(patch) {
  try {
    const row = {};
    if (patch.siteName !== undefined) row.site_name = patch.siteName;
    if (patch.siteDescription !== undefined) row.site_description = patch.siteDescription;
    if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail;
    if (patch.telegram !== undefined) row.telegram = patch.telegram;
    if (patch.instagram !== undefined) row.instagram = patch.instagram;
    if (patch.bannerEnabled !== undefined) row.banner_enabled = patch.bannerEnabled;
    if (patch.bannerText !== undefined) row.banner_text = patch.bannerText;
    if (patch.bannerPhoto !== undefined) row.banner_photo_url = await photoUrlForDb(patch.bannerPhoto, 'siteSettingsService');
    if (patch.heroPhoto !== undefined) row.hero_photo_url = await photoUrlForDb(patch.heroPhoto, 'siteSettingsService');
    if (patch.registrationEnabled !== undefined) row.registration_enabled = patch.registrationEnabled;
    if (patch.showQuestions !== undefined) row.show_questions = patch.showQuestions;
    if (patch.showFeed !== undefined) row.show_feed = patch.showFeed;
    if (patch.wipTabs !== undefined) row.wip_tabs = patch.wipTabs;

    const { data, error } = await supabase
      .from('site_settings')
      .update(row)
      .eq('id', true)
      .select()
      .maybeSingle();
    if (error) return fail(toError(error));
    return ok(data ? settingsRowToJs(data) : null);
  } catch (e) {
    return fail(e);
  }
}