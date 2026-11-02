// Perfil profesional que alimenta al bot, a la demo web y a Gemini.
//
// Este archivo es el único lugar que hay que tocar para cambiar el CV, los
// proyectos o las modalidades de entrevista. Los textos visibles están en
// src/services/mensajes.js y la lógica en src/services/conversacion.js.

const BASE_URL = (process.env.PUBLIC_URL || 'https://nexo-bot-7jjwi3rg7q-uc.a.run.app').replace(/\/$/, '');

const modalidadesBase = [
  {
    id: 'videollamada',
    nombre: 'Videollamada',
    emoji: '🎥',
    duracion: 30,
    claves: ['videollamada', 'video', 'meet', 'zoom', 'llamada de video'],
    descripcion: 'Google Meet o Zoom. Te comparto el enlace al confirmar.',
    instruccion: 'Te enviaré el enlace de Google Meet por este chat antes de la entrevista.',
  },
  {
    id: 'llamada',
    nombre: 'Llamada telefónica',
    emoji: '📞',
    duracion: 20,
    claves: ['llamada', 'telefono', 'telefonica', 'marcar'],
    descripcion: 'Te llamo al número desde el que escribes.',
    instruccion: 'Te llamaré al número de este chat a la hora acordada.',
  },
  {
    id: 'mensaje',
    nombre: 'Entrevista por mensaje',
    emoji: '💬',
    duracion: 30,
    claves: ['mensaje', 'whatsapp', 'chat', 'correo', 'email'],
    descripcion: 'Conversación por WhatsApp o correo, sin videollamada.',
    instruccion: 'La entrevista será por este mismo chat. Si prefieres correo, compárteme tu email.',
  },
];

const proyectosBase = [
  {
    id: 'ciencia-cool',
    nombre: 'Ciencia Cool',
    emoji: '🧪',
    anio: '2026',
    resumen: 'Generación y publicación automática de video científico con IA.',
    descripcion:
      'Pipeline en Node.js y Express: elige noticias por RSS, redacta el guion con Gemini, sintetiza la voz con Google Cloud TTS, renderiza el video con FFmpeg y lo publica en YouTube, Instagram, TikTok y Facebook.',
    stack: 'Node.js · Express · Gemini · Google Cloud · n8n · FFmpeg',
    demo: 'https://ciencia-cool-studio-271857970093.us-central1.run.app',
    codigo: 'https://github.com/020388jimp-droid/ciencia-cool',
  },
  {
    id: 'worklish',
    nombre: 'Worklish',
    emoji: '📚',
    anio: '2026',
    resumen: 'App de inglés profesional con tutor conversacional de IA.',
    descripcion:
      'Aplicación web y Android para practicar inglés con ejercicios, corrección y conversación con voz sobre Gemini. Frontend en React 19 y backend en Firebase Cloud Functions con Authentication y Firestore.',
    stack: 'React 19 · Firebase · Gemini · Tailwind · Android',
    demo: 'https://worklish-app-v2.firebaseapp.com',
    codigo: 'https://github.com/020388jimp-droid/WORKLISHv3',
  },
  {
    id: 'nexo-bot',
    nombre: 'NEXO BOT',
    emoji: '🤖',
    anio: '2026',
    resumen: 'Asistente de WhatsApp con IA para atención y agenda de entrevistas.',
    descripcion:
      'Bot conversacional con menú determinista, respuestas con Gemini, agenda de citas, notificaciones al dueño y persistencia en Firestore. Corre en Google Cloud Run y usa la WhatsApp Cloud API.',
    stack: 'Node.js · WhatsApp Cloud API · Gemini · Firestore · Cloud Run',
    demo: `${BASE_URL}/demo`,
    codigo: '',
  },
];

