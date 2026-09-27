-- 0015: массив путей вкладок сайдбара, скрытых с бейджем "В разработке".
-- Пусто по умолчанию — ничего не скрыто.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS wip_tabs text[] NOT NULL DEFAULT '{}';