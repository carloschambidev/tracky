/**
 * js/logic/recurrence.js
 * Lógica pura para evaluar si un hábito/tarea debe mostrarse en una fecha determinada
 * según su regla de recurrencia y su fecha de creación.
 */

/**
 * Convierte un string de fecha ('YYYY-MM-DD' o ISO) a un objeto Date en hora local a medianoche (00:00:00).
 * Usar 'T00:00:00' evita que JavaScript lo interprete como UTC y reste horas en zonas horarias negativas.
 *
 * @param {string} dateString - Fecha en formato 'YYYY-MM-DD' (o ISO string).
 * @returns {Date} Objeto Date local a las 00:00:00.
 */
function parseLocalDate(dateString) {
  const cleanDate = String(dateString).slice(0, 10); // Garantiza quedarnos con 'YYYY-MM-DD'
  return new Date(`${cleanDate}T00:00:00`);
}

/**
 * Determina si una tarea debe aparecer en una fecha objetivo según su configuración de recurrencia.
 *
 * @param {Object} task - Objeto tarea con propiedades { id, title, recurrence, createdAt }.
 * @param {string} targetDateString - Fecha objetivo a consultar en formato 'YYYY-MM-DD'.
 * @returns {boolean} `true` si la tarea debe mostrarse ese día, `false` en caso contrario.
 */
export function shouldTaskAppearOnDate(task, targetDateString) {
  if (!task || !task.createdAt || !targetDateString) {
    return false;
  }

  // Normalizamos ambas fechas a formato 'YYYY-MM-DD' y a objetos Date locales
  const createdDateStr = String(task.createdAt).slice(0, 10);
  const targetDateStr = String(targetDateString).slice(0, 10);

  const createdDate = parseLocalDate(createdDateStr);
  const targetDate = parseLocalDate(targetDateStr);

  // Regla base: Ninguna tarea puede aparecer antes de su fecha de creación
  if (targetDate < createdDate) {
    return false;
  }

  const recurrence = task.recurrence || 'none';

  // 1. Sin recurrencia ('none'): Solo aparece el mismo día en que se creó
  if (recurrence === 'none') {
    return targetDateStr === createdDateStr;
  }

  // 2. Diaria ('daily'): Aparece todos los días a partir de su fecha de creación (inclusive)
  if (recurrence === 'daily') {
    return true;
  }

  // 3. Semanal ('weekly'): Aparece el mismo día de la semana en que se creó (0 = Dom ... 6 = Sáb)
  if (recurrence === 'weekly') {
    return targetDate.getDay() === createdDate.getDay();
  }

  // 4. Mensual ('monthly'): Aparece el mismo día numérico del mes en que se creó (1 - 31)
  if (recurrence === 'monthly') {
    return targetDate.getDate() === createdDate.getDate();
  }

  // 5. Anual ('yearly'): Aparece el mismo día y el mismo mes en que se creó
  if (recurrence === 'yearly') {
    return (
      targetDate.getDate() === createdDate.getDate() &&
      targetDate.getMonth() === createdDate.getMonth()
    );
  }

  return false;
}
