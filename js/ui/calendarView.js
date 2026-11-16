/**
 * js/ui/calendarView.js
 * Vista de Calendario Mensual utilizando `vanilla-calendar-pro`.
 *
 * Características:
 * - Navegación restringida únicamente al año en curso (Ene - Dic).
 * - Oculta los días de meses adyacentes (`daysOutside: false`).
 * - Selección de día activa (`selection.day: 'single'`): permite hacer clic en cualquier
 *   día (pasado, hoy o futuro) para navegar a su Vista Diaria mediante `setViewDate(dateStr)`
 *   y `switchView('daily')`.
 * - Soporte de gesto táctil (swipe horizontal) para cambiar de mes.
 * - Cálculo en memoria (una sola consulta a IndexedDB) del estado de cada día.
 */

import VanillaCalendar from 'vanilla-calendar-pro';
import { getAllTasks, getAllDailyLogs } from '../db/db.js';
import { getTodayString } from '../logic/dateUtils.js';
import { shouldTaskAppearOnDate } from '../logic/recurrence.js';
import { calculateDayStatus } from '../logic/dayStatus.js';
import { setViewDate, switchView } from '../main.js';

// Íconos de estado para las celdas del calendario
const STATUS_ICONS = {
  completed: `
    <span class="calendar-day-status status-completed" title="Completado" aria-label="Completado">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </span>
  `,
  partial: `
    <span class="calendar-day-status status-partial" title="Parcialmente completado" aria-label="Parcialmente completado">
      <span class="status-dot"></span>
    </span>
  `,
  uncompleted: `
    <span class="calendar-day-status status-uncompleted" title="No completado" aria-label="No completado">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </span>
  `,
  empty: `
    <span class="calendar-day-status status-empty" aria-hidden="true"></span>
  `
};

/**
 * Calcula en memoria el estado ('completed', 'partial', 'uncompleted', 'empty')
 * de una fecha específica ('YYYY-MM-DD') usando las tareas y logs precargados.
 * Nota: Para días futuros (posteriores a hoy) no mostramos cruz roja de incumplimiento
 * ya que aún no han ocurrido; si tienen tareas programadas o no, se mantienen limpios ('empty')
 * o se evalúan según el registro existente.
 *
 * @param {string} dateStr - Fecha en formato 'YYYY-MM-DD'.
 * @param {Array<Object>} allTasks - Lista completa de tareas en memoria.
 * @param {Map<string, Object<string, boolean>>} logsMap - Mapa fecha -> tasksStatus en memoria.
 * @returns {'empty' | 'completed' | 'partial' | 'uncompleted'}
 */
function getDayStatusInMemory(dateStr, allTasks, logsMap) {
  const activeTasks = allTasks.filter((task) =>
    shouldTaskAppearOnDate(task, dateStr)
  );

  if (activeTasks.length === 0) {
    return 'empty';
  }

  const taskStatuses = logsMap.get(dateStr) || {};
  return calculateDayStatus(activeTasks, taskStatuses);
}

/**
 * Inyecta la estructura personalizada (número arriba + ícono de estado debajo)
 * dentro de un botón de día de VanillaCalendar.
 *
 * @param {HTMLElement} dayBtnEl - Botón `.vanilla-calendar-day__btn` de la celda.
 * @param {number|string} dayNumber - Número del día del mes.
 * @param {'empty' | 'completed' | 'partial' | 'uncompleted'} status - Estado calculado del día.
 */
function renderDayCellContent(dayBtnEl, dayNumber, status) {
  if (!dayBtnEl) return;

  const iconHTML = STATUS_ICONS[status] || STATUS_ICONS.empty;
  dayBtnEl.classList.add('tracky-calendar-day-btn');
  dayBtnEl.dataset.dayStatus = status;

  dayBtnEl.innerHTML = `
    <span class="calendar-day-number">${dayNumber}</span>
    ${iconHTML}
  `;
}

/**
 * Habilita el gesto de deslizar horizontalmente (swipe táctil)
 * sobre el contenedor del calendario para cambiar al mes anterior o siguiente
 * dentro del año actual.
 *
 * @param {HTMLElement} calendarWrapper
 */
function enableCalendarSwipe(calendarWrapper) {
  let startX = 0;
  let startY = 0;
  const SWIPE_THRESHOLD = 45;

  calendarWrapper.addEventListener(
    'touchstart',
    (event) => {
      if (!event.changedTouches || event.changedTouches.length === 0) return;
      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    },
    { passive: true }
  );

  calendarWrapper.addEventListener(
    'touchend',
    (event) => {
      if (!event.changedTouches || event.changedTouches.length === 0) return;
      const deltaX = event.changedTouches[0].clientX - startX;
      const deltaY = event.changedTouches[0].clientY - startY;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        if (deltaX < 0) {
          const nextBtn = calendarWrapper.querySelector('.vanilla-calendar-arrow_next');
          if (nextBtn && !nextBtn.disabled && nextBtn.style.visibility !== 'hidden') {
            nextBtn.click();
          }
        } else {
          const prevBtn = calendarWrapper.querySelector('.vanilla-calendar-arrow_prev');
          if (prevBtn && !prevBtn.disabled && prevBtn.style.visibility !== 'hidden') {
            prevBtn.click();
          }
        }
      }
    },
    { passive: true }
  );
}

