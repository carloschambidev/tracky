/**
 * js/main.js
 * Punto de entrada principal de Tracky (SPA).
 * Gestiona el estado global de la fecha seleccionada (`currentViewDate`),
 * el modo de Vista Dividida opcional en Escritorio (`isSplitViewActive`),
 * el enrutamiento entre vistas ('daily' y 'calendar'), el Header y el botón flotante (FAB).
 */

import { initDB } from './db/db.js';
import { getTodayString } from './logic/dateUtils.js';
import { initTheme } from './ui/theme.js';
import { renderHeader, updateHeaderState, updateSplitViewButton } from './ui/header.js';
import { renderTaskList } from './ui/taskList.js';
import { renderCalendarView } from './ui/calendarView.js';
import { openModal } from './ui/modal.js';

// Estado global de la vista activa ('daily' | 'calendar')
let currentView = 'daily';

// Estado global de la fecha seleccionada en formato 'YYYY-MM-DD'
let currentViewDate = getTodayString();

// Estado global de la Vista Dividida en Escritorio (por defecto false: Vista Simple amplia)
let isSplitViewActive = false;

// Media query para detectar pantalla de Escritorio (>= 1024px)
const desktopMediaQuery = window.matchMedia('(min-width: 1024px)');

/**
 * Indica si la Vista Dividida está activa y la pantalla es de escritorio (>= 1024px).
 *
 * @returns {boolean}
 */
export function isSplitViewEnabled() {
  return isSplitViewActive && desktopMediaQuery.matches;
}

/**
 * Retorna la fecha actualmente seleccionada en la aplicación ('YYYY-MM-DD').
 *
 * @returns {string}
 */
export function getViewDate() {
  return currentViewDate;
}

/**
 * Asegura que dentro de `#app-main` existan los dos contenedores de panel
 * (`#daily-view-container` para la lista y `#calendar-view-container` para el calendario).
 */
function ensureSplitViewContainers() {
  const mainContainer = document.getElementById('app-main');
  if (!mainContainer) return;

  if (!document.getElementById('daily-view-container') || !document.getElementById('calendar-view-container')) {
    mainContainer.innerHTML = `
      <div id="daily-view-container" class="view-pane daily-pane"></div>
      <div id="calendar-view-container" class="view-pane calendar-pane"></div>
    `;
  }
}

/**
 * Actualiza la fecha seleccionada (`currentViewDate`) y sincroniza el Header:
 * - Si `dateString` es igual a hoy (`getTodayString()`), muestra el menú hamburguesa.
 * - Si es un día pasado o futuro, muestra la flecha (<-).
 *
 * @param {string} dateString - Fecha en formato 'YYYY-MM-DD'.
 */
export function setViewDate(dateString) {
  currentViewDate = dateString || getTodayString();
  updateHeaderState({
    currentView,
    currentViewDate
  });
}

/**
 * Alterna el modo de Vista Dividida (`isSplitViewActive`) en Escritorio,
 * actualiza la clase `.split-view-active` en `#app-main` y el estado del botón en el Header.
 */
export async function toggleSplitView() {
  isSplitViewActive = !isSplitViewActive;

  const mainContainer = document.getElementById('app-main');
  if (mainContainer) {
    mainContainer.classList.toggle('split-view-active', isSplitViewEnabled());
  }

  updateSplitViewButton(isSplitViewActive);
  await switchView(currentView);
}

/**
 * Renderiza la interfaz según la vista seleccionada y si la Vista Dividida está activa:
 * - Si `isSplitViewEnabled() === true`: Muestra ambas columnas simultáneamente
 *   (Lista Diaria a la izquierda y Calendario Mensual a la derecha).
 * - Si `isSplitViewEnabled() === false`: Muestra únicamente la vista activa (`'daily'` o `'calendar'`).
 *
 * @param {'daily' | 'calendar'} viewName
 */
