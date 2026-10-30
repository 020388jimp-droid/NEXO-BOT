// Utilidades de fecha y hora SIN dependencias externas.
//
// El bot corre en Cloud Run (UTC) pero el negocio vive en otra zona horaria.
// Todo el cálculo se hace con Intl y cadenas 'YYYY-MM-DD' / 'HH:mm' para que
// una cita guardada signifique siempre la misma hora local, sin importar
// dónde esté el servidor.

import { NEGOCIO } from '../config/negocio.js';

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ZONA = process.env.BUSINESS_TZ || NEGOCIO.zona;

/** Quita acentos y mayúsculas para comparar texto libre. */
export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Partes de una fecha en la zona del negocio: { fecha, hora, minutos }. */
export function partesEnZona(fecha = new Date(), zona = ZONA) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(fecha)
    .reduce((acumulado, parte) => {
      acumulado[parte.type] = parte.value;
      return acumulado;
    }, {});

  // Algunos motores devuelven "24" a medianoche.
  const hora = partes.hour === '24' ? '00' : partes.hour;
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${hora}:${partes.minute}`,
    minutos: Number(hora) * 60 + Number(partes.minute),
  };
}

export function hoyISO(zona = ZONA) {
  return partesEnZona(new Date(), zona).fecha;
}

export function esFechaValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export function sumarDias(iso, dias) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function diaSemana(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12)).getUTCDay();
}

export function formatearFechaLarga(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const texto = `${DIAS[diaSemana(iso)]} ${dia} de ${MESES[mes - 1]}`;
  return anio === Number(hoyISO().slice(0, 4)) ? texto : `${texto} de ${anio}`;
}

export function formatearHora(hhmm) {
  const [hora, minuto] = hhmm.split(':').map(Number);
  const sufijo = hora < 12 ? 'a. m.' : 'p. m.';
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return minuto === 0 ? `${hora12}:00 ${sufijo}` : `${hora12}:${String(minuto).padStart(2, '0')} ${sufijo}`;
}

/**
 * Interpreta fechas en lenguaje natural.
 * Acepta: hoy, mañana, pasado mañana, "en 3 días", viernes, "el 30",
 * "30/10", "30-10-2026", "2026-10-30" y "30 de octubre".
 * Devuelve 'YYYY-MM-DD' o null si no hay una fecha futura reconocible.
 */
export function parsearFecha(texto, { zona = ZONA, hoy = hoyISO(zona) } = {}) {
  const t = normalizar(texto);
  if (!t) return null;

  const candidatas = [];

  if (/\bhoy\b/.test(t)) candidatas.push(hoy);
  if (/\bpasado manana\b/.test(t)) candidatas.push(sumarDias(hoy, 2));
  if (/\bmanana\b/.test(t) && !/\bpasado manana\b/.test(t)) candidatas.push(sumarDias(hoy, 1));

  const enDias = t.match(/\ben (\d{1,2}) dias?\b/);
  if (enDias) candidatas.push(sumarDias(hoy, Number(enDias[1])));

  const iso = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) candidatas.push(`${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`);

  const numerica = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numerica) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let anio = numerica[3] ? Number(numerica[3]) : Number(hoy.slice(0, 4));
    if (anio < 100) anio += 2000;
    // Si la fecha ya pasó este año, se asume el próximo.
    const propuesta = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    candidatas.push(esFechaValida(propuesta) && propuesta >= hoy ? propuesta : `${anio + 1}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  }

  const conMes = t.match(/\b(\d{1,2}) de ([a-z]+)(?: de (\d{4}))?\b/);
  if (conMes) {
    const indiceMes = MESES.findIndex((mes) => normalizar(mes) === conMes[2]);
    if (indiceMes >= 0) {
      const anio = conMes[3] ? Number(conMes[3]) : Number(hoy.slice(0, 4));
      const propuesta = `${anio}-${String(indiceMes + 1).padStart(2, '0')}-${String(Number(conMes[1])).padStart(2, '0')}`;
      candidatas.push(esFechaValida(propuesta) && propuesta >= hoy ? propuesta : `${anio + 1}-${String(indiceMes + 1).padStart(2, '0')}-${String(Number(conMes[1])).padStart(2, '0')}`);
    }
  }

  const diaSemanaTexto = t.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (diaSemanaTexto) {
    const objetivo = DIAS.findIndex((dia) => normalizar(dia) === diaSemanaTexto[1]);
    if (objetivo >= 0) {
      let delta = (objetivo - diaSemana(hoy) + 7) % 7;
      if (delta === 0) delta = 7;
      candidatas.push(sumarDias(hoy, delta));
    }
  }

  // "el 30" sin mes: el próximo día 30.
  const soloDia = t.match(/\bel (\d{1,2})\b/);
  if (soloDia && !conMes && !numerica) {
    const dia = Number(soloDia[1]);
    if (dia >= 1 && dia <= 31) {
      const anio = Number(hoy.slice(0, 4));
      const mes = Number(hoy.slice(5, 7));
      let propuesta = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (!esFechaValida(propuesta) || propuesta < hoy) {
        const siguienteMes = mes === 12 ? 1 : mes + 1;
        const siguienteAnio = mes === 12 ? anio + 1 : anio;
        propuesta = `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      }
      candidatas.push(propuesta);
    }
  }

  const valida = candidatas.find((fecha) => esFechaValida(fecha) && fecha >= hoy);
  return valida || null;
}

/**
 * Interpreta horas: "4", "4pm", "16:30", "a las 9", "4 de la tarde".
 * Si solo viene un número de 1 a 7 se asume horario vespertino, que es como
 * habla la gente en un negocio que abre de 9 a 19.
 */
export function parsearHora(texto) {
  // "p. m.", "p.m." y "a. m." se convierten a "p m" / "a m" para que las
  // expresiones regulares de abajo los reconozcan.
  const t = normalizar(texto).replace(/\b([ap])\.\s*m\.?/g, '$1m');
  if (!t) return null;

  const conMinutos = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a m|p m|de la manana|de la tarde|de la noche)?\b/);
  if (conMinutos) {
    let hora = Number(conMinutos[1]);
    const minuto = Number(conMinutos[2]);
    if (hora > 23 || minuto > 59) return null;
    const sufijo = conMinutos[3] || '';
    if (/p\s*m|de la tarde|de la noche/.test(sufijo) && hora < 12) hora += 12;
    if (/a\s*m|de la manana/.test(sufijo) && hora === 12) hora = 0;
    // Sin sufijo, "3:30" se interpreta como 15:30 (igual que "3" → 15:00).
    if (!sufijo && hora >= 1 && hora <= 7) hora += 12;
    return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
  }

  const conSufijo = t.match(/\b(\d{1,2})\s*(am|pm|a m|p m|de la manana|de la tarde|de la noche)\b/);
  if (conSufijo) {
    let hora = Number(conSufijo[1]);
    if (hora > 12) return null;
    const sufijo = conSufijo[2];
    if (/p\s*m|de la tarde|de la noche/.test(sufijo) && hora < 12) hora += 12;
    if (/a\s*m|de la manana/.test(sufijo) && hora === 12) hora = 0;
    return `${String(hora).padStart(2, '0')}:00`;
  }

  const aLas = t.match(/\ba las? (\d{1,2})\b/);
  const suelta = aLas || t.match(/^(\d{1,2})$/);
  if (suelta) {
    let hora = Number(suelta[1]);
    if (hora >= 1 && hora <= 7) hora += 12;
    if (hora > 23) return null;
    return `${String(hora).padStart(2, '0')}:00`;
  }

  return null;
}

/** Bloques disponibles de un día, ya sin los ocupados ni los que ya pasaron. */
export function slotsDelDia(
  fecha,
  { ocupados = [], ahora = partesEnZona(), zona = ZONA, negocio = NEGOCIO } = {},
) {
  const { apertura, cierre, duracionCita } = negocio.horario;
  if (!esFechaValida(fecha)) return [];
  if (!negocio.horario.dias.includes(diaSemana(fecha))) return [];

  const ocupadosSet = new Set(ocupados);
  const slots = [];
  for (let minuto = apertura * 60; minuto + duracionCita <= cierre * 60; minuto += duracionCita) {
    const hora = `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`;
    const esHoy = fecha === ahora.fecha;
    // Se pide media hora de margen para que la cita no se agende "ya".
    if (esHoy && minuto < ahora.minutos + 30) continue;
    if (ocupadosSet.has(hora)) continue;
    slots.push(hora);
  }
  return slots;
}
