/**
 * js/db/db.js
 * Configuración, inicialización y operaciones CRUD de IndexedDB para Tracky usando `idb`.
 *
 * Estructura de la base de datos (`tracky-db`, versión 1):
 * 1. `tasks` (keyPath: 'id') -> Almacena las definiciones de hábitos/tareas y sus reglas de recurrencia.
 * 2. `dailyLogs` (keyPath: 'date') -> Almacena el registro de progreso por fecha en formato 'YYYY-MM-DD'.
 */

import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

export const DB_NAME = 'tracky-db';
export const DB_VERSION = 1;

export const STORES = {
  TASKS: 'tasks',
  DAILY_LOGS: 'dailyLogs'
};

// Instancia singleton de la promesa de conexión a la base de datos
let dbPromise = null;

/**
 * Inicializa y abre la conexión con IndexedDB (`tracky-db`).
 * Si la base de datos no existe o requiere actualizar su esquema,
 * ejecuta el callback `upgrade` creando los Object Stores necesarios.
 *
 * @returns {Promise<import('idb').IDBPDatabase>} Promesa con la instancia de la base de datos abierta.
 */
export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`[Tracky DB] Actualizando esquema de v${oldVersion} a v${newVersion}...`);

        // 1. Object Store para las tareas/hábitos (clave primaria: id tipo string)
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const taskStore = db.createObjectStore(STORES.TASKS, {
            keyPath: 'id'
          });
          taskStore.createIndex('by_createdAt', 'createdAt', { unique: false });
          console.log(`[Tracky DB] Object Store '${STORES.TASKS}' creado.`);
        }

        // 2. Object Store para los registros diarios (clave primaria: date 'YYYY-MM-DD')
        if (!db.objectStoreNames.contains(STORES.DAILY_LOGS)) {
          db.createObjectStore(STORES.DAILY_LOGS, {
            keyPath: 'date'
          });
          console.log(`[Tracky DB] Object Store '${STORES.DAILY_LOGS}' creado.`);
        }
      },
      blocked() {
        console.warn('[Tracky DB] La apertura de la base de datos está bloqueada por otra pestaña abierta.');
      },
      blocking() {
        console.warn('[Tracky DB] Esta instancia bloquea una versión más reciente. Cerrando conexión...');
      }
    });
  }

  return dbPromise;
}

/**
 * Obtiene la instancia activa de la base de datos (inicializándola si aún no se ha abierto).
 *
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export async function getDB() {
  return initDB();
}

/* ==========================================================================
   Operaciones CRUD - Tienda `tasks` y `dailyLogs`
   ========================================================================== */

/**
 * Obtiene todas las tareas almacenadas en la tienda `tasks`.
 *
 * @returns {Promise<Array<Object>>} Array con todos los objetos tarea.
 */
export async function getAllTasks() {
  const db = await getDB();
  const tasks = await db.getAll(STORES.TASKS);
  return tasks || [];
}

/**
 * Guarda una nueva tarea en la tienda `tasks`.
 *
 * @param {Object} task - Objeto tarea ({ id, title, recurrence, createdAt }).
 * @returns {Promise<string>} Promesa que resuelve con el `id` de la tarea guardada.
 */
export async function addTask(task) {
  if (!task || !task.id || !task.title) {
    throw new Error('La tarea debe contener al menos un id y un title válidos.');
  }
  const db = await getDB();
  return db.put(STORES.TASKS, task);
}

/**
 * Actualiza (sobrescribe) una tarea existente en la tienda `tasks`.
 *
 * @param {Object} task - Objeto tarea actualizado ({ id, title, recurrence, createdAt }).
 * @returns {Promise<string>} Promesa que resuelve con el `id` de la tarea actualizada.
 */
export async function updateTask(task) {
  if (!task || !task.id || !task.title) {
    throw new Error('Para actualizar la tarea se requiere un id y un title válidos.');
  }
  const db = await getDB();
  return db.put(STORES.TASKS, task);
}

/**
 * Elimina una tarea existente de la tienda `tasks` mediante su ID.
 *
 * @param {string} taskId - ID único de la tarea a eliminar.
 * @returns {Promise<void>}
 */
export async function deleteTask(taskId) {
  if (!taskId) {
    throw new Error('Se requiere un taskId válido para eliminar la tarea.');
  }
  const db = await getDB();
  return db.delete(STORES.TASKS, taskId);
}

/**
 * Obtiene el registro diario (`dailyLog`) correspondiente a una fecha específica.
 * Si aún no existe un registro para esa fecha en IndexedDB, retorna un objeto
 * inicializado con `date` y `tasksStatus: {}`.
 *
 * @param {string} dateString - Fecha en formato 'YYYY-MM-DD'.
 * @returns {Promise<{ date: string, tasksStatus: Object<string, boolean> }>} Registro del día.
 */
export async function getDailyLog(dateString) {
  const db = await getDB();
  const existingLog = await db.get(STORES.DAILY_LOGS, dateString);

  if (existingLog && typeof existingLog === 'object') {
    return {
      date: dateString,
      tasksStatus: existingLog.tasksStatus || {}
    };
  }

  return {
    date: dateString,
    tasksStatus: {}
  };
}

/**
 * Obtiene todos los registros diarios (`dailyLogs`) de una sola vez.
 * Ideal para calcular el estado mensual en memoria dentro de la Vista de Calendario
 * sin realizar múltiples consultas individuales a IndexedDB.
 *
 * @returns {Promise<Array<{ date: string, tasksStatus: Object<string, boolean> }>>}
 */
export async function getAllDailyLogs() {
  const db = await getDB();
  const logs = await db.getAll(STORES.DAILY_LOGS);
  return logs || [];
}

/**
 * Actualiza el estado de completitud (`true` o `false`) de una tarea específica
 * en el registro de un día determinado y lo persiste en la tienda `dailyLogs`.
 *
 * @param {string} dateString - Fecha en formato 'YYYY-MM-DD'.
 * @param {string} taskId - ID único de la tarea a actualizar.
 * @param {boolean} isCompleted - Nuevo estado (`true` = completada, `false` = pendiente).
 * @returns {Promise<{ date: string, tasksStatus: Object<string, boolean> }>} El registro diario actualizado.
 */
export async function updateTaskStatus(dateString, taskId, isCompleted) {
  const db = await getDB();

  // 1. Obtenemos el log actual del día (o estructura vacía si no existía)
  const currentLog = await getDailyLog(dateString);

  // 2. Actualizamos el estado de la tarea en el mapa tasksStatus
  const updatedLog = {
    date: dateString,
    tasksStatus: {
      ...currentLog.tasksStatus,
      [taskId]: Boolean(isCompleted)
    }
  };

  // 3. Guardamos de vuelta en el store `dailyLogs`
  await db.put(STORES.DAILY_LOGS, updatedLog);

  return updatedLog;
}

export default {
  initDB,
  getDB,
  getAllTasks,
  addTask,
  updateTask,
  deleteTask,
  getDailyLog,
  getAllDailyLogs,
  updateTaskStatus,
  STORES
};
