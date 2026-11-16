/**
 * js/ui/confetti.js
 * Efecto de gamificación y recompensa visual al completar todos los hábitos del día.
 * Lanza confeti dorado desde ambos laterales de la pantalla y muestra el banner
 * animado "DÍA COMPLETADO" durante 3 segundos.
 */

import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm';

// Paleta de tonos dorados/amarillos para el confeti de celebración
const GOLD_PALETTE = ['#fbbf24', '#f59e0b', '#fde047', '#eab308', '#fef08a'];

/**
 * Lanza confeti dorado desde los bordes izquierdo (x: 0) y derecho (x: 1)
 * y muestra el mensaje flotante "DÍA COMPLETADO" en el centro de la pantalla.
 */
export function triggerCelebration() {
  // 1. Disparo de confeti dorado desde ambos laterales (x: 0 y x: 1)
  if (typeof confetti === 'function') {
    const shootSideConfetti = (particleCount, spread, startVelocity) => {
      // Cañón lateral izquierdo
      confetti({
        particleCount,
        angle: 60,
        spread,
        startVelocity,
        origin: { x: 0, y: 0.65 },
        colors: GOLD_PALETTE,
        zIndex: 250
      });

      // Cañón lateral derecho
      confetti({
        particleCount,
        angle: 120,
        spread,
        startVelocity,
        origin: { x: 1, y: 0.65 },
        colors: GOLD_PALETTE,
        zIndex: 250
      });
    };

    // Ráfaga inicial y segunda ráfaga corta para mayor impacto visual
    shootSideConfetti(45, 60, 55);
    setTimeout(() => shootSideConfetti(35, 75, 45), 220);
  }

  // 2. Creación dinámica del texto "DÍA COMPLETADO" en el DOM
  const existingBanner = document.getElementById('tracky-celebration-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  const celebrationEl = document.createElement('div');
  celebrationEl.id = 'tracky-celebration-banner';
  celebrationEl.className = 'celebration-banner';
  celebrationEl.setAttribute('role', 'status');
  celebrationEl.setAttribute('aria-live', 'polite');
  celebrationEl.textContent = 'DÍA COMPLETADO';

  document.body.appendChild(celebrationEl);

  // 3. Eliminamos el elemento del DOM automáticamente tras 3 segundos (3000 ms)
  setTimeout(() => {
    celebrationEl.remove();
  }, 3000);
}

export default triggerCelebration;
