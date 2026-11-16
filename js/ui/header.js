/**
 * js/ui/header.js
 * Renderizado y control de eventos de la barra de navegación superior (`#app-header`)
 * y del Menú Lateral Deslizante (Side Drawer).
 *
 * Comportamiento del botón izquierdo:
 * - Si `currentViewDate === getTodayString()` (o en la vista de calendario):
 *   Muestra el ícono de Menú Hamburguesa (3 líneas SVG) que abre/cierra el Side Drawer
 *   deslizante desde la izquierda con las opciones "Día Actual" y "Vista por mes".
 * - Si el usuario está viendo un día pasado o futuro en la vista diaria:
 *   Muestra una flecha de retroceso (<-) que al hacer clic regresa a la vista de calendario.
 *
 * Centro:
 * - Muestra la fecha del día seleccionado con `formatHeaderDate(new Date(currentViewDate + 'T00:00:00'))`.
 */

import { formatHeaderDate, getTodayString } from '../logic/dateUtils.js';
import { getCurrentTheme, toggleTheme } from './theme.js';

// Ícono SVG: Menú Hamburguesa (3 rayas horizontales)
const HAMBURGER_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
`;

// Ícono SVG: Flecha izquierda (<-) para volver al calendario desde un día pasado/futuro
const BACK_ARROW_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
`;

// Ícono SVG para el ítem "Día Actual" (Lista con check)
const TODAY_ITEM_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 11l3 3L22 4"></path>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
  </svg>
`;

// Ícono SVG para el ítem "Vista por mes" (Calendario)
const CALENDAR_ITEM_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
`;

// Íconos SVG para el botón de tema (Sol / Luna)
const SUN_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
`;

const MOON_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
`;

// Estado interno del header para saber si el botón izquierdo actúa como menú o como flecha <-
let isBackArrowMode = false;

/**
 * Cierra el menú lateral (Side Drawer) y su fondo oscuro (Backdrop).
 */
