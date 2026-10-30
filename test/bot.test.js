// Pruebas del motor conversacional sin red ni credenciales.
// Se ejecutan con: npm test

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ALMACEN = 'memoria';
process.env.BUSINESS_TZ = 'America/Mexico_City';
delete process.env.GEMINI_API_KEY;

const { procesarMensaje } = await import('../src/services/conversacion.js');
const { citasDelDia, crearCita, cancelarCita, reiniciarAlmacenParaPruebas } = await import('../src/services/almacen.js');
const { NEGOCIO } = await import('../src/config/negocio.js');
const {
  diaSemana,
  formatearFechaLarga,
  formatearHora,
  hoyISO,
  parsearFecha,
  parsearHora,
  slotsDelDia,
  sumarDias,
} = await import('../src/services/fechas.js');

const siguienteDiaAbierto = () => {
  for (let dias = 1; dias <= 14; dias += 1) {
    const fecha = sumarDias(hoyISO(), dias);
    if (NEGOCIO.horario.dias.includes(diaSemana(fecha))) return fecha;
  }
  throw new Error('No hay días abiertos');
};

test('interpreta fechas en lenguaje natural', () => {
  const hoy = '2026-10-30'; // viernes
  assert.equal(parsearFecha('hoy', { hoy }), '2026-10-30');
  assert.equal(parsearFecha('mañana', { hoy }), '2026-10-31');
  assert.equal(parsearFecha('pasado mañana', { hoy }), '2026-11-01');
  assert.equal(parsearFecha('en 3 días', { hoy }), '2026-11-02');
  assert.equal(parsearFecha('el lunes', { hoy }), '2026-11-02');
  assert.equal(parsearFecha('30/11', { hoy }), '2026-11-30');
  assert.equal(parsearFecha('2026-12-24', { hoy }), '2026-12-24');
  assert.equal(parsearFecha('24 de diciembre', { hoy }), '2026-12-24');
  assert.equal(parsearFecha('el 15', { hoy }), '2026-11-15');
  assert.equal(parsearFecha('no sé', { hoy }), null);
  assert.equal(parsearFecha('31/02', { hoy }), null);
});

test('interpreta horas como las escribe la gente', () => {
  assert.equal(parsearHora('4'), '16:00');
  assert.equal(parsearHora('9'), '09:00');
  assert.equal(parsearHora('4pm'), '16:00');
  assert.equal(parsearHora('a las 11'), '11:00');
  assert.equal(parsearHora('16:30'), '16:30');
  assert.equal(parsearHora('3:30 p. m.'), '15:30');
  assert.equal(parsearHora('3:30 p.m.'), '15:30');
  assert.equal(parsearHora('3:30'), '15:30');
  assert.equal(parsearHora('12:00 a. m.'), '00:00');
  assert.equal(parsearHora('9 a. m.'), '09:00');
  assert.equal(parsearHora('4 de la tarde'), '16:00');
  assert.equal(parsearHora('12:00 p. m.'), '12:00');
  assert.equal(parsearHora('hola'), null);
});

test('los horarios ocupados no se ofrecen', () => {
  const fecha = siguienteDiaAbierto();
  const slots = slotsDelDia(fecha, {
    ocupados: ['09:00', '09:30'],
    ahora: { fecha: '2000-01-01', minutos: 0 },
  });
  assert.equal(slots.includes('09:00'), false);
  assert.equal(slots.includes('09:30'), false);
  assert.equal(slots[0], '10:00');
  assert.ok(slots.length > 0);
});

test('flujo completo: menú, servicio, fecha, hora, nombre y confirmación', async () => {
  reiniciarAlmacenParaPruebas();
  const telefono = '5215511111111';
  const fecha = siguienteDiaAbierto();

  let r = await procesarMensaje({ telefono, texto: 'hola' });
  assert.match(r.respuestas[0], /NEXO/);
  assert.match(r.respuestas[0], /Agendar una cita/);

  r = await procesarMensaje({ telefono, texto: '2' });
  assert.match(r.respuestas[0], /Qué servicio/);

  r = await procesarMensaje({ telefono, texto: '1' });
  assert.match(r.respuestas[0], /Para qué día/);

  r = await procesarMensaje({ telefono, texto: fecha });
  assert.match(r.respuestas[0], /Horarios disponibles/);

  r = await procesarMensaje({ telefono, texto: '1' });
  assert.match(r.respuestas[0], /nombre/i);

  r = await procesarMensaje({ telefono, texto: '1' });
  assert.match(r.respuestas[0], /nombre completo/i, 'un número no es un nombre');

  r = await procesarMensaje({ telefono, texto: 'Ana López' });
  assert.match(r.respuestas[0], /Confirma tu cita/);

  r = await procesarMensaje({ telefono, texto: '1' });
  assert.match(r.respuestas[0], /Cita confirmada/);
  assert.match(r.cita.codigo, /^NX-[A-F0-9]{4}$/);
  assert.equal(r.cita.nombre, 'Ana López');
  assert.equal(r.cita.fecha, fecha);

  const citas = await citasDelDia(fecha);
  assert.equal(citas.length, 1);
  assert.equal(citas[0].telefono, telefono);
});

