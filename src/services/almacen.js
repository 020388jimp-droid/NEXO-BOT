// Capa de persistencia con dos implementaciones intercambiables:
//   - memoria:    desarrollo local y pruebas (se pierde al reiniciar)
//   - firestore:  producción en Cloud Run (capa gratuita de Google)
//
// El resto del bot solo llama a estas funciones y no sabe dónde se guardan
// los datos. Así se puede migrar a Postgres sin tocar la conversación.

import { hoyISO } from './fechas.js';

const TTL_CONVERSACION_MS = 6 * 60 * 60 * 1000;

const memoria = {
  conversaciones: new Map(),
  citas: new Map(),
  bloqueos: new Set(),
};

let backend = null;
let tipoAlmacen = 'memoria';
let detalleAlmacen = 'memoria (los datos se pierden al reiniciar)';

const clonar = (valor) => (valor == null ? valor : JSON.parse(JSON.stringify(valor)));

// Una cita ocupa un bloque (fecha + hora). El bloqueo es lo que impide que dos
// clientes confirmen el mismo horario en el mismo instante.
const claveHorario = (fecha, hora) => `${fecha}_${String(hora).replace(':', '')}`;

function errorCodigoDuplicado() {
  const error = new Error('Código de cita duplicado');
  error.codigo = 'CODIGO_DUPLICADO';
  return error;
}

function errorHorarioOcupado() {
  const error = new Error('El horario ya está ocupado');
  error.codigo = 'HORARIO_OCUPADO';
  return error;
}

function limpiarConversacionesViejas() {
  const limite = Date.now() - TTL_CONVERSACION_MS;
  for (const [id, conversacion] of memoria.conversaciones) {
    if ((conversacion.actualizadoEn || 0) < limite) memoria.conversaciones.delete(id);
  }
}

const almacenMemoria = {
  async obtenerConversacion(id) {
    limpiarConversacionesViejas();
    return clonar(memoria.conversaciones.get(id) || null);
  },
  async guardarConversacion(id, conversacion) {
    memoria.conversaciones.set(id, clonar({ ...conversacion, actualizadoEn: Date.now() }));
  },
  async borrarConversacion(id) {
    memoria.conversaciones.delete(id);
  },
  async citasDelDia(fecha) {
    return [...memoria.citas.values()]
      .filter((cita) => cita.fecha === fecha && cita.estado === 'confirmada')
      .map(clonar);
  },
  async citasPorTelefono(telefono) {
    const hoy = hoyISO();
    return [...memoria.citas.values()]
      .filter((cita) => cita.telefono === telefono && cita.estado === 'confirmada' && cita.fecha >= hoy)
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
      .map(clonar);
  },
  async buscarCita(codigo, telefono) {
    const cita = memoria.citas.get(codigo);
    if (!cita || (telefono && cita.telefono !== telefono)) return null;
    return clonar(cita);
  },
  async crearCita(cita) {
    if (memoria.citas.has(cita.codigo)) throw errorCodigoDuplicado();
    const bloqueo = claveHorario(cita.fecha, cita.hora);
    if (memoria.bloqueos.has(bloqueo)) throw errorHorarioOcupado();
    memoria.bloqueos.add(bloqueo);
    memoria.citas.set(cita.codigo, clonar(cita));
    return clonar(cita);
  },
  async cancelarCita(codigo, telefono) {
    const cita = memoria.citas.get(codigo);
    if (!cita || cita.telefono !== telefono || cita.estado !== 'confirmada') return null;
    const cancelada = { ...cita, estado: 'cancelada', canceladaEn: Date.now() };
    memoria.citas.set(codigo, cancelada);
    memoria.bloqueos.delete(claveHorario(cita.fecha, cita.hora));
    return clonar(cancelada);
  },
  async totalCitas() {
    return memoria.citas.size;
  },
};

const COLECCION_CONVERSACIONES = 'conversaciones';
const COLECCION_CITAS = 'citas';
const COLECCION_AGENDA = 'agenda';

