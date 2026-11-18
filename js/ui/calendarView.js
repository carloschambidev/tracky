/**
 * js/ui/calendarView.js
 * Vista de Calendario Mensual utilizando `vanilla-calendar-pro`.
 */

import VanillaCalendar from 'vanilla-calendar-pro';
import { getAllTasks, getAllDailyLogs } from '../db/db.js';
import { getTodayString } from '../logic/dateUtils.js';
import { shouldTaskAppearOnDate } from '../logic/recurrence.js';
import { calculateDayStatus } from '../logic/dayStatus.js';
import { setViewDate, getViewDate, switchView, isSplitViewEnabled } from '../main.js';
import { renderTaskList } from './taskList.js';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

let activeCalendarMonth = new Date().getMonth();

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
 * Inyecta el contenido de la celda y aplica la clase `.tracky-day-selected`
 * si la fecha coincide con el día actualmente seleccionado (`getViewDate()`).
 */
function renderDayCellContent(dayBtnEl, dayNumber, status, dateStr) {
  if (!dayBtnEl) return;

  const iconHTML = STATUS_ICONS[status] || STATUS_ICONS.empty;
  dayBtnEl.classList.add('tracky-calendar-day-btn');
  dayBtnEl.dataset.dayStatus = status;

  // Aplicamos overlay visual de selección si este día es el que se está visualizando
  const selectedDateStr = getViewDate();
  dayBtnEl.classList.toggle('tracky-day-selected', dateStr === selectedDateStr);

  dayBtnEl.innerHTML = `
    <span class="calendar-day-number">${dayNumber}</span>
    ${iconHTML}
  `;
}

/**
 * Actualiza visualmente el overlay de selección (`.tracky-day-selected`) en todas las celdas
 * del calendario sin necesidad de reconstruir toda la instancia.
 *
 * @param {HTMLElement} calendarContainer
 * @param {string} selectedDateStr - Fecha seleccionada ('YYYY-MM-DD').
 */
function highlightSelectedDayInDOM(calendarContainer, selectedDateStr) {
  if (!calendarContainer) return;
  const allDayBtns = calendarContainer.querySelectorAll('[data-calendar-day]');
  allDayBtns.forEach((btn) => {
    const isSelected = btn.dataset.calendarDay === selectedDateStr;
    btn.classList.toggle('tracky-day-selected', isSelected);
    btn.classList.toggle('vanilla-calendar-day__btn_selected', isSelected);
  });
}

function updateCustomMonthTitle(monthIndex, rootContainer = document) {
  const monthTitleEl =
    rootContainer.querySelector('#calendar-custom-month-title') ||
    document.getElementById('calendar-custom-month-title');

  if (monthTitleEl && MONTH_NAMES[monthIndex]) {
    monthTitleEl.textContent = MONTH_NAMES[monthIndex];
  }
}

/**
 * Cambia el mes activo del calendario (+1 siguiente mes, -1 mes anterior)
 * restringido al año actual (0 = Enero ... 11 = Diciembre) y re-renderiza el calendario.
 *
 * @param {number} delta - +1 para mes siguiente, -1 para mes anterior.
 */
export async function changeCalendarMonth(delta) {
  const targetMonth = activeCalendarMonth + delta;
  if (targetMonth < 0 || targetMonth > 11) {
    return;
  }

  activeCalendarMonth = targetMonth;
  const targetContainer =
    document.getElementById('mobile-calendar-panel') ||
    document.getElementById('app-main');

  await renderCalendarView({
    preserveHeaderDate: true,
    targetContainer
  });
}

/**
 * Renderiza la Vista de Calendario Mensual en el contenedor indicado (`#mobile-calendar-panel` o `#app-main`).
 *
 * @param {Object} [options]
 * @param {boolean} [options.preserveHeaderDate=false]
 * @param {HTMLElement|null} [options.targetContainer=null]
 */
export async function renderCalendarView({ preserveHeaderDate = false, targetContainer = null } = {}) {
  const calendarContainer =
    targetContainer ||
    document.getElementById('mobile-calendar-panel') ||
    document.getElementById('app-main');

  if (!calendarContainer) return;

  try {
    const [allTasks, allDailyLogs] = await Promise.all([
      getAllTasks(),
      getAllDailyLogs()
    ]);

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

        <div class="calendar-card">
          <div id="tracky-calendar"></div>
        </div>
      </section>
    `;

    const calendarEl = calendarContainer.querySelector('#tracky-calendar');

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
          year: currentYear,
          dates: [getViewDate()]
        },
        selection: {
          day: 'single',
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
        clickArrow(event, self) {
          activeCalendarMonth = self.selectedMonth;
          updateCustomMonthTitle(self.selectedMonth, calendarContainer);
        },

        getDays(day, date, HTMLElement, HTMLButtonElement) {
          if (
            HTMLButtonElement.classList.contains('vanilla-calendar-day__btn_prev') ||
            HTMLButtonElement.classList.contains('vanilla-calendar-day__btn_next')
          ) {
            return;
          }

          const status = getDayStatusInMemory(date, allTasks, logsMap);
          renderDayCellContent(HTMLButtonElement, day, status, date);
        },

        clickDay(event, self) {
          const dayBtn = event.target.closest('[data-calendar-day]');
          const clickedDateStr =
            (dayBtn && dayBtn.dataset.calendarDay) ||
            (self.selectedDates && self.selectedDates[0]);

          if (!clickedDateStr) return;

          setViewDate(clickedDateStr);
          highlightSelectedDayInDOM(calendarContainer, clickedDateStr);

          if (isSplitViewEnabled()) {
            const listPanel = document.getElementById('mobile-list-panel');
            renderTaskList(clickedDateStr, listPanel);
          } else {
            switchView('daily');
          }
        }
      }
    };

    const calendar = new VanillaCalendar(calendarEl || '#tracky-calendar', calendarOptions);
    calendar.init();
    updateCustomMonthTitle(activeCalendarMonth, calendarContainer);
    highlightSelectedDayInDOM(calendarContainer, getViewDate());
  } catch (error) {
    console.error('[Tracky Calendar] Error al renderizar el calendario mensual:', error);
  }
}
