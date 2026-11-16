/**
 * js/ui/theme.js
 * Gestión del sistema de temas (Claro / Oscuro) mediante el atributo `data-theme`
 * en el elemento raíz `<html>` y persistencia en `localStorage`.
 */

export const THEME_STORAGE_KEY = 'tracky-theme';

/**
 * Aplica un tema ('light' o 'dark') al documento HTML y sincroniza
 * el meta tag `theme-color` para la barra de estado del navegador móvil.
 *
 * @param {'light' | 'dark'} theme
 */
function applyThemeToDOM(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', normalizedTheme);

  const metaThemeColor = document.getElementById('meta-theme-color');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      normalizedTheme === 'dark' ? '#0f172a' : '#6366f1'
    );
  }
}

/**
 * Obtiene el tema actualmente activo en el DOM.
 *
 * @returns {'light' | 'dark'}
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}

/**
 * Inicializa el tema al cargar la aplicación leyendo `localStorage`
 * o, si no existe preferencia guardada, consultando `prefers-color-scheme` del sistema.
 *
 * @returns {'light' | 'dark'} El tema inicial aplicado.
 */
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyThemeToDOM(initialTheme);

  return initialTheme;
}

/**
 * Alterna el atributo `data-theme` en `<html>` entre 'light' y 'dark',
 * guarda la elección en `localStorage` (clave 'tracky-theme') y retorna el nuevo tema.
 *
 * @returns {'light' | 'dark'} El nuevo tema activo.
 */
export function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  applyThemeToDOM(nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  return nextTheme;
}
