/**
 * js/ui/calendarView.js
 * Vista de Calendario Mensual utilizando `vanilla-calendar-pro`.
 *
 * Características:
 * - Cabecera personalizada con el nombre del mes en grande a la izquierda y el año a la derecha.
 * - Leyenda flotante compacta ubicada justo debajo de la cabecera del mes y arriba del calendario.
 * - Sincronización en Vista Dividida: si `isSplitViewEnabled()` es `true`, al hacer clic en un día
 *   actualiza únicamente el panel izquierdo con `renderTaskList(clickedDateStr)` sin salir de la
 *   vista dividida. En móvil o Vista Simple, cambia a la vista diaria (`switchView('daily')`).
 */

import VanillaCalendar from 'vanilla-calendar-pro';
import { getAllTasks, getAllDailyLogs } from '../db/db.js';
import { getTodayString } from '../logic/dateUtils.js';
import { shouldTaskAppearOnDate } from '../logic/recurrence.js';
import { calculateDayStatus } from '../logic/dayStatus.js';
import { setViewDate, switchView, isSplitViewEnabled } from '../main.js';
import { renderTaskList } from './taskList.js';

// Nombres completos de los meses en español para la cabecera personalizada
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Recordamos el último mes visualizado para mantenerlo al refrescar en Escritorio
let activeCalendarMonth = new Date().getMonth();

// Íconos de estado para las celdas del calendario y la leyenda
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
 * Actualiza el título personalizado del mes cuando el usuario navega con las flechas o swipe.
 *
 * @param {number} monthIndex - Índice del mes (0 = Enero ... 11 = Diciembre).
 */
function updateCustomMonthTitle(monthIndex) {
  const monthTitleEl = document.getElementById('calendar-custom-month-title');
  if (monthTitleEl && MONTH_NAMES[monthIndex]) {
    monthTitleEl.textContent = MONTH_NAMES[monthIndex];
  }
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

      // Si el gesto comenzó en el borde izquierdo (< 50px) deslizando hacia la derecha,
      // corresponde al gesto global de abrir el Side Drawer, por lo que no cambiamos de mes.
      if (startX < 50 && deltaX > 0) {
        return;
      }

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
 * Renderiza la Vista de Calendario Mensual dentro de `#calendar-view-container` (o `#app-main`).
 *
 * @param {Object} [options]
 * @param {boolean} [options.preserveHeaderDate=false] - En Vista Dividida conserva la fecha seleccionada en el Header.
 */
export async function renderCalendarView({ preserveHeaderDate = false } = {}) {
  const calendarContainer =
    document.getElementById('calendar-view-container') ||
    document.getElementById('app-main');

  if (!calendarContainer) return;

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

    const currentYear = new Date().getFullYear();

    if (!preserveHeaderDate) {
      setViewDate(getTodayString());
    }

    const initialMonthName = MONTH_NAMES[activeCalendarMonth] || MONTH_NAMES[new Date().getMonth()];

    // 2. Renderizamos la cabecera personalizada (Mes a la izquierda, Año a la derecha),
    //    seguida de la leyenda compacta flotante y la tarjeta del calendario.
    calendarContainer.innerHTML = `
      <section class="calendar-view-section">
        <div class="calendar-custom-header">
          <h2 class="calendar-month-title" id="calendar-custom-month-title">${initialMonthName}</h2>
          <span class="calendar-year-subtitle">Año ${currentYear}</span>
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

        <div class="calendar-card" id="calendar-swipe-area">
          <div id="tracky-calendar"></div>
        </div>
      </section>
    `;

    // 3. Configuramos VanillaCalendar ocultando su título de mes/año por defecto en DOMTemplates
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
        selected: {
          month: activeCalendarMonth,
          year: currentYear
        },
        selection: {
          day: 'single',
          month: false,
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
         * Al hacer clic en las flechas (< o >) o hacer swipe, actualizamos el nombre del mes
         * en nuestro encabezado personalizado.
         */
        clickArrow(event, self) {
          activeCalendarMonth = self.selectedMonth;
          updateCustomMonthTitle(self.selectedMonth);
        },

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
         * Al hacer clic en cualquier día del calendario:
         * - Si está en Vista Dividida en Escritorio (`isSplitViewEnabled()`), actualiza
         *   únicamente el panel izquierdo con `renderTaskList(clickedDateStr)`.
         * - En Móvil o en Vista Simple, cambia a la vista diaria (`switchView('daily')`).
         */
        clickDay(event, self) {
          const dayBtn = event.target.closest('[data-calendar-day]');
          const clickedDateStr =
            (dayBtn && dayBtn.dataset.calendarDay) ||
            (self.selectedDates && self.selectedDates[0]);

          if (!clickedDateStr) return;

          setViewDate(clickedDateStr);

          if (isSplitViewEnabled()) {
            renderTaskList(clickedDateStr);
          } else {
            switchView('daily');
          }
        }
      }
    };

    const calendar = new VanillaCalendar('#tracky-calendar', calendarOptions);
    calendar.init();
    updateCustomMonthTitle(calendar.selectedMonth);

    // 4. Activamos soporte de gesto táctil (swipe) para cambiar de mes deslizando en móvil
    const swipeArea = document.getElementById('calendar-swipe-area');
    if (swipeArea) {
      enableCalendarSwipe(swipeArea);
    }
  } catch (error) {
    console.error('[Tracky Calendar] Error al renderizar el calendario mensual:', error);
  }
}
