/**
 * js/ui/taskList.js
 * Renderizado y gestión de eventos de la Vista Diaria (lista de hábitos por fecha)
 * dentro del contenedor principal `#app-main`.
 *
 * Reglas según la fecha seleccionada (`dateString` vs `getTodayString()`):
 * - HOY (`dateString === todayStr`):
 *   - Título: "Hábitos de hoy"
 *   - Botón FAB (+): Visible
 *   - Círculos de estado: Interactivos
 * - DÍA PASADO (`dateString < todayStr`):
 *   - Título: "Hábitos del [fecha formateada]"
 *   - Botón FAB (+): Oculto
 *   - Círculos de estado: Bloqueados (`.disabled`, opacidad 0.5, `pointer-events: none`)
 * - DÍA FUTURO (`dateString > todayStr`):
 *   - Título: "Hábitos del [fecha formateada]"
 *   - Botón FAB (+): Visible (permite programar hábitos futuros)
 *   - Círculos de estado: Bloqueados (`.disabled`, no se puede completar el futuro)
 */

import { getAllTasks, getDailyLog, updateTaskStatus } from '../db/db.js';
import { getTodayString, formatHeaderDate } from '../logic/dateUtils.js';
import { shouldTaskAppearOnDate } from '../logic/recurrence.js';
import { triggerCelebration } from './confetti.js';
import { openModal } from './modal.js';

// Etiquetas legibles en español para el subtítulo de recurrencia de cada tarea
const RECURRENCE_LABELS = {
  none: 'Solo este día',
  daily: 'Todos los días',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual'
};

/**
 * Escapa caracteres HTML especiales para prevenir inyección XSS al renderizar títulos de usuario.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Actualiza el contador visual de progreso ("X de Y completados") en la cabecera de la lista
 * y retorna la cantidad de tareas completadas actualmente en el DOM.
 *
 * @param {HTMLElement} mainContainer
 * @param {number} totalTasksCount
 * @returns {number} Cantidad de tareas completadas tras el clic.
 */
function updateProgressCounter(mainContainer, totalTasksCount) {
  const completedItemsCount = mainContainer.querySelectorAll('.status-circle.completed').length;

  const counterEl = mainContainer.querySelector('#daily-progress-counter');
  if (counterEl) {
    counterEl.textContent = `${completedItemsCount} de ${totalTasksCount} completados`;
  }

  return completedItemsCount;
}

/**
 * Obtiene las tareas de IndexedDB, filtra las que corresponden a `dateString`,
 * aplica las reglas de deshabilitación para días pasados/futuros y renderiza la lista en `#app-main`.
 *
 * @param {string} [dateString=getTodayString()] - Fecha objetivo en formato 'YYYY-MM-DD'.
 */
