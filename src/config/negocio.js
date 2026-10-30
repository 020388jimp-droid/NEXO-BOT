// Datos del negocio que alimentan al bot y a la IA.
// Todo se puede cambiar por variables de entorno sin tocar el código, así el
// mismo motor sirve para una clínica, un salón de belleza o un taller.

const precio = (valor) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor);

const serviciosBase = [
  {
    id: 'limpieza',
    nombre: 'Limpieza dental',
    precio: 600,
    duracion: 30,
    descripcion: 'Limpieza profunda con ultrasonido y revisión general.',
  },
  {
    id: 'blanqueamiento',
    nombre: 'Blanqueamiento',
    precio: 2500,
    duracion: 60,
    descripcion: 'Blanqueamiento en consultorio con luz LED, resultado en una sesión.',
  },
  {
    id: 'valoracion',
    nombre: 'Valoración de ortodoncia',
    precio: 300,
    duracion: 30,
    descripcion: 'Estudio inicial y plan de tratamiento con brackets o alineadores.',
  },
  {
    id: 'consulta',
    nombre: 'Consulta general',
    precio: 400,
    duracion: 30,
    descripcion: 'Diagnóstico, revisión y presupuesto sin compromiso.',
  },
];

export const NEGOCIO = {
  nombre: process.env.BUSINESS_NAME || 'Clínica Dental Nova',
  descripcion:
    process.env.BUSINESS_DESCRIPTION ||
    'Clínica dental con más de 10 años de experiencia en la Ciudad de México. Atención personalizada, tecnología digital y planes de pago.',
  zona: process.env.BUSINESS_TZ || 'America/Mexico_City',
  telefono: process.env.BUSINESS_PHONE || '+52 55 1234 5678',
  direccion: process.env.BUSINESS_ADDRESS || 'Av. Reforma 123, Col. Centro, Ciudad de México',
  correo: process.env.BUSINESS_EMAIL || 'hola@dentalnova.mx',
  sitio: process.env.BUSINESS_SITE || '',
  horario: {
    apertura: Number(process.env.BUSINESS_OPEN_HOUR || 9),
    cierre: Number(process.env.BUSINESS_CLOSE_HOUR || 19),
    // 0 = domingo. Se descansan los domingos.
    dias: (process.env.BUSINESS_DAYS || '1,2,3,4,5,6')
      .split(',')
      .map((dia) => Number(dia.trim()))
      .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6),
    duracionCita: Number(process.env.BUSINESS_SLOT_MINUTES || 30),
  },
  pagos: process.env.BUSINESS_PAYMENTS || 'Efectivo, tarjeta de crédito/débito y transferencia. También manejamos meses sin intereses.',
  servicios: serviciosBase.map((servicio) => ({
    ...servicio,
    precioTexto: precio(servicio.precio),
  })),
  faqs: [
    {
      claves: ['horario', 'abren', 'cierran', 'abierto', 'hora'],
      pregunta: '¿Cuál es el horario?',
      respuesta: 'Atendemos de lunes a sábado de 9:00 a. m. a 7:00 p. m. Los domingos no abrimos.',
    },
    {
      claves: ['donde', 'ubicacion', 'direccion', 'llegar', 'sucursal'],
      pregunta: '¿Dónde están ubicados?',
      respuesta: 'Estamos en Av. Reforma 123, Col. Centro, Ciudad de México. A dos calles del metro Hidalgo.',
    },
    {
      claves: ['pago', 'pagar', 'tarjeta', 'efectivo', 'meses', 'intereses', 'mensualidad'],
      pregunta: '¿Qué formas de pago aceptan?',
      respuesta: 'Aceptamos efectivo, tarjeta de crédito/débito y transferencia. También manejamos meses sin intereses.',
    },
    {
      claves: ['estacionamiento', 'coche', 'carro', 'parking'],
      pregunta: '¿Hay estacionamiento?',
      respuesta: 'Sí, tenemos estacionamiento gratuito para pacientes por 2 horas.',
    },
    {
      claves: ['urgente', 'urgencia', 'dolor', 'duele', 'emergencia'],
      pregunta: '¿Atienden urgencias?',
      respuesta: 'Sí. Si tienes dolor agudo, escríbenos y te damos prioridad el mismo día. Para emergencias fuera de horario llama al +52 55 1234 5678.',
    },
    {
      claves: ['nino', 'ninos', 'infantil', 'odontopediatra', 'pequenos', 'hijos'],
      pregunta: '¿Atienden niños?',
      respuesta: 'Sí, atendemos niños desde los 6 años. Para los más pequeños recomendamos una consulta general y, si hace falta, los canalizamos con odontopediatría.',
    },
    {
      claves: ['seguro', 'aseguradora', 'gastos medicos', 'reembolso'],
      pregunta: '¿Aceptan seguros?',
      respuesta: 'Trabajamos con reembolso de gastos médicos mayores. Pídenos la factura y el informe clínico para tu aseguradora.',
    },
  ],
};

// Texto compacto que se inyecta en el prompt de Gemini. Mantenerlo corto
// reduce latencia y evita que el modelo invente datos.
export function contextoParaIA() {
  const { horario, servicios, faqs } = NEGOCIO;
  const listaServicios = servicios
    .map((servicio) => `- ${servicio.nombre}: ${servicio.precioTexto}, ${servicio.duracion} min. ${servicio.descripcion}`)
    .join('\n');
  const listaFaqs = faqs.map((faq) => `- ${faq.pregunta} ${faq.respuesta}`).join('\n');

  return `Negocio: ${NEGOCIO.nombre}
Qué hace: ${NEGOCIO.descripcion}
Dirección: ${NEGOCIO.direccion}
Teléfono: ${NEGOCIO.telefono}
Correo: ${NEGOCIO.correo}
Horario: ${horario.dias.map((dia) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia]).join(', ')} de ${horario.apertura}:00 a ${horario.cierre}:00 (${NEGOCIO.zona}).
Pagos: ${NEGOCIO.pagos}
Citas: se agendan en bloques de ${horario.duracionCita} minutos.

Servicios:
${listaServicios}

Preguntas frecuentes:
${listaFaqs}`;
}

export function servicioPorId(id) {
  return NEGOCIO.servicios.find((servicio) => servicio.id === id) || null;
}

export function servicioPorTexto(texto) {
  const buscado = String(texto || '').toLowerCase();
  return (
    NEGOCIO.servicios.find((servicio) => buscado.includes(servicio.nombre.toLowerCase())) ||
    NEGOCIO.servicios.find((servicio) => servicio.id === buscado) ||
    null
  );
}