/**
 * Renderiza la Vista de Calendario Mensual dentro de `#app-main`.
 */
export async function renderCalendarView() {
  const mainContainer = document.getElementById('app-main');
  if (!mainContainer) return;

  try {
    // 1. Obtenemos todas las tareas y todos los logs diarios de IndexedDB en 1 sola operación paralela
    const [allTasks, allDailyLogs] = await Promise.all([
      getAllTasks(),
      getAllDailyLogs()
    ]);

    // Construimos un Map en memoria para acceso O(1) por fecha 'YYYY-MM-DD'
    const logsMap = new Map();
    for (const log of allDailyLogs) {
      if (log && log.date) {
        logsMap.set(log.date, log.tasksStatus || {});
      }
    }

    // 2. Preparamos el contenedor del calendario y la leyenda de estados en #app-main
    const currentYear = new Date().getFullYear();

    // Aseguramos que el Header muestre la fecha de hoy y el menú hamburguesa mientras se explora el calendario
    setViewDate(getTodayString());

    mainContainer.innerHTML = `
      <section class="calendar-view-section">
        <div class="daily-view-header">
          <h2 class="daily-view-title">Resumen Mensual</h2>
          <span class="daily-view-counter">Año ${currentYear}</span>
        </div>

        <div class="calendar-card" id="calendar-swipe-area">
          <div id="tracky-calendar"></div>
        </div>

        <div class="calendar-legend" aria-label="Leyenda de estados del calendario">
          <div class="legend-item">
            ${STATUS_ICONS.completed}
            <span>Completado</span>
          </div>
          <div class="legend-item">
            ${STATUS_ICONS.partial}
            <span>Parcial</span>
          </div>
          <div class="legend-item">
            ${STATUS_ICONS.uncompleted}
            <span>Pendiente</span>
          </div>
        </div>
      </section>
    `;

    // 3. Configuramos e inicializamos VanillaCalendar con selección de días activa
    const calendarOptions = {
      type: 'default',
      date: {
        min: `${currentYear}-01-01`,
        max: `${currentYear}-12-31`,
        today: new Date()
      },
      settings: {
        lang: 'es',
        iso8601: true,
        range: {
          min: `${currentYear}-01-01`,
          max: `${currentYear}-12-31`
        },
        selection: {
          day: 'single', // Permite hacer clic en cualquier día (pasado, hoy o futuro)
          month: true,
          year: false
        },
        visibility: {
          daysOutside: false,
          weekend: true,
          today: true,
          theme: 'system'
        }
      },
      DOMTemplates: {
        default: `
          <div class="vanilla-calendar-header">
            <#ArrowPrev />
            <div class="vanilla-calendar-header__content">
              <#Month />
              <#Year />
            </div>
            <#ArrowNext />
          </div>
          <div class="vanilla-calendar-wrapper">
            <div class="vanilla-calendar-content">
              <#Week />
              <#Days />
            </div>
          </div>
        `
      },
      actions: {
        /**
         * Se ejecuta por cada celda de día al construir o cambiar de mes.
         */
        getDays(day, date, HTMLElement, HTMLButtonElement) {
          if (
            HTMLButtonElement.classList.contains('vanilla-calendar-day__btn_prev') ||
            HTMLButtonElement.classList.contains('vanilla-calendar-day__btn_next')
          ) {
            return;
          }

          const status = getDayStatusInMemory(date, allTasks, logsMap);
          renderDayCellContent(HTMLButtonElement, day, status);
        },

        /**
         * Al hacer clic en cualquier día del calendario (pasado, hoy o futuro),
         * actualizamos `currentViewDate` y navegamos a la vista diaria de esa fecha.
         */
        clickDay(event, self) {
          const dayBtn = event.target.closest('[data-calendar-day]');
          const clickedDateStr =
            (dayBtn && dayBtn.dataset.calendarDay) ||
            (self.selectedDates && self.selectedDates[0]);

          if (clickedDateStr) {
            setViewDate(clickedDateStr);
            switchView('daily');
          }
        }
      }
    };

    const calendar = new VanillaCalendar('#tracky-calendar', calendarOptions);
    calendar.init();

    // 4. Activamos soporte de gesto táctil (swipe) para cambiar de mes deslizando
    const swipeArea = document.getElementById('calendar-swipe-area');
    if (swipeArea) {
      enableCalendarSwipe(swipeArea);
    }
  } catch (error) {
    console.error('[Tracky Calendar] Error al renderizar el calendario mensual:', error);
  }
}
