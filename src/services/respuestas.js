// Buscador de preguntas frecuentes. Es el respaldo cuando no hay clave de
// Gemini, cuando se agota la cuota o cuando el modelo tarda demasiado.
// Funciona por palabras clave con límites de palabra, así "ahora" no activa
// la pregunta de "horario".

import { NEGOCIO } from '../config/negocio.js';
import { normalizar } from './fechas.js';

export function respuestaFrecuente(texto) {
  const consulta = normalizar(texto);
  if (!consulta) return null;

  let mejor = null;
  let mejorPuntaje = 0;

  for (const faq of NEGOCIO.faqs) {
    const puntaje = faq.claves.reduce((total, clave) => {
      const patron = new RegExp(`\\b${normalizar(clave).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      return total + (patron.test(consulta) ? 1 : 0);
    }, 0);

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = faq;
    }
  }

  return mejorPuntaje > 0 ? mejor.respuesta : null;
}
