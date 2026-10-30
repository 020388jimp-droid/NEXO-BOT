// Todos los textos que ve el cliente. Separarlos del motor permite cambiar
// el tono, traducir el bot o adaptarlo a otra marca sin tocar la lógica.

import { NEGOCIO } from '../config/negocio.js';
import { formatearFechaLarga, formatearHora } from './fechas.js';

export function textoMenu({ saludo = true } = {}) {
  const encabezado = saludo
    ? `¡Hola! 👋 Soy *NEXO*, el asistente virtual de *${NEGOCIO.nombre}*.`
    : '¿Qué más puedo hacer por ti?';

  return `${encabezado}

1️⃣ Servicios y precios
2️⃣ Agendar una cita
3️⃣ Consultar o cancelar mi cita
4️⃣ Hablar con un asesor

Responde con el número de la opción o escríbeme tu duda.`;
}

export function textoServicios() {
  const lista = NEGOCIO.servicios
    .map(
      (servicio) =>
        `• *${servicio.nombre}* — ${servicio.precioTexto}\n  ${servicio.duracion} min · ${servicio.descripcion}`,
    )
    .join('\n\n');

  return `*Servicios y precios*\n\n${lista}\n\nEscribe *cita* cuando quieras agendar. 📅`;
}

export function textoElegirServicio() {
  const lista = NEGOCIO.servicios
    .map((servicio, indice) => `${indice + 1}. ${servicio.nombre} — ${servicio.precioTexto} (${servicio.duracion} min)`)
    .join('\n');

  return `¿Qué servicio necesitas?\n\n${lista}\n\nResponde con el número.`;
}

export function textoPedirFecha() {
  return '¿Para qué día te gustaría? 📅\n\nPuedes escribir *mañana*, *viernes* o una fecha como *30/10*.';
}

export function textoSlots(fecha, slots) {
  const visibles = slots.slice(0, 12);
  const lista = visibles.map((hora, indice) => `${indice + 1}. ${formatearHora(hora)}`).join('\n');
  const extra =
    slots.length > visibles.length
      ? `\n\nHay más horarios ese día. También puedes escribir la hora que prefieras (ej. *5:30 p. m.*).`
      : '';

  return `*Horarios disponibles para el ${formatearFechaLarga(fecha)}*\n\n${lista}${extra}\n\nResponde con el número o escribe tu hora preferida.`;
}

export function textoPedirNombre() {
  return '¿A nombre de quién agendo la cita? Escribe tu nombre completo.';
}

export function textoResumen(datos) {
  return `*Confirma tu cita* ✅

• Servicio: ${datos.servicio}
• Fecha: ${formatearFechaLarga(datos.fecha)}
• Hora: ${formatearHora(datos.hora)}
• Duración: ${datos.duracion} min
• Nombre: ${datos.nombre}

1️⃣ Confirmar
2️⃣ Cambiar la fecha
3️⃣ Cancelar

Responde con el número.`;
}

export function textoCitaConfirmada(cita) {
  return `✅ *Cita confirmada*

• Código: *${cita.codigo}*
• Servicio: ${cita.servicio}
• Fecha: ${formatearFechaLarga(cita.fecha)}
• Hora: ${formatearHora(cita.hora)}
• Lugar: ${NEGOCIO.direccion}

Guarda tu código. Si necesitas cancelar, escribe *cancelar* y te ayudo. ¡Te esperamos!`;
}

export function textoMisCitas(citas) {
  if (!citas.length) {
    return `No encontré citas próximas con este número. 😕\n\nEscribe *cita* si quieres agendar una nueva.`;
  }

  const lista = citas
    .map(
      (cita) =>
        `• Código *${cita.codigo}*\n  ${cita.servicio}\n  ${formatearFechaLarga(cita.fecha)} · ${formatearHora(cita.hora)}`,
    )
    .join('\n\n');

  return `*Tus próximas citas*\n\n${lista}\n\nSi quieres cancelar una, responde con su código.`;
}

export function textoCitaCancelada(cita) {
  return `Listo, cancelé tu cita *${cita.codigo}* del ${formatearFechaLarga(cita.fecha)} a las ${formatearHora(cita.hora)}\n\nSi quieres agendar otra, escribe *cita*.`;
}

export function textoAsesor() {
  const nombres = NEGOCIO.horario.dias.map(
    (dia) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia],
  );
  const dias = nombres.length > 2 ? `${nombres[0]} a ${nombres[nombres.length - 1]}` : nombres.join(' y ');
  const lineas = [
    'Claro, te paso con una persona del equipo. 🙋',
    '',
    `📞 ${NEGOCIO.telefono}`,
    `✉️ ${NEGOCIO.correo}`,
    `🕘 ${dias}, ${NEGOCIO.horario.apertura}:00 a ${NEGOCIO.horario.cierre}:00`,
  ];
  return lineas.join('\n');
}

export function textoNoEntendi() {
  return `No estoy seguro de eso. 🤔\n\nPuedo ayudarte con *servicios*, *precios* o *agendar una cita*. Escribe *menú* para ver las opciones o *asesor* para hablar con una persona.`;
}

export function textoFueraDeHorario() {
  return `Ese día no atendemos. 😕\n\nAtendemos de ${NEGOCIO.horario.dias
    .map((dia) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia])
    .join(', ')}.\n\n¿Quieres probar con otra fecha? Por ejemplo *mañana* o *viernes*.`;
}

export function textoUltimoHorario() {
  return 'Ya no quedan horarios disponibles para ese día. ¿Probamos con otra fecha? 📅';
}
