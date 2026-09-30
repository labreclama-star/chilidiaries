import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { baseUrl } from './src/config/seo.js';

// Маленький плагин (без новых библиотек): при сборке и в dev заменяет
// %SITE_URL% в index.html на baseUrl из src/config/seo.js.
// order: 'pre' — чтобы замена случилась раньше встроенной подстановки Vite.
function injectSiteUrl() {
  return {
    name: 'inject-site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', baseUrl),
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSiteUrl()],
  server: {
    port: 5173,
    open: false
  }
});
