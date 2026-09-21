// Единый клиент Supabase для всего приложения.
//
// Импортировать именно отсюда (import { supabase } from './services/supabase/client.js'),
// а не создавать createClient() повторно в других файлах — supabase-js не
// рассчитан на несколько параллельных клиентов на одни и те же таблицы
// (дублирование realtime-подписок, лишние сетевые соединения и т.п.).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase не настроен: отсутствует VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY. ' +
      'Проверь файл .env.local в корне проекта (переменные должны начинаться с VITE_, ' +
      'иначе Vite не подставит их в import.meta.env) и перезапусти `npm run dev`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