test('se puede cancelar una cita con su código', async () => {
  reiniciarAlmacenParaPruebas();
  const telefono = '5215522222222';
  const fecha = siguienteDiaAbierto();

  await procesarMensaje({ telefono, texto: 'agendar cita' });
  await procesarMensaje({ telefono, texto: '2' });
  await procesarMensaje({ telefono, texto: fecha });
  await procesarMensaje({ telefono, texto: '1' });
  await procesarMensaje({ telefono, texto: 'Carlos Ruiz' });
  const confirmacion = await procesarMensaje({ telefono, texto: 'confirmar' });
  const { codigo } = confirmacion.cita;

  let r = await procesarMensaje({ telefono, texto: 'cancelar' });
  assert.match(r.respuestas[0], /Tus próximas citas/);
  assert.match(r.respuestas[0], new RegExp(codigo));

  r = await procesarMensaje({ telefono, texto: codigo });
  assert.match(r.respuestas[0], /cancelé tu cita/);

  const citas = await citasDelDia(fecha);
  assert.equal(citas.length, 0);
});

test('enviar solo el código también cancela la cita', async () => {
  reiniciarAlmacenParaPruebas();
  const telefono = '5215555555555';
  const fecha = siguienteDiaAbierto();

  await crearCita({
    codigo: 'NX-1234',
    telefono,
    canal: 'test',
    nombre: 'Ana Torres',
    servicioId: 'limpieza',
    servicio: 'Limpieza dental',
    precio: '$600',
    duracion: 30,
    fecha,
    hora: '12:00',
    estado: 'confirmada',
  });

  const r = await procesarMensaje({ telefono, texto: 'NX-1234' });
  assert.match(r.respuestas[0], /cancelé tu cita/);
  assert.equal((await citasDelDia(fecha)).length, 0);
});

test('un horario no se puede reservar dos veces', async () => {
  reiniciarAlmacenParaPruebas();
  const fecha = siguienteDiaAbierto();

  const base = {
    telefono: '5215599999999',
    canal: 'test',
    nombre: 'Cliente Uno',
    servicioId: 'limpieza',
    servicio: 'Limpieza dental',
    precio: '$600',
    duracion: 30,
    fecha,
    hora: '11:00',
    estado: 'confirmada',
  };

  await crearCita({ ...base, codigo: 'NX-AAAA' });
  await assert.rejects(
    () => crearCita({ ...base, codigo: 'NX-BBBB' }),
    (error) => error.codigo === 'HORARIO_OCUPADO',
  );

  await cancelarCita('NX-AAAA', base.telefono);
  const liberada = await crearCita({ ...base, codigo: 'NX-CCCC' });
  assert.equal(liberada.codigo, 'NX-CCCC');
});

test('el menú reinicia la conversación en cualquier momento', async () => {  reiniciarAlmacenParaPruebas();
  const telefono = '5215533333333';

  await procesarMensaje({ telefono, texto: 'agendar cita' });
  const r = await procesarMensaje({ telefono, texto: 'menú' });
  assert.match(r.respuestas[0], /Servicios y precios/);
  assert.equal(r.estado, 'menu');
});

test('responde preguntas frecuentes sin IA', async () => {
  reiniciarAlmacenParaPruebas();
  const telefono = '5215544444444';

  const r = await procesarMensaje({ telefono, texto: '¿Tienen estacionamiento?' });
  assert.match(r.respuestas[0], /estacionamiento gratuito/i);
});

test('la demo y WhatsApp no comparten conversación', async () => {
  reiniciarAlmacenParaPruebas();
  const sesion = 'demo-abc';

  await procesarMensaje({ telefono: sesion, texto: 'agendar cita', canal: 'demo' });
  const enWhatsapp = await procesarMensaje({ telefono: sesion, texto: 'hola', canal: 'whatsapp' });

  assert.match(enWhatsapp.respuestas[0], /NEXO/);
});

test('formato de fecha y hora en español', () => {
  assert.match(formatearFechaLarga('2026-10-30'), /^viernes 30 de octubre/);
  assert.equal(formatearHora('16:30'), '4:30 p. m.');
  assert.equal(formatearHora('09:00'), '9:00 a. m.');
  assert.equal(formatearHora('12:00'), '12:00 p. m.');
});
