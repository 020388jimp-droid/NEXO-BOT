// Todos los textos que ve el cliente. Separarlos del motor permite cambiar
// el tono, traducir el bot o adaptarlo a otra marca sin tocar la lógica.

import { NEGOCIO } from '../config/negocio.js';
import { formatearFechaLarga, formatearHora } from './fechas.js';

export function textoMenu({ saludo = true } = {}) {
  const encabezado = saludo
    ? `🤖 *NEXO BOT*\n¡Hola! 👋 Soy el asistente virtual de *${NEGOCIO.nombreCorto}*.\n¿En qué te puedo ayudar hoy?`
    : `🤖 *NEXO BOT*\n¡Hola! 👋 Soy el asistente virtual de *${NEGOCIO.nombreCorto}*.\n¿En qué más te puedo ayudar hoy?`;

  return `${encabezado}

1️⃣ 📄 Ver CV (PDF o Word)
2️⃣ 🚀 Proyectos y portafolio
3️⃣ 📅 Agendar entrevista
4️⃣ 👨‍💻 Perfil y preguntas frecuentes
5️⃣ ✉️ Dejar un mensaje

Responde con el número 👇 o escríbeme tu consulta.`;
}

export function textoServicios() {
  const lista = NEGOCIO.modalidades
    .map((modalidad) => `• *${modalidad.nombre}*, ${modalidad.duracion} min\n  ${modalidad.descripcion}`)
    .join('\n\n');

  return `*Modalidades de entrevista*\n\n${lista}\n\nEscribe *entrevista* para agendar. 📅`;
}

export function textoPerfil() {
  return `*Perfil profesional* 👨‍💻

*${NEGOCIO.nombre}*
${NEGOCIO.rol}
📍 ${NEGOCIO.ubicacion}
📞 ${NEGOCIO.telefono}
✉️ ${NEGOCIO.correo}
🔗 ${NEGOCIO.linkedin}

Pregúntame lo que necesites, por ejemplo:
• ¿Aceptas trabajo remoto?
• ¿Qué experiencia tienes?
• ¿Qué proyectos has hecho?
• ¿Cómo te contacto?

O escribe *menú* para volver a las opciones.`;
}

export function textoElegirServicio() {
  const lista = NEGOCIO.modalidades
    .map(
      (modalidad, indice) =>
        `${indice + 1}️⃣ ${modalidad.emoji || '📌'} *${modalidad.nombre}* (${modalidad.duracion} min)\n   ${modalidad.descripcion}`,
    )
    .join('\n\n');

  return `*¿Qué modalidad prefieres para la entrevista?* 🤝\n\n${lista}\n\nResponde con el número.`;
}

export function textoPedirFecha() {
  return '¿Para qué día te gustaría? 📅\n\nPuedes escribir *mañana*, *viernes* o una fecha como *30/10*.';
}

export function textoPedirNombre() {
  return '¿A nombre de quién agendo la cita? Escribe tu nombre completo.';
}

const EMOJIS_NUMERO = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export function textoSlots(fecha, slots) {
  const visibles = slots.slice(0, 10);
  const lista = visibles
    .map((hora, indice) => `${EMOJIS_NUMERO[indice]} ${formatearHora(hora)}`)
    .join('\n');
  const extra =
    slots.length > visibles.length
      ? `\n\nHay más horarios ese día. También puedes escribir la hora que prefieras (ej. *5:30 p. m.*).`
      : '';

  return `*Horarios disponibles para el ${formatearFechaLarga(fecha)}* 📅\n\n${lista}${extra}\n\nResponde con el número o escribe tu hora preferida.`;
}

export function textoPedirMensaje() {
  return 'Cuéntame qué mensaje quieres dejar. Lo recibirás el dueño del negocio.';
}

export function textoCVFormato() {
  const { cv } = NEGOCIO;
  const lista = cv.opciones.map(
    (opcion, indice) => `${indice + 1}️⃣ ${opcion.nombre} ${opcion.formato}`
  ).join('\n\n');

  return `*¿Qué CV deseas descargar?* 📄\n\n${lista}\n\nResponde con el número.`;
}

export function textoProyectos() {
  const { proyectos } = NEGOCIO;
  const lista = proyectos
    .map(
      (proyecto, indice) =>
        `${indice + 1}️⃣ ${proyecto.emoji || '📁'} *${proyecto.nombre}* (${proyecto.anio})\n   ${proyecto.resumen}`,
    )
    .join('\n\n');

  return `*Proyectos destacados* 🚀\n\n${lista}\n\nEscribe el número para ver el detalle de un proyecto o *menú* para volver.`;
}

export function textoProyectoDetalle(proyecto) {
  const lineas = [
    `${proyecto.emoji || '📁'} *${proyecto.nombre}* (${proyecto.anio})`,
    '',
    proyecto.descripcion,
    '',
    `🧰 Stack: ${proyecto.stack}`,
  ];

  if (proyecto.demo) lineas.push(`🔗 Demo: ${proyecto.demo}`);
  if (proyecto.codigo) lineas.push(`💻 Código: ${proyecto.codigo}`);

  lineas.push('', 'Escribe el número de otro proyecto, *proyectos* para ver la lista o *menú* para volver.');
  return lineas.join('\n');
}

export function textoPedirEmpresa() {
  return '¿De qué empresa eres? 🏢\n\nEscribe el nombre de la empresa o *particular* si aplica.';
}

export function textoPedirVacante() {
  return '¿Para qué vacante o puesto estás reclutando? 💼\n\nEjemplo: *Desarrollador Full-Stack* o *Automatización con IA*.';
}

export function textoResumen(datos) {
  return `*Confirma tu entrevista* ✅

• Modalidad: ${datos.servicio}
• Fecha: ${formatearFechaLarga(datos.fecha)}
• Hora: ${formatearHora(datos.hora)}
• Duración: ${datos.duracion} min
• Nombre: ${datos.nombre}
• Empresa: ${datos.empresa || 'Por definir'}
• Vacante: ${datos.vacante || 'Por definir'}

1️⃣ Confirmar
2️⃣ Cambiar la fecha
3️⃣ Cancelar

Responde con el número.`;
}

export function textoCitaConfirmada(cita) {
  return `✅ *Entrevista confirmada* ✅

• Código: *${cita.codigo}*
• Modalidad: ${cita.servicio}
• Empresa: ${cita.empresa || 'Por definir'}
• Vacante: ${cita.vacante || 'Por definir'}
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
  return `No estoy seguro de haber entendido. 🤔\n\nPuedo compartirte el *CV*, mis *proyectos* o *agendar una entrevista*. Escribe *menú* para ver las opciones.`;
}

export function textoFueraDeHorario() {
  return `Ese día no atendemos. 😕\n\nAtendemos de ${NEGOCIO.horario.dias
    .map((dia) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia])
    .join(', ')}.\n\n¿Quieres probar con otra fecha? Por ejemplo *mañana* o *viernes*.`;
}

export function textoUltimoHorario() {
  return 'Ya no quedan horarios disponibles para ese día. ¿Probamos con otra fecha? 📅';
}
