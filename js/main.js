/**
 * js/main.js
 * Punto de entrada principal de Tracky (SPA).
 * Gestiona el estado global de la fecha seleccionada (`currentViewDate`),
 * el enrutamiento entre vistas ('daily' y 'calendar'), el Header y el botón flotante (FAB).
 */

import { initDB } from './db/db.js';
import { getTodayString } from './logic/dateUtils.js';
import { initTheme } from './ui/theme.js';
import { renderHeader, updateHeaderState } from './ui/header.js';
import { renderTaskList } from './ui/taskList.js';
import { renderCalendarView } from './ui/calendarView.js';
import { openModal } from './ui/modal.js';

// Estado global de la vista activa ('daily' | 'calendar')
let currentView = 'daily';

// Estado global de la fecha seleccionada en formato 'YYYY-MM-DD'
let currentViewDate = getTodayString();

/**
 * Retorna la fecha actualmente seleccionada en la aplicación ('YYYY-MM-DD').
 *
 * @returns {string}
 */
export function getViewDate() {
  return currentViewDate;
}

/**
 * Actualiza la fecha seleccionada (`currentViewDate`) y sincroniza el Header:
 * - Si `dateString` es igual a hoy (`getTodayString()`), muestra el menú hamburguesa.
 * - Si es un día pasado o futuro, muestra la flecha (<-) para volver al calendario.
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
 * Alterna y renderiza la vista principal dentro de `#app-main`.
 * - Si `viewName === 'daily'`, llama a `renderTaskList(currentViewDate)`.
 * - Si `viewName === 'calendar'`, llama a `renderCalendarView()` y oculta el botón FAB.
 *
 * @param {'daily' | 'calendar'} viewName
 */
export async function switchView(viewName) {
  currentView = viewName === 'calendar' ? 'calendar' : 'daily';

  // Sincronizamos el Header (ícono hamburguesa vs flecha <- y título de fecha)
  updateHeaderState({
    currentView,
    currentViewDate
  });

  const fabButton = document.getElementById('fab-add-task');

  if (currentView === 'calendar') {
    if (fabButton) fabButton.classList.add('hidden');
    await renderCalendarView();
  } else {
    // En la vista diaria, renderTaskList gestiona también la visibilidad del FAB según si es pasado/hoy/futuro
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

    // 3. Renderiza el Header fijo con soporte para Menú Hamburguesa y Flecha de retorno
    renderHeader({
      currentView,
      currentViewDate,
      onSelectToday: () => {
        setViewDate(getTodayString());
        switchView('daily');
      },
      onSelectCalendar: () => {
        switchView('calendar');
      },
      onBackToCalendar: () => {
        switchView('calendar');
      }
    });

    // 4. Configura el botón flotante (+) para abrir el modal de creación
    setupFloatingActionButton();

    // 5. Renderiza la vista inicial ('daily') con la fecha actual
    await switchView('daily');

    // 6. Registra el Service Worker para soporte offline
    await registerServiceWorker();

    console.log('Tracky App Iniciada');
  } catch (error) {
    console.error('[Tracky Error] Fallo crítico al inicializar la aplicación:', error);
  }
}

// Ejecuta initApp cuando el árbol DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initApp);
