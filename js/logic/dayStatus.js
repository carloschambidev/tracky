/**
 * js/logic/dayStatus.js
 * Función pura para calcular el estado de cumplimiento de un día específico.
 */

/**
 * Determina el estado global de un día comparando las tareas activas programadas
 * para esa fecha con el registro de estados guardado en IndexedDB.
 *
 * Posibles valores de retorno:
 * - 'empty': No hay tareas programadas para ese día (`activeTasks` está vacío).
 * - 'completed': TODAS las tareas activas tienen estado `true` (Check verde).
 * - 'partial': AL MENOS UNA tarea activa está en `true` y otra en `false` (Punto amarillo).
 * - 'uncompleted': NINGUNA tarea activa está en `true` (Cruz roja).
 *
 * @param {Array<Object>} activeTasks - Array de objetos tarea que corresponden a ese día.
 * @param {Object<string, boolean>} [taskStatuses={}] - Mapa de estados { [taskId]: boolean } desde IndexedDB.
 * @returns {'empty' | 'completed' | 'partial' | 'uncompleted'} Estado calculado del día.
 */
export function calculateDayStatus(activeTasks = [], taskStatuses = {}) {
  // 1. Si no hay tareas activas para el día, el estado es 'empty'
  if (!Array.isArray(activeTasks) || activeTasks.length === 0) {
    return 'empty';
  }

  // Aseguramos que taskStatuses sea un objeto válido incluso si se pasa null/undefined
  const statuses = taskStatuses || {};

  // Contamos cuántas de las tareas activas del día están marcadas estrictamente como `true`
  let completedCount = 0;

  for (const task of activeTasks) {
    if (statuses[task.id] === true) {
      completedCount++;
    }
  }

  // 2. Si todas las tareas activas están completadas
  if (completedCount === activeTasks.length) {
    return 'completed';
  }

  // 3. Si al menos una tarea está completada (pero no todas)
  if (completedCount > 0) {
    return 'partial';
  }

  // 4. Si ninguna tarea está completada (completedCount === 0)
  return 'uncompleted';
}
