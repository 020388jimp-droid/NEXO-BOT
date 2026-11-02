// Motor de conversación. Es independiente del canal: el mismo código atiende
// el webhook de WhatsApp, la demo web y la consola. Solo recibe texto y
// devuelve una lista de respuestas.

import { randomBytes } from 'crypto';
import { NEGOCIO, servicioPorId, servicioPorTexto } from '../config/negocio.js';
import {
  diaSemana,
  formatearHora,
  hoyISO,
  normalizar,
  partesEnZona,
  parsearFecha,
  parsearHora,
  slotsDelDia,
  sumarDias,
} from './fechas.js';
import {
  cancelarCita,
  citasDelDia,
  citasPorTelefono,
  crearCita,
  guardarConversacion,
  obtenerConversacion,
} from './almacen.js';
import { responderConIA } from './ia.js';
import { respuestaFrecuente } from './respuestas.js';
import { notificarEquipo } from './whatsapp.js';
import * as mensajes from './mensajes.js';

export const ESTADOS = {
  INICIO: 'inicio',
  MENU: 'menu',
  AGENDAR_SERVICIO: 'agendar_servicio',
  AGENDAR_FECHA: 'agendar_fecha',
  AGENDAR_HORA: 'agendar_hora',
  AGENDAR_NOMBRE: 'agendar_nombre',
  AGENDAR_CONFIRMAR: 'agendar_confirmar',
  AGENDAR_EMPRESA: 'agendar_empresa',
  AGENDAR_CONFIRMAR_ENTREVISTA: 'agendar_confirmar_entrevista',
  CV_FORMATO: 'cv_formato',
  CV_ENVIANDO: 'cv_enviando',
  PROYECTOS_LISTA: 'proyectos_lista',
  PROYECTO_DETALLE: 'proyecto_detalle',
  AVISAR_PROPIA: 'avisar_propia',
};

const MAX_HISTORIAL = 12;
const DIAS_MAXIMOS = 90;

const INTENCIONES = {
  menu: /\bmenu\b|^(inicio|opciones|empezar)$/,
  saludo: /^(hola|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos|hola buenas)\b/,
  agradece: /\b(gracias|muchas gracias|te agradezco)\b/,
  asesor: /\b(asesor|asesora|humano|agente|persona real|hablar con alguien|hablar con una persona|ejecutivo)\b/,
  cancelar: /\b(cancelar|anular|cambiar mi cita|cambiar la cita)\b/,
  misCitas: /\b(mi cita|mis citas|consultar cita|ver cita|cuando es mi cita|mi agenda)\b/,
  agendar: /\b(entrevista|entrevistas|agendar|agenda|reservar|reserva|turno|disponibilidad)\b/,
  servicios: /\b(servicio|servicios|modalidad|modalidades|entrevista|modalidad)\b/,
  atras: /^(atras|volver|regresar|anterior)$/,
  cv: /\b(cv|curriculum|currículum|hoja de vida|resume)\b/i,
  proyectos: /\b(proyecto|proyectos|portafolio|portfolio|trabajos)\b/i,
  perfil: /\b(perfil|sobre mi|quien soy|quién soy|experiencia|stack|tecnologias|tecnologías|estudios|formacion|formación)\b/i,
  horario: /\b(horario|disponibilidad|tardes|mañanas|libre)\b/i,
  mensaje: /\b(mensaje|dejar un mensaje|consigna|anotame|guardo)\b/i,
  agendaSemanal: /\b(horario|disponibilidad|tardes|mañanas)\b/i,
  ayuda: /\b(ayuda|hasta|qué hago|cómo funciona)\b/i,
};

function idDeConversacion(telefono, canal) {
  const limpio = String(telefono || 'anonimo').replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
  return `${canal}_${limpio || 'anonimo'}`;
}

function nuevaConversacion(telefono, canal) {
  return {
    telefono,
    canal,
    estado: ESTADOS.INICIO,
    datos: {},
    historial: [],
    actualizadoEn: 0,
  };
}

function limpiarRespuestaIA(texto) {
  return String(texto)
    .replace(/\*\*/g, '*')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 900);
}