export async function switchView(viewName) {
  currentView = viewName === 'calendar' ? 'calendar' : 'daily';

  ensureSplitViewContainers();

  const mainContainer = document.getElementById('app-main');
  const dailyPane = document.getElementById('daily-view-container');
  const calendarPane = document.getElementById('calendar-view-container');
  const fabButton = document.getElementById('fab-add-task');

  if (mainContainer) {
    mainContainer.classList.toggle('split-view-active', isSplitViewEnabled());
  }

  // Sincronizamos el Header (ícono hamburguesa vs flecha <- y título de fecha)
  updateHeaderState({
    currentView,
    currentViewDate
  });

  if (isSplitViewEnabled()) {
    // Vista Dividida en Escritorio: Ambos paneles visibles al mismo tiempo
    if (dailyPane) dailyPane.classList.remove('pane-hidden');
    if (calendarPane) calendarPane.classList.remove('pane-hidden');

    await Promise.all([
      renderTaskList(currentViewDate),
      renderCalendarView({ preserveHeaderDate: true })
    ]);
    return;
  }

  // Vista Simple (por defecto en escritorio y siempre en móvil): Alterna una sola vista
  if (currentView === 'calendar') {
    if (dailyPane) dailyPane.classList.add('pane-hidden');
    if (calendarPane) calendarPane.classList.remove('pane-hidden');
    if (fabButton) fabButton.classList.add('hidden');

    await renderCalendarView({ preserveHeaderDate: false });
  } else {
    if (calendarPane) calendarPane.classList.add('pane-hidden');
    if (dailyPane) dailyPane.classList.remove('pane-hidden');

    await renderTaskList(currentViewDate);
  }
}

/**
 * Crea e inyecta el botón flotante (+) para agregar nuevos hábitos
 * y configura su listener para abrir el modal en la fecha activa (`currentViewDate`).
 */
function setupFloatingActionButton() {
  let fabButton = document.getElementById('fab-add-task');

  if (!fabButton) {
    fabButton = document.createElement('button');
    fabButton.id = 'fab-add-task';
    fabButton.type = 'button';
    fabButton.className = 'fab-button';
    fabButton.setAttribute('aria-label', 'Crear nuevo hábito');
    fabButton.setAttribute('title', 'Nuevo hábito');
    fabButton.textContent = '+';
    document.body.appendChild(fabButton);
  }

  fabButton.addEventListener('click', () => {
    openModal(null, currentViewDate);
  });
}

/**
 * Registra el Service Worker (`sw.js`) si el navegador lo soporta,
 * permitiendo que la PWA funcione 100% offline.
 */
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

/**
 * Función principal de arranque de la aplicación.
 */
async function initApp() {
  try {
    // 1. Inicializa el tema visual (localStorage o prefers-color-scheme)
    initTheme();

    // 2. Inicializa la conexión y estructura de IndexedDB
    await initDB();

    // 3. Renderiza el Header fijo con soporte para Menú Lateral, Flecha <- y botón "Dividir vista"
    renderHeader({
      currentView,
      currentViewDate,
      isSplitViewActive,
      onSelectToday: () => {
        setViewDate(getTodayString());
        switchView('daily');
      },
      onSelectCalendar: () => {
        switchView('calendar');
      },
      onBackToCalendar: () => {
        if (isSplitViewEnabled()) {
          // En Vista Dividida el calendario ya está a la derecha; la flecha regresa al Día Actual
          setViewDate(getTodayString());
          renderTaskList(getTodayString());
        } else {
          switchView('calendar');
        }
      },
      onToggleSplitView: () => {
        toggleSplitView();
      }
    });

    // 4. Configura el botón flotante (+) para abrir el modal de creación
    setupFloatingActionButton();

    // 5. Renderiza la vista inicial ('daily' en Vista Simple por defecto)
    await switchView('daily');

    // 6. Escucha cambios de tamaño de ventana (Móvil <-> Escritorio)
    desktopMediaQuery.addEventListener('change', () => {
      switchView(currentView);
    });

    // 7. Cuando la Vista Dividida está activa y cambian tareas o estados en la columna izquierda,
    //    refrescamos automáticamente el calendario en la columna derecha.
    window.addEventListener('tracky:data-changed', () => {
      if (isSplitViewEnabled()) {
        renderCalendarView({ preserveHeaderDate: true });
      }
    });

    // 8. Registra el Service Worker para soporte offline
    await registerServiceWorker();

    console.log('Tracky App Iniciada');
  } catch (error) {
    console.error('[Tracky Error] Fallo crítico al inicializar la aplicación:', error);
  }
}

// Ejecuta initApp cuando el árbol DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initApp);
