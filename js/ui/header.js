/**
 * js/ui/header.js
 * Renderizado y control de eventos de la barra de navegación superior (`#app-header`),
 * botón de "Dividir vista" (visible en Escritorio con texto y en Móvil solo con ícono)
 * y Menú Lateral Deslizante (Side Drawer).
 *
 * Estructura visual del Header:
 * [Menú] [Tracky] ----- [Fecha] ----- [Dividir Vista] [Tema]
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

// Ícono SVG para el botón "Dividir vista" (Dos columnas)
const SPLIT_VIEW_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="12" y1="3" x2="12" y2="21"></line>
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
let isSwipeInitialized = false;

/**
 * Abre el menú lateral (Side Drawer) y su fondo oscuro (Backdrop).
 */
export function openSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const leftBtn = document.getElementById('header-left-btn');

  if (!drawer || !backdrop) return;

  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  if (leftBtn && !isBackArrowMode) {
    leftBtn.setAttribute('aria-expanded', 'true');
  }
}

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
  if (!drawer) return;

  if (drawer.classList.contains('open')) {
    closeSideDrawer();
  } else {
    openSideDrawer();
  }
}

/**
 * Actualiza el estado visual (activo / inactivo) del botón "Dividir vista" en el Header.
 *
 * @param {boolean} isActive
 */
export function updateSplitViewButton(isActive) {
  const splitBtn = document.getElementById('header-split-view-btn');
  if (!splitBtn) return;

  splitBtn.classList.toggle('active', Boolean(isActive));
  splitBtn.setAttribute('aria-pressed', String(Boolean(isActive)));
}

/**
 * Configura el gesto táctil (Swipe) en el documento:
 * - Si el toque comienza en el borde izquierdo (`clientX < 50`) y se desliza hacia la derecha
 *   (`deltaX > 60`) de forma mayormente horizontal, abre el Side Drawer.
 * - Si el Side Drawer está abierto y se desliza hacia la izquierda (`deltaX < -60`), lo cierra.
 */
function setupDrawerSwipeGesture() {
  if (isSwipeInitialized) return;
  isSwipeInitialized = true;

  const EDGE_THRESHOLD = 50;
  const MIN_SWIPE_DISTANCE = 60;

  let startX = 0;
  let startY = 0;
  let isTrackingSwipe = false;
  let isVerticalScroll = false;

  document.addEventListener(
    'touchstart',
    (event) => {
      if (!event.touches || event.touches.length !== 1) return;

      const drawer = document.getElementById('side-drawer');
      const isDrawerOpen = drawer && drawer.classList.contains('open');
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      if (touchX < EDGE_THRESHOLD || isDrawerOpen) {
        startX = touchX;
        startY = touchY;
        isTrackingSwipe = true;
        isVerticalScroll = false;
      } else {
        isTrackingSwipe = false;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!isTrackingSwipe || isVerticalScroll || !event.touches || event.touches.length !== 1) {
        return;
      }

      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
        isVerticalScroll = true;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (event) => {
      if (!isTrackingSwipe || isVerticalScroll || !event.changedTouches || event.changedTouches.length === 0) {
        isTrackingSwipe = false;
        return;
      }

      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      isTrackingSwipe = false;

      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.3) {
        return;
      }

      const drawer = document.getElementById('side-drawer');
      const isDrawerOpen = drawer && drawer.classList.contains('open');

      if (!isDrawerOpen && !isBackArrowMode && startX < EDGE_THRESHOLD && deltaX > MIN_SWIPE_DISTANCE) {
        openSideDrawer();
        return;
      }

      if (isDrawerOpen && deltaX < -MIN_SWIPE_DISTANCE) {
        closeSideDrawer();
      }
    },
    { passive: true }
  );
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

  if (dateDisplay && currentViewDate) {
    const selectedDateObj = new Date(`${currentViewDate}T00:00:00`);
    dateDisplay.textContent = formatHeaderDate(selectedDateObj);
  }

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
 * @param {boolean} [options.isSplitViewActive=false]
 * @param {Function} options.onSelectToday - Acción al elegir "Día Actual".
 * @param {Function} options.onSelectCalendar - Acción al elegir "Vista por mes".
 * @param {Function} options.onBackToCalendar - Acción al pulsar la flecha <-.
 * @param {Function} options.onToggleSplitView - Acción al pulsar "Dividir vista".
 */
export function renderHeader({
  currentView = 'daily',
  currentViewDate = getTodayString(),
  isSplitViewActive = false,
  onSelectToday,
  onSelectCalendar,
  onBackToCalendar,
  onToggleSplitView
} = {}) {
  const headerContainer = document.getElementById('app-header');
  if (!headerContainer) return;

  const formattedDate = formatHeaderDate(new Date(`${currentViewDate}T00:00:00`));
  const activeTheme = getCurrentTheme();

  headerContainer.innerHTML = `
    <div class="header-inner">
      <!-- Grupo Izquierdo: [Menú] [Tracky] -->
      <div class="header-left-group">
        <button
          type="button"
          id="header-left-btn"
          class="header-icon-btn"
          aria-haspopup="true"
          aria-expanded="false"
        ></button>
        <span class="header-brand-title">Tracky</span>
      </div>

      <!-- Centro: [Fecha] -->
      <h1 class="header-date-title" id="header-date-display">${formattedDate}</h1>

      <!-- Grupo Derecho: [Dividir Vista] [Tema] -->
      <div class="header-right-actions">
        <button
          type="button"
          id="header-split-view-btn"
          class="header-split-btn ${isSplitViewActive ? 'active' : ''}"
          aria-label="Dividir vista"
          aria-pressed="${Boolean(isSplitViewActive)}"
          title="Dividir vista"
        >
          ${SPLIT_VIEW_ICON_SVG}
          <span class="split-btn-label">Dividir vista</span>
        </button>

        <button
          type="button"
          id="header-theme-btn"
          class="header-icon-btn"
        ></button>
      </div>
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

  updateHeaderState({ currentView, currentViewDate });
  updateHeaderThemeButton(activeTheme);
  updateSplitViewButton(isSplitViewActive);

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

  // Evento del botón "Dividir vista" (Móvil y Escritorio)
  const splitViewBtn = document.getElementById('header-split-view-btn');
  if (splitViewBtn && typeof onToggleSplitView === 'function') {
    splitViewBtn.addEventListener('click', () => {
      onToggleSplitView();
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
