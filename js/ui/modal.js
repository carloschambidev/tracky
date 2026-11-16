/**
 * js/ui/modal.js
 * Controlador del modal híbrido para crear nuevos hábitos o editar/eliminar hábitos existentes
 * dentro de `#modal-container`.
 *
 * Soporta creación en días futuros (`targetDate > getTodayString()`):
 * - Asigna `createdAt: targetDate` al nuevo hábito.
 * - Oculta/deshabilita la opción `<option value="daily">` cuando se crea un hábito en un día futuro.
 */

import { addTask, updateTask, deleteTask } from '../db/db.js';
import { getTodayString } from '../logic/dateUtils.js';
import { renderTaskList } from './taskList.js';

// Ícono SVG de lápiz para el encabezado en modo edición
const PENCIL_ICON_SVG = `
  <svg class="modal-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
`;

// Ícono SVG de tacho de basura para el botón de eliminar hábito
const TRASH_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
`;

/**
 * Genera un identificador único UUID v4.
 *
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escapa caracteres especiales para atributos/texto HTML.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;');
}

/**
 * Cierra únicamente el mini-modal de confirmación de eliminación si está abierto.
 */
function closeConfirmModal() {
  const confirmOverlay = document.getElementById('confirm-overlay');
  if (confirmOverlay) {
    confirmOverlay.remove();
  }
}

/**
 * Cierra y limpia todo el contenedor de modales (`#modal-container`).
 */
export function closeModal() {
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
  document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Permite cerrar con Escape: si el mini-modal de confirmación está abierto,
 * cierra solo ese mini-modal; de lo contrario cierra el modal principal.
 *
 * @param {KeyboardEvent} event
 */
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    const confirmOverlay = document.getElementById('confirm-overlay');
    if (confirmOverlay) {
      closeConfirmModal();
    } else {
      closeModal();
    }
  }
}

/**
 * Muestra un mini-modal estético superpuesto al modal de edición para confirmar
 * la eliminación definitiva de un hábito.
 *
 * @param {string} taskId - ID del hábito a eliminar.
 * @param {string} targetDate - Fecha activa para refrescar la lista tras eliminar.
 */
function openDeleteConfirmModal(taskId, targetDate) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  closeConfirmModal();

  const confirmOverlay = document.createElement('div');
  confirmOverlay.className = 'confirm-overlay';
  confirmOverlay.id = 'confirm-overlay';
  confirmOverlay.setAttribute('role', 'alertdialog');
  confirmOverlay.setAttribute('aria-modal', 'true');
  confirmOverlay.setAttribute('aria-labelledby', 'confirm-title');

  confirmOverlay.innerHTML = `
    <div class="confirm-card">
      <h4 class="confirm-title" id="confirm-title">¿Eliminar hábito?</h4>
      <p class="confirm-text">Esta acción no se puede deshacer.</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-secondary" id="confirm-cancel-btn">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirm-delete-btn">Eliminar</button>
      </div>
    </div>
  `;

  modalContainer.appendChild(confirmOverlay);

  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeConfirmModal);
  }
  confirmOverlay.addEventListener('click', (event) => {
    if (event.target === confirmOverlay) {
      closeConfirmModal();
    }
  });

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      try {
        await deleteTask(taskId);
        closeModal();
        await renderTaskList(targetDate);
        window.dispatchEvent(new CustomEvent('tracky:data-changed'));
      } catch (error) {
        console.error('[Tracky Modal] Error al eliminar la tarea:', error);
      }
    });
  }
}

/**
 * Abre el modal en modo Creación (`taskToEdit = null`) o en modo Edición (`taskToEdit = Object`).
 *
 * @param {Object|null} [taskToEdit=null] - Objeto tarea a editar, o `null` para crear una nueva.
 * @param {string} [targetDate=getTodayString()] - Fecha activa desde la cual se abre el modal ('YYYY-MM-DD').
 */
