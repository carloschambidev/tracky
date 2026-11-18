/**
 * js/ui/taskList.js
 * Renderizado y gestión de eventos de la Vista Diaria (lista de hábitos por fecha).
 */

import { getAllTasks, getDailyLog, updateTaskStatus } from '../db/db.js';
import { getTodayString, formatHeaderDate } from '../logic/dateUtils.js';
import { shouldTaskAppearOnDate } from '../logic/recurrence.js';
import { triggerCelebration } from './confetti.js';
import { openModal } from './modal.js';

const RECURRENCE_LABELS = {
  none: 'Solo este día',
  daily: 'Todos los días',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual'
};

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateProgressCounter(mainContainer, totalTasksCount) {
  const completedItemsCount = mainContainer.querySelectorAll('.status-circle.completed').length;

  const counterEl = mainContainer.querySelector('#daily-progress-counter');
  if (counterEl) {
    counterEl.textContent = `${completedItemsCount} de ${totalTasksCount} completados`;
  }

  return completedItemsCount;
}

/**
 * Renderiza la lista de tareas en el contenedor objetivo (`#mobile-list-panel` o `#app-main`).
 *
 * @param {string} [dateString=getTodayString()] - Fecha objetivo en formato 'YYYY-MM-DD'.
 * @param {HTMLElement|null} [targetContainer=null] - Contenedor DOM donde inyectar la lista.
 */
export async function renderTaskList(dateString = getTodayString(), targetContainer = null) {
  const mainContainer =
    targetContainer ||
    document.getElementById('mobile-list-panel') ||
    document.getElementById('app-main');

  if (!mainContainer) return;

  const existingFab = document.getElementById('fab-add-task');

  const todayStr = getTodayString();
  const isToday = dateString === todayStr;
  const isPast = dateString < todayStr;
  const isFuture = dateString > todayStr;

  if (existingFab) {
    existingFab.classList.toggle('hidden', isPast);
  }

  const formattedTargetDate = formatHeaderDate(new Date(`${dateString}T00:00:00`));
  const viewTitleText = isToday
    ? 'Hábitos de hoy'
    : `Hábitos del ${formattedTargetDate}`;

  try {
    const [allTasks, dailyLog] = await Promise.all([
      getAllTasks(),
      getDailyLog(dateString)
    ]);

    const activeTasks = allTasks.filter((task) =>
      shouldTaskAppearOnDate(task, dateString)
    );

    const tasksStatus = dailyLog.tasksStatus || {};

    if (activeTasks.length === 0) {
      const emptyMessage = isPast
        ? 'No hubo hábitos programados para esta fecha.'
        : 'Pulsa el botón <strong>+</strong> para programar un hábito.';

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

      if (existingFab && mainContainer.id === 'mobile-list-panel') {
        mainContainer.appendChild(existingFab);
      }
      return;
    }

    const completedCount = activeTasks.filter((t) => tasksStatus[t.id] === true).length;
    const disabledCircleClass = !isToday ? 'disabled' : '';
    const editableTitleClass = isToday ? 'editable' : 'readonly';

    const tasksHTML = activeTasks
      .map((task) => {
        const isCompleted = tasksStatus[task.id] === true;
        const completedClass = isCompleted ? 'completed' : '';
        const recurrenceKey = RECURRENCE_LABELS[task.recurrence] ? task.recurrence : 'none';
        const recurrenceLabel = RECURRENCE_LABELS[recurrenceKey];
        const freqClass = `freq-${recurrenceKey}`;

        const titleAttributes = isToday
          ? `data-task-id="${escapeHTML(task.id)}" title="Haz clic para editar o eliminar este hábito"`
          : '';

        return `
          <li class="task-item ${freqClass} ${completedClass}" data-task-id="${escapeHTML(task.id)}">
            <div class="task-content">
              <span
                class="task-title ${completedClass} ${editableTitleClass}"
                ${titleAttributes}
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

    if (existingFab && mainContainer.id === 'mobile-list-panel') {
      mainContainer.appendChild(existingFab);
    }

    if (!isToday || isPast || isFuture) {
      return;
    }

    const taskListEl = mainContainer.querySelector('#daily-task-list');
    if (taskListEl) {
      taskListEl.addEventListener('click', async (event) => {
        const titleEl = event.target.closest('.task-title.editable');
        if (titleEl) {
          const taskId = titleEl.dataset.taskId;
          const taskToEdit = activeTasks.find((t) => t.id === taskId);
          if (taskToEdit) {
            openModal(taskToEdit, dateString);
          }
          return;
        }

        const circleBtn = event.target.closest('.status-circle');
        if (!circleBtn || circleBtn.classList.contains('disabled')) return;

        const taskId = circleBtn.dataset.taskId;
        const taskItem = circleBtn.closest('.task-item');
        const taskTitle = taskItem ? taskItem.querySelector('.task-title') : null;

        const isCurrentlyCompleted = circleBtn.classList.contains('completed');
        const newStatus = !isCurrentlyCompleted;

        circleBtn.classList.toggle('completed', newStatus);
        circleBtn.setAttribute('aria-pressed', String(newStatus));
        circleBtn.setAttribute(
          'aria-label',
          `Marcar hábito como ${newStatus ? 'pendiente' : 'completado'}`
        );

        if (taskItem) taskItem.classList.toggle('completed', newStatus);
        if (taskTitle) taskTitle.classList.toggle('completed', newStatus);

        const completedAfterClick = updateProgressCounter(mainContainer, activeTasks.length);

        if (newStatus === true && completedAfterClick === activeTasks.length) {
          triggerCelebration();
        }

        try {
          await updateTaskStatus(dateString, taskId, newStatus);
          window.dispatchEvent(new CustomEvent('tracky:data-changed'));
        } catch (err) {
          console.error('[Tracky UI] Error al guardar el estado de la tarea:', err);
        }
      });
    }
  } catch (error) {
    console.error('[Tracky UI] Error al renderizar la lista de tareas:', error);
  }
}