export function closeSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const leftBtn = document.getElementById('header-left-btn');

  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) {
    backdrop.classList.remove('open');
  }
  if (leftBtn && !isBackArrowMode) {
    leftBtn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Alterna (abre/cierra) el menú lateral (Side Drawer).
 */
export function toggleSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const leftBtn = document.getElementById('header-left-btn');

  if (!drawer || !backdrop) return;

  const isOpen = drawer.classList.toggle('open');
  backdrop.classList.toggle('open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));

  if (leftBtn) {
    leftBtn.setAttribute('aria-expanded', String(isOpen));
  }
}

/**
 * Actualiza el ícono del botón izquierdo (Menú Hamburguesa vs Flecha <-),
 * el texto central con la fecha seleccionada y el estado `.active` de los ítems del Side Drawer.
 *
 * @param {Object} params
 * @param {'daily' | 'calendar'} params.currentView
 * @param {string} params.currentViewDate - Fecha en formato 'YYYY-MM-DD'.
 */
export function updateHeaderState({ currentView = 'daily', currentViewDate = getTodayString() } = {}) {
  const leftBtn = document.getElementById('header-left-btn');
  const dateDisplay = document.getElementById('header-date-display');
  const todayItemBtn = document.getElementById('menu-item-today');
  const calendarItemBtn = document.getElementById('menu-item-calendar');

  closeSideDrawer();

  const todayStr = getTodayString();
  // Mostramos la flecha <- cuando el usuario está viendo un día distinto a hoy en la vista diaria
  isBackArrowMode = currentView === 'daily' && currentViewDate !== todayStr;

  if (leftBtn) {
    if (isBackArrowMode) {
      leftBtn.innerHTML = BACK_ARROW_ICON_SVG;
      leftBtn.setAttribute('aria-label', 'Volver al calendario');
      leftBtn.setAttribute('title', 'Volver al calendario');
      leftBtn.removeAttribute('aria-expanded');
    } else {
      leftBtn.innerHTML = HAMBURGER_ICON_SVG;
      leftBtn.setAttribute('aria-label', 'Abrir menú de navegación');
      leftBtn.setAttribute('title', 'Menú');
      leftBtn.setAttribute('aria-expanded', 'false');
    }
  }

  // Actualizamos el título central del Header con la fecha seleccionada
  if (dateDisplay && currentViewDate) {
    const selectedDateObj = new Date(`${currentViewDate}T00:00:00`);
    dateDisplay.textContent = formatHeaderDate(selectedDateObj);
  }

  // Sincronizamos la clase `.active` en las opciones del Side Drawer según la vista actual
  if (todayItemBtn && calendarItemBtn) {
    const isTodayViewActive = currentView === 'daily' && currentViewDate === todayStr;
    const isCalendarViewActive = currentView === 'calendar';

    todayItemBtn.classList.toggle('active', isTodayViewActive);
    calendarItemBtn.classList.toggle('active', isCalendarViewActive);
  }
}

/**
 * Actualiza el ícono del botón de tema según el tema activo ('light' o 'dark').
 *
 * @param {'light' | 'dark'} theme
 */
export function updateHeaderThemeButton(theme) {
  const themeBtn = document.getElementById('header-theme-btn');
  if (!themeBtn) return;

  const isDark = theme === 'dark';
  themeBtn.innerHTML = isDark ? SUN_ICON_SVG : MOON_ICON_SVG;
  themeBtn.setAttribute(
    'aria-label',
    isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
  );
  themeBtn.setAttribute(
    'title',
    isDark ? 'Tema claro' : 'Tema oscuro'
  );
}

/**
 * Inyecta el HTML de la barra de navegación superior y del Side Drawer dentro de `<header id="app-header">`
 * y conecta todos los eventos de interacción.
 *
 * @param {Object} options
 * @param {'daily' | 'calendar'} [options.currentView='daily']
 * @param {string} [options.currentViewDate=getTodayString()]
 * @param {Function} options.onSelectToday - Acción al elegir "Día Actual".
 * @param {Function} options.onSelectCalendar - Acción al elegir "Vista por mes".
 * @param {Function} options.onBackToCalendar - Acción al pulsar la flecha <-.
 */
export function renderHeader({
  currentView = 'daily',
  currentViewDate = getTodayString(),
  onSelectToday,
  onSelectCalendar,
  onBackToCalendar
} = {}) {
  const headerContainer = document.getElementById('app-header');
  if (!headerContainer) return;

  const formattedDate = formatHeaderDate(new Date(`${currentViewDate}T00:00:00`));
  const activeTheme = getCurrentTheme();

  headerContainer.innerHTML = `
    <div class="header-inner">
      <button
        type="button"
        id="header-left-btn"
        class="header-icon-btn"
        aria-haspopup="true"
        aria-expanded="false"
      ></button>

      <h1 class="header-date-title" id="header-date-display">${formattedDate}</h1>

      <button
        type="button"
        id="header-theme-btn"
        class="header-icon-btn"
      ></button>
    </div>

    <!-- Fondo oscuro semitransparente (Backdrop) detrás del Side Drawer -->
    <div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>

    <!-- Menú Lateral Deslizante (Side Drawer) -->
    <aside
      id="side-drawer"
      class="side-drawer"
      aria-label="Menú principal"
      aria-hidden="true"
    >
      <div class="drawer-header">
        <button
          type="button"
          id="drawer-close-btn"
          class="header-icon-btn"
          aria-label="Cerrar menú"
          title="Cerrar menú"
        >
          ${HAMBURGER_ICON_SVG}
        </button>
        <span class="drawer-brand-title">Tracky</span>
      </div>

      <nav class="drawer-nav">
        <button type="button" class="drawer-nav-item active" id="menu-item-today">
          <span class="drawer-nav-icon">${TODAY_ITEM_ICON_SVG}</span>
          <span class="drawer-nav-text">Día Actual</span>
        </button>

        <button type="button" class="drawer-nav-item" id="menu-item-calendar">
          <span class="drawer-nav-icon">${CALENDAR_ITEM_ICON_SVG}</span>
          <span class="drawer-nav-text">Vista por mes</span>
        </button>
      </nav>
    </aside>
  `;

  // Inicializamos el estado visual de los botones del header y del drawer
  updateHeaderState({ currentView, currentViewDate });
  updateHeaderThemeButton(activeTheme);

  // Evento del botón izquierdo: Flecha <- o abrir/cerrar Side Drawer
  const leftBtn = document.getElementById('header-left-btn');
  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      if (isBackArrowMode) {
        if (typeof onBackToCalendar === 'function') {
          onBackToCalendar();
        }
      } else {
        toggleSideDrawer();
      }
    });
  }

  // Botón de las 3 rayas dentro del propio Drawer y clic en el Backdrop cierran el menú
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const backdrop = document.getElementById('drawer-backdrop');

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeSideDrawer);
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeSideDrawer);
  }

  // Opción 1 del Drawer: "Día Actual"
  const todayItemBtn = document.getElementById('menu-item-today');
  if (todayItemBtn) {
    todayItemBtn.addEventListener('click', () => {
      closeSideDrawer();
      if (typeof onSelectToday === 'function') {
        onSelectToday();
      }
    });
  }

  // Opción 2 del Drawer: "Vista por mes"
  const calendarItemBtn = document.getElementById('menu-item-calendar');
  if (calendarItemBtn) {
    calendarItemBtn.addEventListener('click', () => {
      closeSideDrawer();
      if (typeof onSelectCalendar === 'function') {
        onSelectCalendar();
      }
    });
  }

  // Evento derecho: Alternar tema Claro / Oscuro
  const themeBtn = document.getElementById('header-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = toggleTheme();
      updateHeaderThemeButton(newTheme);
    });
  }
}