export function openModal(taskToEdit = null, targetDate = getTodayString()) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const todayStr = getTodayString();
  const activeDate = targetDate || todayStr;
  const isFutureDate = activeDate > todayStr;

  const isEditMode = Boolean(taskToEdit && taskToEdit.id);
  const currentTitle = isEditMode ? escapeHTML(taskToEdit.title) : '';

  // Por defecto al crear un nuevo hábito se selecciona 'none' ("Solo este día")
  const currentRecurrence = isEditMode ? taskToEdit.recurrence : 'none';

  const modalTitleHTML = isEditMode
    ? `<span>Editando hábito</span>${PENCIL_ICON_SVG}`
    : `<span>Nuevo Hábito</span>`;

  const deleteButtonHTML = isEditMode
    ? `
      <button
        type="button"
        class="btn-delete-task"
        id="modal-delete-btn"
        aria-label="Eliminar hábito"
        title="Eliminar hábito"
      >
        ${TRASH_ICON_SVG}
      </button>
    `
    : '';

  // Restricción Tarea 5: En un día futuro, la opción 'daily' se oculta y deshabilita
  const disableDailyOption = isFutureDate && (!isEditMode || currentRecurrence !== 'daily');

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">${modalTitleHTML}</h3>
          <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Cerrar modal">&times;</button>
        </div>

        <form class="modal-form" id="task-modal-form">
          <div class="form-group">
            <label class="form-label" for="task-title-input">Nombre del hábito</label>
            <input
              type="text"
              id="task-title-input"
              name="title"
              class="form-input"
              placeholder="Ej. Leer 20 minutos, Meditar, Entrenar..."
              value="${currentTitle}"
              required
              maxlength="80"
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="task-recurrence-select">Frecuencia</label>
            <select id="task-recurrence-select" name="recurrence" class="form-select">
              <option value="none" ${currentRecurrence === 'none' ? 'selected' : ''}>Solo este día</option>
              <option
                value="daily"
                ${currentRecurrence === 'daily' ? 'selected' : ''}
                ${disableDailyOption ? 'disabled hidden' : ''}
              >Diaria</option>
              <option value="weekly" ${currentRecurrence === 'weekly' ? 'selected' : ''}>Semanal</option>
              <option value="monthly" ${currentRecurrence === 'monthly' ? 'selected' : ''}>Mensual</option>
              <option value="yearly" ${currentRecurrence === 'yearly' ? 'selected' : ''}>Anual</option>
            </select>
          </div>

          <div class="modal-actions">
            ${deleteButtonHTML}
            <div class="modal-actions-right">
              <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  // No hacemos focus() automático para evitar abrir el teclado virtual de inmediato
  const titleInput = document.getElementById('task-title-input');

  // Listeners para cerrar el modal principal
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });
  }
  document.addEventListener('keydown', handleEscapeKey);

  // Listener del botón de eliminar: abre el mini-modal estético de confirmación
  if (isEditMode) {
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        openDeleteConfirmModal(taskToEdit.id, activeDate);
      });
    }
  }

  // Manejo del evento submit para Crear o Actualizar la tarea
  const form = document.getElementById('task-modal-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const title = titleInput ? titleInput.value.trim() : '';
      const recurrenceSelect = document.getElementById('task-recurrence-select');
      const recurrence = recurrenceSelect ? recurrenceSelect.value : 'none';

      if (!title) return;

      try {
        if (isEditMode) {
          await updateTask({
            ...taskToEdit,
            title,
            recurrence
          });
        } else {
          // Al crear desde hoy o desde un día futuro, `createdAt` toma la fecha seleccionada (`activeDate`)
          await addTask({
            id: generateUUID(),
            title,
            recurrence,
            createdAt: activeDate
          });
        }

        closeModal();
        await renderTaskList(activeDate);
        window.dispatchEvent(new CustomEvent('tracky:data-changed'));
      } catch (error) {
        console.error('[Tracky Modal] Error al guardar la tarea:', error);
      }
    });
  }
}