function almacenFirestore(db) {
  return {
    async obtenerConversacion(id) {
      const doc = await db.collection(COLECCION_CONVERSACIONES).doc(id).get();
      if (!doc.exists) return null;
      const datos = doc.data();
      // Firestore no guarda undefined; al leer puede faltar algún campo.
      return {
        telefono: datos.telefono,
        canal: datos.canal || 'whatsapp',
        estado: datos.estado || 'inicio',
        datos: datos.datos || {},
        historial: datos.historial || [],
        actualizadoEn: datos.actualizadoEn || 0,
      };
    },
    async guardarConversacion(id, conversacion) {
      await db.collection(COLECCION_CONVERSACIONES).doc(id).set(
        {
          telefono: conversacion.telefono,
          canal: conversacion.canal || 'whatsapp',
          estado: conversacion.estado,
          datos: conversacion.datos || {},
          historial: conversacion.historial || [],
          actualizadoEn: Date.now(),
        },
        { merge: false },
      );
    },
    async borrarConversacion(id) {
      await db.collection(COLECCION_CONVERSACIONES).doc(id).delete();
    },
    async citasDelDia(fecha) {
      const snap = await db
        .collection(COLECCION_CITAS)
        .where('fecha', '==', fecha)
        .where('estado', '==', 'confirmada')
        .get();
      return snap.docs.map((doc) => doc.data());
    },
    async citasPorTelefono(telefono) {
      const snap = await db.collection(COLECCION_CITAS).where('telefono', '==', telefono).get();
      return snap.docs
        .map((doc) => doc.data())
        .filter((cita) => cita.estado === 'confirmada' && cita.fecha >= hoyISO())
        .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
    },
    async buscarCita(codigo, telefono) {
      const doc = await db.collection(COLECCION_CITAS).doc(codigo).get();
      if (!doc.exists) return null;
      const cita = doc.data();
      if (telefono && cita.telefono !== telefono) return null;
      return cita;
    },
    async crearCita(cita) {
      const citaRef = db.collection(COLECCION_CITAS).doc(cita.codigo);
      const agendaRef = db.collection(COLECCION_AGENDA).doc(claveHorario(cita.fecha, cita.hora));

      // Transacción: leer el bloqueo y escribir la cita de forma atómica.
      // Si dos clientes confirman a la vez, Firestore serializa y el segundo
      // recibe HORARIO_OCUPADO en lugar de crear una cita duplicada.
      await db.runTransaction(async (transaccion) => {
        const ocupado = await transaccion.get(agendaRef);
        if (ocupado.exists) throw errorHorarioOcupado();

        const existente = await transaccion.get(citaRef);
        if (existente.exists) throw errorCodigoDuplicado();

        transaccion.set(agendaRef, {
          codigo: cita.codigo,
          telefono: cita.telefono,
          fecha: cita.fecha,
          hora: cita.hora,
          creadaEn: Date.now(),
        });
        transaccion.set(citaRef, cita);
      });

      return cita;
    },
    async cancelarCita(codigo, telefono) {
      const citaRef = db.collection(COLECCION_CITAS).doc(codigo);
      let cancelada = null;

      await db.runTransaction(async (transaccion) => {
        const doc = await transaccion.get(citaRef);
        if (!doc.exists) return;

        const cita = doc.data();
        if (cita.telefono !== telefono || cita.estado !== 'confirmada') return;

        cancelada = { ...cita, estado: 'cancelada', canceladaEn: Date.now() };
        transaccion.set(citaRef, cancelada);
        transaccion.delete(
          db.collection(COLECCION_AGENDA).doc(claveHorario(cita.fecha, cita.hora)),
        );
      });

      return cancelada;
    },
    async totalCitas() {
      const snap = await db.collection(COLECCION_CITAS).count().get();
      return snap.data().count;
    },
  };
}

/**
 * Elige el backend al arrancar. En Cloud Run las credenciales del servicio
 * llegan solas; en local se usa memoria para no tocar datos reales por error.
 */
export async function inicializarAlmacen() {
  const modo = (process.env.ALMACEN || '').toLowerCase();

  if (modo === 'memoria') {
    backend = almacenMemoria;
    tipoAlmacen = 'memoria';
    detalleAlmacen = 'memoria (forzado por ALMACEN=memoria)';
    return estadoAlmacen();
  }

  const hayEntornoGcp = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  if (modo !== 'firestore' && !hayEntornoGcp) {
    backend = almacenMemoria;
    tipoAlmacen = 'memoria';
    return estadoAlmacen();
  }

  try {
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    // Comprobación real de credenciales y permisos antes de confiar en él.
    await db.collection('_nexo').doc('ping').get();
    backend = almacenFirestore(db);
    tipoAlmacen = 'firestore';
    detalleAlmacen = `firestore (${db.projectId})`;
    console.log(`🗄️  Almacén: ${detalleAlmacen}`);
  } catch (error) {
    console.warn(`⚠️  No se pudo usar Firestore (${error.message}). Se usará memoria.`);
    backend = almacenMemoria;
    tipoAlmacen = 'memoria';
    detalleAlmacen = 'memoria (Firestore no disponible)';
  }

  return estadoAlmacen();
}

function asegurarBackend() {
  if (!backend) {
    backend = almacenMemoria;
    tipoAlmacen = 'memoria';
  }
  return backend;
}

export function estadoAlmacen() {
  return { tipo: tipoAlmacen, detalle: detalleAlmacen };
}

export async function obtenerConversacion(id) {
  return asegurarBackend().obtenerConversacion(id);
}

export async function guardarConversacion(id, conversacion) {
  return asegurarBackend().guardarConversacion(id, conversacion);
}

export async function borrarConversacion(id) {
  return asegurarBackend().borrarConversacion(id);
}

export async function citasDelDia(fecha) {
  return asegurarBackend().citasDelDia(fecha);
}

export async function citasPorTelefono(telefono) {
  return asegurarBackend().citasPorTelefono(telefono);
}

export async function buscarCita(codigo, telefono) {
  return asegurarBackend().buscarCita(String(codigo || '').toUpperCase(), telefono);
}

export async function crearCita(cita) {
  return asegurarBackend().crearCita(cita);
}

export async function cancelarCita(codigo, telefono) {
  return asegurarBackend().cancelarCita(String(codigo || '').toUpperCase(), telefono);
}

export async function totalCitas() {
  return asegurarBackend().totalCitas();
}

/** Solo para pruebas: deja el almacén en memoria y vacío. */
export function reiniciarAlmacenParaPruebas() {
  memoria.conversaciones.clear();
  memoria.citas.clear();
  memoria.bloqueos.clear();
  backend = almacenMemoria;
  tipoAlmacen = 'memoria';
  detalleAlmacen = 'memoria (pruebas)';
}
