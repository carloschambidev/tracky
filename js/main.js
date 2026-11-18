/**
 * js/main.js
 * Punto de entrada principal de Tracky (SPA).
 *
 * Lógica táctil global dividida por mitades de pantalla:
 * - Mitad Superior (startY < window.innerHeight / 2):
 *   * Swipe de izquierda a derecha -> Abre el menú lateral (openSideDrawer).
 *   * Swipe de derecha a izquierda -> Si el menú está abierto, lo cierra (closeSideDrawer).
 * - Mitad Inferior (startY >= window.innerHeight / 2):
 *   * Si el calendario está en pantalla (Vista Dividida o Vista de Calendario sola):
 *     - Swipe de izquierda a derecha -> Retrocede un mes (changeCalendarMonth(-1)).
 *     - Swipe de derecha a izquierda -> Avanza un mes (changeCalendarMonth(1)).
 */

import { initDB } from './db/db.js';
import { getTodayString } from './logic/dateUtils.js';
import { initTheme } from './ui/theme.js';
import {
  renderHeader,
  updateHeaderState,
  updateSplitViewButton,
  openSideDrawer,
  closeSideDrawer
} from './ui/header.js';
import { renderTaskList } from './ui/taskList.js';
import { renderCalendarView, changeCalendarMonth } from './ui/calendarView.js';
import { openModal } from './ui/modal.js';

let currentView = 'daily';
let currentViewDate = getTodayString();

let isSplitViewActive = false;
let isMobileSplitView = false;
let globalSwipeInitialized = false;

const desktopMediaQuery = window.matchMedia('(min-width: 1024px)');
const landscapeMediaQuery = window.matchMedia('(max-width: 1023px) and (orientation: landscape)');

export function isSplitViewEnabled() {
  if (desktopMediaQuery.matches) {
    return isSplitViewActive;
  }
  return isMobileSplitView;
}

export function getViewDate() {
  return currentViewDate;
}

export function setViewDate(dateString) {
  currentViewDate = dateString || getTodayString();
  updateHeaderState({
    currentView,
    currentViewDate
  });
}

function getOrCreateFabButton() {
  let fabButton = document.getElementById('fab-add-task');

  if (!fabButton) {
    fabButton = document.createElement('button');
    fabButton.id = 'fab-add-task';
    fabButton.type = 'button';
    fabButton.className = 'fab-button';
    fabButton.setAttribute('aria-label', 'Crear nuevo hábito');
    fabButton.setAttribute('title', 'Nuevo hábito');
    fabButton.textContent = '+';
    fabButton.addEventListener('click', () => {
      openModal(null, currentViewDate);
    });
  }

  return fabButton;
}

/**
 * Procesa el gesto de swipe dividiendo la pantalla en Mitad Superior y Mitad Inferior.
 *
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 */
function handleScreenHalfSwipe(startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const SWIPE_MIN_DISTANCE = 45;

  // Verificamos que el deslizamiento sea predominantemente horizontal
  if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY)) {
    return;
  }

  const halfScreenY = window.innerHeight / 2;
  const drawer = document.getElementById('side-drawer');
  const isDrawerOpen = Boolean(drawer && drawer.classList.contains('open'));

  // ZONA 1: De la mitad de la pantalla para arriba (startY < mitad) -> Menú Toggle
  if (startY < halfScreenY) {
    if (deltaX > 0 && !isDrawerOpen) {
      // Deslizar de izquierda a derecha -> Abre el menú
      openSideDrawer();
    } else if (deltaX < 0 && isDrawerOpen) {
      // Deslizar de derecha a izquierda con el menú abierto -> Cierra el menú
      closeSideDrawer();
    }
    return;
  }

  // ZONA 2: De la mitad de la pantalla para abajo (startY >= mitad) -> Calendario
  // Si el menú está abierto y desliza a la izquierda en cualquier parte, también permite cerrarlo
  if (isDrawerOpen) {
    if (deltaX < 0) {
      closeSideDrawer();
    }
    return;
  }

  const isCalendarOnScreen = isSplitViewEnabled() || currentView === 'calendar';
  if (isCalendarOnScreen) {
    if (deltaX > 0) {
      // Deslizar de izquierda a derecha -> Retrocede un mes
      changeCalendarMonth(-1);
    } else if (deltaX < 0) {
      // Deslizar de derecha a izquierda -> Avanza un mes
      changeCalendarMonth(1);
    }
  }
}

/**
 * Inicializa un único listener global en `window` para capturar gestos táctiles
 * (`touchstart`/`touchmove`/`touchend`) en celulares reales y arrastre con mouse
 * (`pointerdown`/`pointerup`) en simuladores de escritorio.
 */