async function slotsDisponibles(fecha) {
  const citas = await citasDelDia(fecha);
  return slotsDelDia(fecha, {
    ocupados: citas.map((cita) => cita.hora),
    ahora: partesEnZona(),
  });
}

function primerDiaAbierto() {
  for (let dias = 1; dias <= 14; dias += 1) {
    const fecha = sumarDias(hoyISO(), dias);
    if (NEGOCIO.horario.dias.includes(diaSemana(fecha))) return fecha;
  }
  return null;
}

function generarCodigo() {
  return `NX-${randomBytes(2).toString('hex').toUpperCase()}`;
}

async function crearCitaConCodigoUnico(cita) {
  for (let intento = 0; intento < 6; intento += 1) {
    try {
      return await crearCita({ ...cita, codigo: generarCodigo(), creadaEn: Date.now() });
    } catch (error) {
      if (error.codigo !== 'CODIGO_DUPLICADO') throw error;
    }
  }
  throw new Error('No se pudo generar un código de cita único');
}

function iniciarAgenda(conversacion) {
  conversacion.estado = ESTADOS.AGENDAR_SERVICIO;
  conversacion.datos = {};
  return [mensajes.textoElegirServicio()];
}

async function iniciarCancelacion(conversacion) {
  const citas = await citasPorTelefono(conversacion.telefono);
  conversacion.estado = citas.length ? ESTADOS.CANCELAR : ESTADOS.MENU;
  conversacion.datos = { codigos: citas.map((cita) => cita.codigo) };
  return [mensajes.textoMisCitas(citas)];
}

function preguntaPendiente(conversacion) {
  const { estado, datos } = conversacion;
  switch (estado) {
    case ESTADOS.AGENDAR_SERVICIO:
      return mensajes.textoElegirServicio();
    case ESTADOS.AGENDAR_FECHA:
      return mensajes.textoPedirFecha();
    case ESTADOS.AGENDAR_HORA:
      return datos.slots?.length
        ? mensajes.textoSlots(datos.fecha, datos.slots)
        : mensajes.textoPedirFecha();
    case ESTADOS.AGENDAR_NOMBRE:
      return mensajes.textoPedirNombre();
    case ESTADOS.AGENDAR_CONFIRMAR:
      return mensajes.textoResumen(datos);
    case ESTADOS.CANCELAR:
      return 'Escribe el código de la cita que quieres cancelar (por ejemplo *NX-4F2A*).';
    default:
      return mensajes.textoMenu({ saludo: false });
  }
}

async function manejarServicio(conversacion, texto, normalizado) {
  const numero = normalizado.match(/^(\d{1,2})$/);
  let servicio = null;

  if (numero) {
    servicio = NEGOCIO.servicios[Number(numero[1]) - 1] || null;
  }
  if (!servicio) servicio = servicioPorTexto(texto);

  if (!servicio) {
    return [mensajes.textoElegirServicio()];
  }

  conversacion.datos = {
    servicioId: servicio.id,
    servicio: servicio.nombre,
    precio: servicio.precioTexto,
    duracion: servicio.duracion,
  };
  conversacion.estado = ESTADOS.AGENDAR_FECHA;
  return [mensajes.textoPedirFecha()];
}

async function manejarFecha(conversacion, texto) {
  const fecha = parsearFecha(texto);

  if (!fecha) {
    return [
      'No entendí la fecha. 🤔\n\nPuedes escribir *mañana*, *viernes* o una fecha como *30/10*.',
    ];
  }

  if (fecha > sumarDias(hoyISO(), DIAS_MAXIMOS)) {
    return [`Solo puedo agendar hasta ${DIAS_MAXIMOS} días adelante. ¿Probamos con una fecha más cercana?`];
  }

  if (!NEGOCIO.horario.dias.includes(diaSemana(fecha))) {
    return [mensajes.textoFueraDeHorario()];
  }

  const slots = await slotsDisponibles(fecha);
  if (!slots.length) {
    const sugerida = primerDiaAbierto();
    const pista = sugerida ? `\n\nEl próximo día que atendemos es *${formatearFechaLarga(sugerida)}*.` : '';
    return [`${mensajes.textoUltimoHorario()}${pista}`];
  }

  conversacion.datos.fecha = fecha;
  conversacion.datos.slots = slots;
  conversacion.estado = ESTADOS.AGENDAR_HORA;
  return [mensajes.textoSlots(fecha, slots)];
}