export async function renderTaskList(dateString = getTodayString()) {
  const mainContainer = document.getElementById('app-main');
  if (!mainContainer) return;

  const todayStr = getTodayString();
  const isToday = dateString === todayStr;
  const isPast = dateString < todayStr;
  const isFuture = dateString > todayStr;

  // 1. Controlamos la visibilidad del botón FAB (+):
  //    Oculto en días pasados; visible hoy y en días futuros.
  const fabButton = document.getElementById('fab-add-task');
  if (fabButton) {
    fabButton.classList.toggle('hidden', isPast);
  }

  // 2. Determinamos el título dinámico de la sección
  const formattedTargetDate = formatHeaderDate(new Date(`${dateString}T00:00:00`));
  const viewTitleText = isToday
    ? 'Hábitos de hoy'
    : `Hábitos del ${formattedTargetDate}`;

  try {
    // 3. Consultamos en paralelo todas las tareas y el registro de la fecha desde IndexedDB
    const [allTasks, dailyLog] = await Promise.all([
      getAllTasks(),
      getDailyLog(dateString)
    ]);

    // 4. Filtramos solo las tareas que deben aparecer en la fecha indicada
    const activeTasks = allTasks.filter((task) =>
      shouldTaskAppearOnDate(task, dateString)
    );

    const tasksStatus = dailyLog.tasksStatus || {};

    // 5. Si no hay tareas para esta fecha, mostramos un estado vacío contextualizado
    if (activeTasks.length === 0) {
      const emptyMessage = isPast
        ? 'No hubo hábitos programados para esta fecha.'
        : 'Pulsa el botón <strong>+</strong> en la esquina inferior derecha para programar un hábito.';

      mainContainer.innerHTML = `
        <section class="daily-view-header">
          <h2 class="daily-view-title">${viewTitleText}</h2>
          <span class="daily-view-counter" id="daily-progress-counter">0 tareas</span>
        </section>
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">✨</div>
          <p class="empty-state-title">Sin hábitos para este día</p>
          <p class="empty-state-text">${emptyMessage}</p>
        </div>
      `;
      return;
    }

    // 6. Construimos el HTML de la lista de tareas activas
    const completedCount = activeTasks.filter((t) => tasksStatus[t.id] === true).length;
    const disabledCircleClass = !isToday ? 'disabled' : '';

    const tasksHTML = activeTasks
      .map((task) => {
        const isCompleted = tasksStatus[task.id] === true;
        const completedClass = isCompleted ? 'completed' : '';
        const recurrenceLabel = RECURRENCE_LABELS[task.recurrence] || RECURRENCE_LABELS.none;

        return `
          <li class="task-item ${completedClass}" data-task-id="${escapeHTML(task.id)}">
            <div class="task-content">
              <span
                class="task-title ${completedClass}"
                data-task-id="${escapeHTML(task.id)}"
                title="Haz clic para editar o eliminar este hábito"
              >${escapeHTML(task.title)}</span>
              <span class="task-meta">${recurrenceLabel}</span>
            </div>
            <button
              type="button"
              class="status-circle ${completedClass} ${disabledCircleClass}"
              data-action="toggle-status"
              data-task-id="${escapeHTML(task.id)}"
              aria-label="Marcar hábito como ${isCompleted ? 'pendiente' : 'completado'}"
              aria-pressed="${isCompleted}"
              ${!isToday ? 'aria-disabled="true" tabindex="-1"' : ''}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </li>
        `;
      })
      .join('');

    mainContainer.innerHTML = `
      <section class="daily-view-header">
        <h2 class="daily-view-title">${viewTitleText}</h2>
        <span class="daily-view-counter" id="daily-progress-counter">${completedCount} de ${activeTasks.length} completados</span>
      </section>
      <ul class="task-list" id="daily-task-list" data-date="${dateString}">
        ${tasksHTML}
      </ul>
    `;

    // 7. Delegación de eventos en la lista:
    //    - Clic en el título (.task-title) -> Abre el modal en modo edición
    //    - Clic en el círculo (.status-circle) -> Solo permitido si `isToday === true`
    const taskListEl = mainContainer.querySelector('#daily-task-list');
    if (taskListEl) {
      taskListEl.addEventListener('click', async (event) => {
        // Caso A: Clic sobre el título de la tarea -> Editar hábito
        const titleEl = event.target.closest('.task-title');
        if (titleEl) {
          const taskId = titleEl.dataset.taskId;
          const taskToEdit = activeTasks.find((t) => t.id === taskId);
          if (taskToEdit) {
            openModal(taskToEdit, dateString);
          }
          return;
        }

        // Caso B: Clic sobre el círculo de estado -> Bloqueado en días pasados o futuros
        if (!isToday || isPast || isFuture) return;

        const circleBtn = event.target.closest('.status-circle');
        if (!circleBtn || circleBtn.classList.contains('disabled')) return;

        const taskId = circleBtn.dataset.taskId;
        const taskItem = circleBtn.closest('.task-item');
        const taskTitle = taskItem ? taskItem.querySelector('.task-title') : null;

        // Alternamos el estado actual basándonos en la clase '.completed'
        const isCurrentlyCompleted = circleBtn.classList.contains('completed');
        const newStatus = !isCurrentlyCompleted;

        // Actualización optimista inmediata en la interfaz (UI)
        circleBtn.classList.toggle('completed', newStatus);
        circleBtn.setAttribute('aria-pressed', String(newStatus));
        circleBtn.setAttribute(
          'aria-label',
          `Marcar hábito como ${newStatus ? 'pendiente' : 'completado'}`
        );

        if (taskItem) taskItem.classList.toggle('completed', newStatus);
        if (taskTitle) taskTitle.classList.toggle('completed', newStatus);

        // Calculamos cuántas tareas están completadas después de este clic
        const completedAfterClick = updateProgressCounter(mainContainer, activeTasks.length);

        // Si el usuario está marcando la tarea (newStatus === true) y con ello
        // se iguala el total de tareas activas del día, disparamos la celebración siempre
        if (newStatus === true && completedAfterClick === activeTasks.length) {
          triggerCelebration();
        }

        // Autoguardado inmediato en IndexedDB
        try {
          await updateTaskStatus(dateString, taskId, newStatus);
        } catch (err) {
          console.error('[Tracky UI] Error al guardar el estado de la tarea:', err);
        }
      });
    }
  } catch (error) {
    console.error('[Tracky UI] Error al renderizar la lista de tareas:', error);
  }
}