export function setupSwipeGestures() {
  if (globalSwipeInitialized) return;
  globalSwipeInitialized = true;

  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let isTouching = false;
  let isMouseDown = false;

  // 1. Eventos Touch nativos para iOS / Android (nunca se pierden al re-renderizar el DOM)
  window.addEventListener(
    'touchstart',
    (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      lastY = startY;
      isTouching = true;
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (!isTouching || !e.touches || e.touches.length !== 1) return;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    'touchend',
    (e) => {
      if (!isTouching) return;
      isTouching = false;

      const endX =
        e.changedTouches && e.changedTouches.length > 0
          ? e.changedTouches[0].clientX
          : lastX;
      const endY =
        e.changedTouches && e.changedTouches.length > 0
          ? e.changedTouches[0].clientY
          : lastY;

      handleScreenHalfSwipe(startX, startY, endX, endY);
    },
    { passive: true }
  );

  // 2. Respaldo con Mouse para poder probar el swipe arrastrando con el cursor en PC/Simulador
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
    isMouseDown = true;
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse' || !isMouseDown) return;
    isMouseDown = false;
    handleScreenHalfSwipe(startX, startY, e.clientX, e.clientY);
  });
}

function syncSplitLayoutClasses() {
  const mainContainer = document.getElementById('app-main');
  if (!mainContainer) return;

  const isDesktop = desktopMediaQuery.matches;
  const isMobileLandscape = landscapeMediaQuery.matches;

  const applyDesktopColumns = (isDesktop && isSplitViewActive) || (isMobileLandscape && isMobileSplitView);
  const applyMobileVerticalSplit = !isDesktop && !isMobileLandscape && isMobileSplitView;

  mainContainer.classList.toggle('split-view-active', applyDesktopColumns);
  mainContainer.classList.toggle('mobile-split-active', applyMobileVerticalSplit);

  updateSplitViewButton(isSplitViewEnabled());
}

export async function toggleSplitView() {
  if (desktopMediaQuery.matches) {
    isSplitViewActive = !isSplitViewActive;
    isMobileSplitView = isSplitViewActive;
  } else {
    isMobileSplitView = !isMobileSplitView;
    isSplitViewActive = isMobileSplitView;
  }

  await switchView(currentView);
}

export async function switchView(viewName) {
  currentView = viewName === 'calendar' ? 'calendar' : 'daily';

  const mainContainer = document.getElementById('app-main');
  if (!mainContainer) return;

  const fabButton = getOrCreateFabButton();
  syncSplitLayoutClasses();

  updateHeaderState({
    currentView,
    currentViewDate
  });

  if (isSplitViewEnabled()) {
    mainContainer.innerHTML = `
      <div id="mobile-list-panel" style="flex: 45; overflow-y: auto; position: relative; padding: 1rem;"></div>
      <div id="mobile-calendar-panel" style="flex: 55; overflow: hidden; padding: 0.5rem; border-top: 1px solid var(--border-color);"></div>
    `;

    const listPanel = document.getElementById('mobile-list-panel');
    const calendarPanel = document.getElementById('mobile-calendar-panel');

    await Promise.all([
      renderTaskList(currentViewDate, listPanel),
      renderCalendarView({ preserveHeaderDate: true, targetContainer: calendarPanel })
    ]);

    if (listPanel && fabButton.parentElement !== listPanel) {
      listPanel.appendChild(fabButton);
    }
    return;
  }

  // Modo Dividido INACTIVO (Vista simple)
  if (fabButton.parentElement !== document.body) {
    document.body.appendChild(fabButton);
  }

  if (currentView === 'calendar') {
    fabButton.classList.add('hidden');
    await renderCalendarView({ preserveHeaderDate: false, targetContainer: mainContainer });
  } else {
    await renderTaskList(currentViewDate, mainContainer);
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('[Tracky PWA] Service Worker registrado con ámbito:', registration.scope);
    } catch (error) {
      console.warn('[Tracky PWA] No se pudo registrar el Service Worker:', error);
    }
  }
}

async function initApp() {
  try {
    initTheme();
    await initDB();

    getOrCreateFabButton();

    renderHeader({
      currentView,
      currentViewDate,
      isSplitViewActive: isSplitViewEnabled(),
      onSelectToday: () => {
        setViewDate(getTodayString());
        switchView('daily');
      },
      onSelectCalendar: () => {
        switchView('calendar');
      },
      onBackToCalendar: () => {
        if (isSplitViewEnabled()) {
          setViewDate(getTodayString());
          const listPanel = document.getElementById('mobile-list-panel');
          renderTaskList(getTodayString(), listPanel);
          const calendarPanel = document.getElementById('mobile-calendar-panel');
          renderCalendarView({ preserveHeaderDate: true, targetContainer: calendarPanel });
        } else {
          switchView('calendar');
        }
      },
      onToggleSplitView: () => {
        toggleSplitView();
      }
    });

    await switchView('daily');

    desktopMediaQuery.addEventListener('change', () => {
      switchView(currentView);
    });
    landscapeMediaQuery.addEventListener('change', () => {
      switchView(currentView);
    });

    window.addEventListener('tracky:data-changed', () => {
      if (isSplitViewEnabled()) {
        const calendarPanel = document.getElementById('mobile-calendar-panel');
        renderCalendarView({ preserveHeaderDate: true, targetContainer: calendarPanel });
      }
    });

    setupSwipeGestures();
    await registerServiceWorker();

    console.log('Tracky App Iniciada');
  } catch (error) {
    console.error('[Tracky Error] Fallo crítico al inicializar la aplicación:', error);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