const faqsBase = [
  {
    claves: ['remoto', 'hibrido', 'presencial', 'modalidad', 'trabajo', 'puesto'],
    pregunta: '¿Qué tipo de trabajo buscas?',
    respuesta:
      'Busco un puesto de desarrollo o automatización de tiempo completo. Estoy abierto a remoto, híbrido o presencial en Guadalajara.',
  },
  {
    claves: ['donde', 'ubicacion', 'vives', 'ciudad', 'guadalajara', 'tonala', 'mudar', 'relocation'],
    pregunta: '¿Dónde vives?',
    respuesta: 'Vivo en Guadalajara, Jalisco, México. Puedo trabajar remoto o híbrido sin problema.',
  },
  {
    claves: ['ingles', 'idioma', 'english', 'bilingue'],
    pregunta: '¿Qué nivel de inglés tienes?',
    respuesta: 'Español nativo e inglés B1 con certificación EF SET. Puedo trabajar con documentación técnica en inglés.',
  },
  {
    claves: ['experiencia', 'anos', 'trayectoria', 'background'],
    pregunta: '¿Cuánta experiencia tienes?',
    respuesta:
      'Más de tres años en operación de redes, pruebas y diagnóstico de servidores, y docencia. A eso sumo dos aplicaciones full-stack con IA desplegadas en producción.',
  },
  {
    claves: ['stack', 'tecnologias', 'herramientas', 'lenguajes', 'sabes', 'manejas'],
    pregunta: '¿Cuál es tu stack?',
    respuesta:
      'JavaScript/Node.js, React 19, Express 5, Firebase, Firestore, Google Cloud Run, Docker, Gemini, n8n y SQL. Python y Java a nivel básico.',
  },
  {
    claves: ['sueldo', 'pretension', 'salario', 'expectativa', 'cuanto'],
    pregunta: '¿Cuál es tu expectativa salarial?',
    respuesta: 'Estoy abierto a negociarlo según el puesto, las responsabilidades y el esquema de trabajo.',
  },
  {
    claves: ['disponibilidad', 'horario', 'entrevista', 'cita', 'agendar', 'cuando'],
    pregunta: '¿Cuándo puedes tener una entrevista?',
    respuesta:
      'Lunes a viernes de 9:00 a 12:00. Algunas tardes también tengo espacio con cita previa. Escribe *entrevista* para ver los horarios libres.',
  },
  {
    claves: ['cv', 'curriculum', 'resume', 'hoja de vida'],
    pregunta: '¿Puedes compartir tu CV?',
    respuesta:
      'Claro. Escribe *CV* y te muestro las versiones disponibles en PDF y Word, en español y en inglés (las que terminan en EN).',
  },
  {
    claves: ['proyectos', 'portafolio', 'portfolio', 'github', 'repositorio'],
    pregunta: '¿Qué proyectos has hecho?',
    respuesta:
      'Ciencia Cool (video automático con IA), Worklish (tutor de inglés con IA) y NEXO BOT (este asistente de WhatsApp). Escribe *proyectos* para ver los enlaces.',
  },
  {
    claves: ['contacto', 'correo', 'email', 'telefono', 'linkedin', 'whatsapp'],
    pregunta: '¿Cómo te contacto?',
    respuesta:
      'Por correo: nacho020388@gmail.com. LinkedIn: linkedin.com/in/jose-ignacio-maldonado-perez. También puedes dejar un mensaje desde el menú.',
  },
  {
    claves: ['estudios', 'formacion', 'carrera', 'cedula', 'universidad'],
    pregunta: '¿Cuál es tu formación?',
    respuesta:
      'Ingeniería en Sistemas Computacionales por la Universidad de Desarrollo Nacional (UDN), 2018–2021. Cédula profesional 13727204.',
  },
  {
    claves: ['inicio', 'empezar', 'incorporarme', 'disponible'],
    pregunta: '¿Cuándo puedes empezar?',
    respuesta: 'Puedo platicarlo en la entrevista y ajustarme a un aviso razonable en mi trabajo actual.',
  },
  {
    claves: ['estacionamiento', 'parking', 'coche', 'carro'],
    pregunta: '¿Hay estacionamiento?',
    respuesta: 'No aplica para el asistente virtual, pero puedo reunirme en línea o en la ubicación que indiques.',
  },
];