async function manejarHora(conversacion, texto, normalizado) {
  const slots = conversacion.datos.slots || [];
  if (!slots.length) {
    conversacion.estado = ESTADOS.AGENDAR_FECHA;
    return [mensajes.textoPedirFecha()];
  }

  let hora = null;
  const numero = normalizado.match(/^(\d{1,2})$/);
  if (numero) {
    hora = slots[Number(numero[1]) - 1] || null;
  }
  if (!hora) hora = parsearHora(texto);

  if (!hora || !slots.includes(hora)) {
    const alternativas = slots.slice(0, 6).map(formatearHora).join(', ');
    return [
      `Ese horario no está disponible. 😕\n\nOpciones para ese día: ${alternativas}.\n\nResponde con el número de la lista o escribe otra hora.`,
    ];
  }

  conversacion.datos.hora = hora;
  conversacion.estado = ESTADOS.AGENDAR_NOMBRE;
  return [mensajes.textoPedirNombre()];
}

function manejarNombre(conversacion, texto) {
  const nombre = texto
    .replace(/^(me llamo|mi nombre es|soy)\s+/i, '')
    .replace(/[^\p{L}\s'.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const letras = (nombre.match(/\p{L}/gu) || []).length;
  if (letras < 3) {
    return ['Necesito tu nombre completo para la cita. ¿Cómo te llamas?'];
  }

  conversacion.datos.nombre = nombre.slice(0, 80);
  conversacion.estado = ESTADOS.AGENDAR_CONFIRMAR;
  return [mensajes.textoResumen(conversacion.datos)];
}

async function manejarConfirmacion(conversacion, texto, normalizado) {
  if (/^(1|si|confirmar|confirmo|ok|va|dale)$/.test(normalizado)) {
    return confirmarCita(conversacion);
  }

  if (/^(2|cambiar|otra fecha|cambiar fecha)$/.test(normalizado)) {
    conversacion.datos.fecha = null;
    conversacion.datos.hora = null;
    conversacion.datos.slots = [];
    conversacion.estado = ESTADOS.AGENDAR_FECHA;
    return [mensajes.textoPedirFecha()];
  }

  if (/^(3|no|cancelar)$/.test(normalizado)) {
    conversacion.estado = ESTADOS.MENU;
    conversacion.datos = {};
    return ['Sin problema, no agendé nada. 👍\n\n' + mensajes.textoMenu({ saludo: false })];
  }

  return [mensajes.textoResumen(conversacion.datos)];
}

async function reofrecerHorarios(conversacion, motivo) {
  const { datos } = conversacion;
  const slots = await slotsDisponibles(datos.fecha);

  if (!slots.length) {
    conversacion.estado = ESTADOS.AGENDAR_FECHA;
    delete datos.hora;
    datos.slots = [];
    return [`${motivo}\n\n${mensajes.textoUltimoHorario()}`];
  }

  datos.slots = slots;
  delete datos.hora;
  conversacion.estado = ESTADOS.AGENDAR_HORA;
  return [`${motivo}\n\n${mensajes.textoSlots(datos.fecha, slots)}`];
}

async function confirmarCita(conversacion) {
  const { datos } = conversacion;
  const citas = await citasDelDia(datos.fecha);

  // Alguien pudo tomar el horario mientras el cliente escribía su nombre.
  if (citas.some((cita) => cita.hora === datos.hora)) {
    return reofrecerHorarios(
      conversacion,
      'Ese horario se acaba de ocupar. 😕 Te muestro los que siguen libres.',
    );
  }

  let cita;
  try {
    cita = await crearCitaConCodigoUnico({
      telefono: conversacion.telefono,
      canal: conversacion.canal,
      nombre: datos.nombre,
      servicioId: datos.servicioId,
      servicio: datos.servicio,
      precio: datos.precio,
      duracion: datos.duracion,
      fecha: datos.fecha,
      hora: datos.hora,
      estado: 'confirmada',
      empresa: datos.empresa || '',
    });
  } catch (error) {
    // La transacción de Firestore también puede rechazar la reserva si otro
    // cliente confirmó el mismo bloque entre la comprobación y la escritura.
    if (error.codigo === 'HORARIO_OCUPADO') {
      return reofrecerHorarios(
        conversacion,
        'Justo se ocupó ese horario. 😕 Te muestro los que siguen libres.',
      );
    }
    throw error;
  }

  conversacion.estado = ESTADOS.MENU;
  conversacion.datos = {};

  return {
    respuestas: [mensajes.textoCitaConfirmada(cita)],
    cita,
    notificar: { tipo: 'nueva_cita', cita },
  };
}

async function manejarCancelacion(conversacion, texto) {
  if (/^(no|salir|detener|atras)$/.test(normalizar(texto))) {
    conversacion.estado = ESTADOS.MENU;
    conversacion.datos = {};
    return { respuestas: ['Sin problema, no cancelé nada. 👍\n\n' + mensajes.textoMenu({ saludo: false })] };
  }

  const codigos = conversacion.datos.codigos || [];
  const enMayusculas = String(texto).toUpperCase();
  const delTexto = enMayusculas.match(/NX-[A-Z0-9]{4}/);
  const codigo = delTexto?.[0] || codigos.find((c) => enMayusculas.includes(c)) || null;

  if (!codigo) {
    const citas = await citasPorTelefono(conversacion.telefono);
    if (!citas.length) {
      conversacion.estado = ESTADOS.MENU;
      conversacion.datos = {};
      return [mensajes.textoMisCitas([])];
    }
    return ['No reconocí ese código. Responde con el código tal como aparece, por ejemplo *NX-4F2A*.'];
  }

  const cita = await cancelarCita(codigo, conversacion.telefono);
  if (!cita) {
    return ['No encontré una cita activa con ese código. Verifica que sea el correcto.'];
  }

  conversacion.estado = ESTADOS.MENU;
  conversacion.datos = {};
  return {
    respuestas: [mensajes.textoCitaCancelada(cita) + '\n\n' + mensajes.textoMenu({ saludo: false })],
    cita,
    notificar: { tipo: 'cita_cancelada', cita },
  };
}

function limpiarAntesDeTexto(respuestas) {
  return respuestas.filter((respuesta) => typeof respuesta === 'string');
}

async function enrutar(conversacion, texto, normalizado) {
  const enFlujo = conversacion.estado.startsWith('agendar_');

  // "menú" siempre devuelve al inicio, incluso a media conversación.
  if (INTENCIONES.menu.test(normalizado)) {
    conversacion.estado = ESTADOS.MENU;
    conversacion.datos = {};
    return [mensajes.textoMenu({ saludo: false })];
  }

  if (enFlujo && INTENCIONES.atras.test(normalizado)) {
    switch (conversacion.estado) {
      case ESTADOS.AGENDAR_FECHA:
        conversacion.estado = ESTADOS.AGENDAR_SERVICIO;
        conversacion.datos = {};
        return [mensajes.textoElegirServicio()];
      case ESTADOS.AGENDAR_HORA:
        conversacion.estado = ESTADOS.AGENDAR_FECHA;
        delete conversacion.datos.hora;
        return [mensajes.textoPedirFecha()];
      case ESTADOS.AGENDAR_NOMBRE:
        conversacion.estado = ESTADOS.AGENDAR_HORA;
        return [mensajes.textoSlots(conversacion.datos.fecha, conversacion.datos.slots || [])];
      case ESTADOS.AGENDAR_CONFIRMAR:
        conversacion.estado = ESTADOS.AGENDAR_NOMBRE;
        return [mensajes.textoPedirNombre()];
      default:
        conversacion.estado = ESTADOS.MENU;
        conversacion.datos = {};
        return [mensajes.textoMenu({ saludo: false })];
    }
  }

  if (enFlujo && /^(cancelar|no|salir|detener)$/.test(normalizado)) {
    conversacion.estado = ESTADOS.MENU;
    conversacion.datos = {};
    return ['Sin problema, no agendé nada. 👍\n\n' + mensajes.textoMenu({ saludo: false })];
  }

  // Pedir un asesor funciona en cualquier punto de la conversación.
  if (INTENCIONES.asesor.test(normalizado)) {
    const nombre = conversacion.datos?.nombre;
    conversacion.estado = ESTADOS.MENU;
    conversacion.datos = {};
    return {
      respuestas: [mensajes.textoAsesor()],
      notificar: { tipo: 'asesor', telefono: conversacion.telefono, nombre },
    };
  }

  switch (conversacion.estado) {
    case ESTADOS.AGENDAR_SERVICIO:
      return manejarServicio(conversacion, texto, normalizado);
    case ESTADOS.AGENDAR_FECHA:
      return manejarFecha(conversacion, texto);
    case ESTADOS.AGENDAR_HORA:
      return manejarHora(conversacion, texto, normalizado);
    case ESTADOS.AGENDAR_NOMBRE:
      return manejarNombre(conversacion, texto);
    case ESTADOS.AGENDAR_CONFIRMAR:
      return manejarConfirmacion(conversacion, texto, normalizado);
    case ESTADOS.CANCELAR:
      return manejarCancelacion(conversacion, texto);
    case ESTADOS.CV_FORMATO: {
      const cvOpcion = normalizado.match(/^([1-8])$/);
      if (!cvOpcion) return [mensajes.textoCVFormato()];

      const cv = NEGOCIO.cv.opciones[Number(cvOpcion[1]) - 1];
      if (!cv) return [mensajes.textoCVFormato()];

      conversacion.estado = ESTADOS.MENU;
      conversacion.datos = {};
      return [
        `✅ *${cv.nombre}*\n` +
        `📄 Formato: ${cv.formato}\n\n` +
        `Descárgalo aquí: ${cv.url}\n\n` +
        `Si quieres otra versión, escribe *CV*. Escribe *menú* para volver a las opciones.`,
      ];
    }
    case ESTADOS.PROYECTOS_LISTA: {
      const indiceProyecto = normalizado.match(/^([1-9])$/);
      if (indiceProyecto) {
        const proyecto = NEGOCIO.proyectos[Number(indiceProyecto[1]) - 1];
        if (!proyecto) {
          return [
            `Ese número no está en la lista. Elige del 1 al ${NEGOCIO.proyectos.length} o escribe *menú*.`,
          ];
        }
        return [mensajes.textoProyectoDetalle(proyecto)];
      }
      break;
    }
    case ESTADOS.AVISAR_PROPIA:
      conversacion.estado = ESTADOS.MENU;
      conversacion.datos = {};
      // Notificar al dueño (número configurado en OWNER_PHONE)
      const aviso = `📩 *Nuevo mensaje para el dueño*\n${texto}`;
      notificarEquipo(aviso).then(() => {}).catch(() => console.log('No se pudo enviar aviso'));
      return [
        '✅ *Mensaje enviado al dueño del negocio*.\n\n' +
        'Te responderé por este mismo chat cuando pueda. Escribe *menú* para volver a las opciones.',
      ];
    default:
      break;
  }

  // Si el cliente pega solo el código de su cita, se entiende que quiere
  // cancelarla. Así no depende de que escriba antes la palabra "cancelar".
  const codigoEnTexto = String(texto).toUpperCase().match(/NX-[A-Z0-9]{4}/);
  if (codigoEnTexto) {
    const citas = await citasPorTelefono(conversacion.telefono);
    const propia = citas.find((cita) => cita.codigo === codigoEnTexto[0]);

    if (!propia) {
      return ['No encontré una cita activa con ese código. Verifica que sea el correcto.'];
    }

    conversacion.estado = ESTADOS.CANCELAR;
    conversacion.datos = { codigos: [propia.codigo] };
    return manejarCancelacion(conversacion, propia.codigo);
  }

  // A partir de aquí es texto libre.
  if (INTENCIONES.cancelar.test(normalizado)) {
    return [await iniciarCancelacion(conversacion)].flat();
  }

  if (INTENCIONES.misCitas.test(normalizado)) {
    return [await iniciarCancelacion(conversacion)].flat();
  }

  if (INTENCIONES.cv.test(normalizado)) {
    conversacion.estado = ESTADOS.CV_FORMATO;
    return [mensajes.textoCVFormato()];
  }

  if (INTENCIONES.proyectos.test(normalizado)) {
    conversacion.estado = ESTADOS.PROYECTOS_LISTA;
    return [mensajes.textoProyectos()];
  }

  if (INTENCIONES.perfil.test(normalizado)) {
    conversacion.estado = ESTADOS.MENU;
    return [mensajes.textoPerfil()];
  }

  if (INTENCIONES.agendar.test(normalizado)) {
    return iniciarAgenda(conversacion);
  }

  if (INTENCIONES.servicios.test(normalizado)) {
    conversacion.estado = ESTADOS.MENU;
    return [mensajes.textoServicios()];
  }

  if (conversacion.estado === ESTADOS.INICIO) {
    // En el primer mensaje se saluda con el menú, pero si la persona llega
    // con una pregunta concreta se intenta responder directamente.
    conversacion.estado = ESTADOS.MENU;
    if (INTENCIONES.saludo.test(normalizado)) return [mensajes.textoMenu()];
  }

  const opcion = normalizado.match(/^([1-5])$/);
  if (opcion) {
    switch (opcion[1]) {
      case '1':
        conversacion.estado = ESTADOS.CV_FORMATO;
        return [mensajes.textoCVFormato()];
      case '2':
        conversacion.estado = ESTADOS.PROYECTOS_LISTA;
        return [mensajes.textoProyectos()];
      case '3':
        return iniciarAgenda(conversacion);
      case '4':
        conversacion.estado = ESTADOS.MENU;
        conversacion.datos = {};
        return [mensajes.textoPerfil()];
      case '5':
        conversacion.estado = ESTADOS.AVISAR_PROPIA;
        return [mensajes.textoPedirMensaje()];
      default:
        break;
    }
  }

  if (INTENCIONES.saludo.test(normalizado)) {
    return [preguntaPendiente(conversacion)];
  }

  if (INTENCIONES.agradece.test(normalizado)) {
    return ['¡Con gusto! 😊 Si necesitas algo más, escribe *menú*.'];
  }

  // Último recurso: IA y, si falla, preguntas frecuentes locales.
  const ia = await responderConIA({
    mensaje: texto,
    historial: conversacion.historial,
  });
  if (ia) return [limpiarRespuestaIA(ia.texto)];

  const frecuente = respuestaFrecuente(normalizado);
  if (frecuente) return [frecuente];

  return [mensajes.textoNoEntendi()];
}

/**
 * Punto de entrada único. Devuelve:
 * { respuestas: string[], estado, cita?, notificar? }
 */
export async function procesarMensaje({ telefono, texto, canal = 'whatsapp' }) {
  const id = idDeConversacion(telefono, canal);
  let conversacion = await obtenerConversacion(id);
  if (!conversacion) conversacion = nuevaConversacion(telefono, canal);

  const mensaje = String(texto || '').trim().slice(0, 800);
  if (!mensaje) {
    return { respuestas: [mensajes.textoNoEntendi()], estado: conversacion.estado };
  }

  const normalizado = normalizar(mensaje);
  const resultado = await enrutar(conversacion, mensaje, normalizado);

  // Algunos manejadores devuelven un objeto con metadatos; otros, solo textos.
  const salida = Array.isArray(resultado)
    ? { respuestas: limpiarAntesDeTexto(resultado) }
    : { respuestas: limpiarAntesDeTexto(resultado.respuestas || []), ...resultado };

  salida.respuestas = salida.respuestas.filter(Boolean);

  conversacion.historial = [
    ...conversacion.historial,
    { rol: 'usuario', texto: mensaje },
    ...salida.respuestas.map((respuesta) => ({ rol: 'bot', texto: respuesta })),
  ].slice(-MAX_HISTORIAL);

  await guardarConversacion(id, conversacion);

  return {
    ...salida,
    estado: conversacion.estado,
  };
}

/** Reinicia la conversación (botón "empezar de nuevo" de la demo). */
export async function reiniciarConversacion({ telefono, canal = 'demo' }) {
  const id = idDeConversacion(telefono, canal);
  const conversacion = nuevaConversacion(telefono, canal);
  await guardarConversacion(id, conversacion);
  return conversacion;
}
