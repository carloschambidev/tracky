/**
 * js/logic/dateUtils.js
 * Funciones puras de utilidad para el manejo, formateo y cálculo de fechas.
 * Todas las fechas se procesan en hora local para evitar desfases de zona horaria (UTC).
 */

// Abreviaturas estandarizadas para garantizar consistencia visual en cualquier navegador/SO
const DAYS_SHORT = ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'];
const MONTHS_SHORT = [
  'Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.',
  'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'
];

/**
 * Retorna la fecha actual local en formato 'YYYY-MM-DD'.
 * Este formato se utiliza como clave primaria (keyPath) en el store `dailyLogs` de IndexedDB.
 *
 * @returns {string} Fecha actual en formato 'YYYY-MM-DD' (ej: '2026-11-16').
 */
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Recibe un objeto Date y retorna un string formateado para la cabecera de la app.
 * Formato exacto: "Dom. 15 Nov." (Día de la semana abreviado con punto, día numérico, mes abreviado con punto).
 *
 * @param {Date} date - Objeto Date a formatear.
 * @returns {string} Fecha formateada (ej: "Dom. 15 Nov.").
 */
export function formatHeaderDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('formatHeaderDate requiere un objeto Date válido.');
  }

  const dayName = DAYS_SHORT[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = MONTHS_SHORT[date.getMonth()];

  return `${dayName} ${dayNumber} ${monthName}`;
}

/**
 * Retorna la cantidad total de días de un mes específico, considerando años bisiestos.
 * Nota: En JavaScript los meses van del 0 (Enero) al 11 (Diciembre).
 * Al pasar `month + 1` con día `0` a `new Date(year, month + 1, 0)`, JavaScript
 * retrocede automáticamente al último día del mes `month`.
 *
 * @param {number} year - Año completo de 4 dígitos (ej: 2024, 2026).
 * @param {number} month - Índice del mes de 0 a 11 (0 = Enero, 1 = Febrero, ..., 11 = Diciembre).
 * @returns {number} Número de días en ese mes (28, 29, 30 o 31).
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