export const NEGOCIO = {
  nombre: 'José Ignacio Maldonado Pérez',
  marca: 'NEXO',
  rol: 'Desarrollador Full-Stack y Automatización con IA',
  descripcion:
    'Ingeniero en Sistemas Computacionales con más de tres años de experiencia en redes, pruebas y docencia. Desarrollo aplicaciones full-stack y automatizaciones con IA, de la idea al despliegue en Google Cloud.',
  zona: process.env.BUSINESS_TZ || 'America/Mexico_City',
  telefono: '+52 33 4267 2004',
  correo: 'nacho020388@gmail.com',
  ubicacion: 'Guadalajara, Jalisco, México',
  direccion: 'Guadalajara, Jalisco, México',
  linkedin: 'https://linkedin.com/in/jose-ignacio-maldonado-perez',
  github: 'https://github.com/020388jimp-droid',
  sitio: 'https://github.com/020388jimp-droid',
  disponibilidad: 'Remoto, híbrido o presencial. Tiempo completo.',
  idiomas: 'Español nativo · Inglés B1 (EF SET)',
  cv: {
    opciones: [
      { id: 'automatizacion-es-pdf', nombre: 'CV Automatización · Español', formato: 'PDF', url: `${BASE_URL}/cv/CV-Automatizacion-ES.pdf` },
      { id: 'automatizacion-es-word', nombre: 'CV Automatización · Español', formato: 'Word (.docx)', url: `${BASE_URL}/cv/CV-Automatizacion-ES.docx` },
      { id: 'automatizacion-en-pdf', nombre: 'CV Automation · Inglés (EN)', formato: 'PDF', url: `${BASE_URL}/cv/CV-Automation-EN.pdf` },
      { id: 'automatizacion-en-word', nombre: 'CV Automation · Inglés (EN)', formato: 'Word (.docx)', url: `${BASE_URL}/cv/CV-Automation-EN.docx` },
      { id: 'fullstack-es-pdf', nombre: 'CV Full-Stack · Español', formato: 'PDF', url: `${BASE_URL}/cv/CV-Full-Stack-ES.pdf` },
      { id: 'fullstack-es-word', nombre: 'CV Full-Stack · Español', formato: 'Word (.docx)', url: `${BASE_URL}/cv/CV-Full-Stack-ES.docx` },
      { id: 'fullstack-en-pdf', nombre: 'CV Full-Stack · Inglés (EN)', formato: 'PDF', url: `${BASE_URL}/cv/CV-Full-Stack-EN.pdf` },
      { id: 'fullstack-en-word', nombre: 'CV Full-Stack · Inglés (EN)', formato: 'Word (.docx)', url: `${BASE_URL}/cv/CV-Full-Stack-EN.docx` },
    ],
  },
  horario: {
    apertura: 9,
    cierre: 12,
    // 0 = domingo. Las tardes se agregan por semana desde WhatsApp.
    dias: (process.env.BUSINESS_DAYS || '1,2,3,4,5')
      .split(',')
      .map((dia) => Number(dia.trim()))
      .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6),
    duracionCita: 30,
  },
  modalidades: modalidadesBase.map((modalidad) => ({
    ...modalidad,
    precio: 0,
    precioTexto: '—',
  })),
  proyectos: proyectosBase,
  faqs: faqsBase,
};

// El motor de agenda sigue hablando de "servicios" internamente. Para el
// perfil profesional, un servicio es una modalidad de entrevista.
NEGOCIO.servicios = NEGOCIO.modalidades;

// Texto compacto que se inyecta en el prompt de Gemini. Mantenerlo corto
// reduce latencia y evita que el modelo invente datos.
export function contextoParaIA() {
  const { horario, modalidades, proyectos, faqs } = NEGOCIO;
  const dias = horario.dias
    .map((dia) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia])
    .join(', ');
  const listaModalidades = modalidades
    .map((modalidad) => `- ${modalidad.nombre}: ${modalidad.duracion} min. ${modalidad.descripcion}`)
    .join('\n');
  const listaProyectos = proyectos
    .map((proyecto) => `- ${proyecto.nombre}: ${proyecto.resumen} Stack: ${proyecto.stack}. Demo: ${proyecto.demo}`)
    .join('\n');
  const listaFaqs = faqs.map((faq) => `- ${faq.pregunta} ${faq.respuesta}`).join('\n');

  return `Perfil: ${NEGOCIO.nombre}
Rol: ${NEGOCIO.rol}
Descripción: ${NEGOCIO.descripcion}
Ubicación: ${NEGOCIO.ubicacion}
Teléfono: ${NEGOCIO.telefono}
Correo: ${NEGOCIO.correo}
LinkedIn: ${NEGOCIO.linkedin}
GitHub: ${NEGOCIO.github}
Disponibilidad: ${NEGOCIO.disponibilidad}
Idiomas: ${NEGOCIO.idiomas}
Horario de entrevistas: ${dias} de ${horario.apertura}:00 a ${horario.cierre}:00 (${NEGOCIO.zona}). Algunas tardes con cita previa.
CV: ${NEGOCIO.cv.opciones.map((o) => `${o.id}: ${o.nombre} (${o.formato})`).join(' | ')}

Modalidades de entrevista:
${listaModalidades}

Proyectos:
${listaProyectos}

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
    NEGOCIO.servicios.find((servicio) =>
      (servicio.claves || []).some((clave) => buscado.includes(clave)),
    ) ||
    NEGOCIO.servicios.find((servicio) => servicio.id === buscado) ||
    null
  );
}

export function proyectoPorId(id) {
  return NEGOCIO.proyectos.find((proyecto) => proyecto.id === id) || null;
}

export function proyectoPorTexto(texto) {
  const buscado = String(texto || '').toLowerCase();
  return (
    NEGOCIO.proyectos.find((proyecto) => buscado.includes(proyecto.nombre.toLowerCase())) ||
    NEGOCIO.proyectos.find((proyecto) => proyecto.id === buscado) ||
    null
  );
}
