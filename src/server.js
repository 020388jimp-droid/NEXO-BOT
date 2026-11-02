import './config/env.js';

import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

import { NEGOCIO } from './config/negocio.js';
import { inicializarAlmacen, estadoAlmacen } from './services/almacen.js';
import { procesarMensaje, reiniciarConversacion } from './services/conversacion.js';
import { iaDisponible } from './services/ia.js';
import {
  enviarTexto,
  esMensajeNuevo,
  extraerMensajes,
  firmaValida,
  notificarEquipo,
  tokenWebhookValido,
  whatsappConfigurado,
} from './services/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');
const publico = path.join(raiz, 'public');

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.set('trust proxy', true);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'no-referrer');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
  );
  next();
});

// El body crudo es necesario para validar la firma HMAC de Meta.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  }),
);

app.use(
  express.static(publico, {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }),
);

/* ------------------------------------------------------------------ *
 * Límite simple en memoria para la demo pública.
 * Evita que un visitante (o un bot) queme la cuota gratuita de Gemini.
 * ------------------------------------------------------------------ */
const intentos = new Map();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = Number(process.env.DEMO_MAX_MENSAJES || 40);

function permitir(ip) {
  const ahora = Date.now();
  const registro = intentos.get(ip);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    intentos.set(ip, { inicio: ahora, cuenta: 1 });
    return true;
  }
  registro.cuenta += 1;
  if (intentos.size > 5000) {
    for (const [clave, valor] of intentos) {
      if (ahora - valor.inicio > VENTANA_MS) intentos.delete(clave);
    }
  }
  return registro.cuenta <= MAX_POR_VENTANA;
}

const sanitizarSesion = (sesion) =>
  String(sesion || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);

/* ------------------------------------------------------------------ *
 * Demo web: usa exactamente el mismo motor que WhatsApp.
 * ------------------------------------------------------------------ */
app.post('/api/demo', async (req, res) => {
  if (!permitir(req.ip)) {
    return res.status(429).json({
      error: 'Demasiados mensajes seguidos. Espera unos minutos o escríbenos por WhatsApp.',
    });
  }

  const mensaje = String(req.body?.mensaje || '').trim();
  if (!mensaje) return res.status(400).json({ error: 'Escribe un mensaje.' });
  if (mensaje.length > 500) return res.status(400).json({ error: 'El mensaje es demasiado largo (máximo 500 caracteres).' });

  const sesion = sanitizarSesion(req.body?.sesion) || randomUUID().replace(/-/g, '').slice(0, 16);

  try {
    const resultado = await procesarMensaje({
      telefono: `demo-${sesion}`,
      texto: mensaje,
      canal: 'demo',
    });
    return res.json({ sesion, respuestas: resultado.respuestas, estado: resultado.estado });
  } catch (error) {
    console.error('❌ Error en /api/demo:', error);
    return res.status(500).json({ error: 'Algo salió mal. Intenta de nuevo en un momento.' });
  }
});

app.post('/api/demo/reiniciar', async (req, res) => {
  const sesion = sanitizarSesion(req.body?.sesion);
  if (!sesion) return res.json({ ok: true });
  await reiniciarConversacion({ telefono: `demo-${sesion}`, canal: 'demo' });
  return res.json({ ok: true });
});

app.get('/api/negocio', (_req, res) => {
  res.json({
    nombre: NEGOCIO.nombre,
    descripcion: NEGOCIO.descripcion,
    telefono: NEGOCIO.telefono,
    correo: NEGOCIO.correo,
    direccion: NEGOCIO.direccion,
    zona: NEGOCIO.zona,
    horario: NEGOCIO.horario,
    servicios: NEGOCIO.servicios.map(({ id, nombre, precioTexto, duracion, descripcion }) => ({
      id,
      nombre,
      precio: precioTexto,
      duracion,
      descripcion,
    })),
    ia: iaDisponible(),
    whatsapp: whatsappConfigurado(),
  });
});

/* ------------------------------------------------------------------ *
 * Webhook de WhatsApp Cloud API.
 * ------------------------------------------------------------------ */
app.get('/webhook', (req, res) => {
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const reto = req.query['hub.challenge'];

  if (modo === 'subscribe' && tokenWebhookValido(token)) {
    console.log('✅ Webhook verificado por Meta');
    return res.status(200).type('text/plain').send(String(reto ?? ''));
  }

  console.warn('⚠️  Verificación de webhook rechazada');
  return res.sendStatus(403);
});

function textoDeAviso(evento, mensajeEntrante) {
  if (evento.tipo === 'nueva_cita') {
    const { cita } = evento;
    return [
      '📅 *Nueva entrevista agendada*',
      '',
      `• Cliente: ${cita.nombre}`,
    `• Empresa: ${cita.empresa || 'Por definir'}`,
    `• Modalidad: ${cita.servicio}`,
    `• Teléfono: ${cita.telefono}`,
    `• Fecha: ${cita.fecha} ${cita.hora}`,
    `• Código: ${cita.codigo}`,
    ].join('\n');
  }

  if (evento.tipo === 'cita_cancelada') {
    const { cita } = evento;
    return `❌ *Entrevista cancelada*\n\n• ${cita.nombre} (${cita.telefono})\n• ${cita.servicio}\n• ${cita.fecha} ${cita.hora}\n• Código: ${cita.codigo}`;
  }

  return `🙋 *Un cliente pide asesor*\n\n• Teléfono: ${evento.telefono || mensajeEntrante.de}\n• Nombre: ${evento.nombre || mensajeEntrante.nombre || 'No indicado'}\n• Último mensaje: ${mensajeEntrante.texto}`;
}

function webhookListo() {
  if (!whatsappConfigurado()) {
    return { listo: false, motivo: 'WhatsApp no configurado (faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID)' };
  }
  if (!process.env.META_APP_SECRET && process.env.NODE_ENV === 'production') {
    return { listo: false, motivo: 'Falta META_APP_SECRET para validar la firma de Meta' };
  }
  return { listo: true, motivo: '' };
}

app.post('/webhook', async (req, res) => {
  // Sin WhatsApp configurado (o sin secreto en producción) este endpoint es
  // una puerta abierta a llamadas falsas que gastarían la cuota de Gemini.
  const estadoWebhook = webhookListo();
  if (!estadoWebhook.listo) {
    console.warn(`⚠️  Webhook deshabilitado: ${estadoWebhook.motivo}`);
    return res.status(503).json({ error: 'Webhook no configurado' });
  }

  if (!firmaValida(req.rawBody, req.get('x-hub-signature-256'))) {
    console.warn('⚠️  Firma de webhook inválida');
    return res.sendStatus(401);
  }

  // Se procesa antes de responder para que Cloud Run no congele la CPU.
  // Gemini tiene un límite de tiempo corto y Meta reintenta con seguridad;
  // la deduplicación por id evita respuestas duplicadas.
  try {
    const mensajes = extraerMensajes(req.body);

    for (const mensaje of mensajes) {
      if (!esMensajeNuevo(mensaje.id)) continue;

      try {
        if (!mensaje.soportado) {
          await enviarTexto(
            mensaje.de,
            'Por ahora solo puedo leer mensajes de texto. ✍️ Escribe *menú* para ver las opciones.',
          );
          continue;
        }

        const resultado = await procesarMensaje({
          telefono: mensaje.de,
          texto: mensaje.texto,
          canal: 'whatsapp',
        });

        for (const respuesta of resultado.respuestas) {
          await enviarTexto(mensaje.de, respuesta);
        }

        if (resultado.notificar) {
          const aviso = textoDeAviso(resultado.notificar, mensaje);
          const enviado = await notificarEquipo(aviso);
          if (!enviado) console.log('🔔 Aviso interno (OWNER_PHONE no configurado):', aviso.replace(/\n/g, ' | '));
        }
      } catch (error) {
        // Un mensaje que falle no debe impedir procesar los demás del lote.
        console.error(`❌ Error procesando mensaje ${mensaje.id}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
  }

  return res.sendStatus(200);
});

/* ------------------------------------------------------------------ *
 * Salud, privacidad y términos (Meta exige una política pública).
 * ------------------------------------------------------------------ */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    servicio: 'nexo-bot',
    almacen: estadoAlmacen().tipo,
    whatsapp: whatsappConfigurado(),
    webhook: webhookListo().listo,
    ia: iaDisponible(),
    hora: new Date().toISOString(),
  });
});

app.get(['/privacidad', '/terminos'], (req, res) => {
  const archivo = req.path === '/privacidad' ? 'privacidad.html' : 'terminos.html';
  res.sendFile(path.join(publico, archivo));
});

app.get('/', (_req, res) => res.sendFile(path.join(publico, 'index.html')));
app.get('/demo', (_req, res) => res.sendFile(path.join(publico, 'index.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta no encontrada' });
  return res.status(404).sendFile(path.join(publico, 'index.html'));
});

async function iniciar() {
  const almacen = await inicializarAlmacen();

  app.listen(PORT, () => {
    const base = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    console.log('');
    console.log('  ╭──────────────────────────────────────────────╮');
    console.log('  │  NEXO BOT · asistente de WhatsApp con IA     │');
    console.log('  ╰──────────────────────────────────────────────╯');
    console.log(`  Demo web:   ${base}/demo`);
    console.log(`  Webhook:    ${base}/webhook`);
    console.log(`  Salud:      ${base}/health`);
    console.log(`  Almacén:    ${almacen.detalle}`);
    console.log(`  WhatsApp:   ${whatsappConfigurado() ? 'configurado ✅' : 'sin configurar (demo local)'}`);
    console.log(`  Gemini:     ${iaDisponible() ? 'activo ✅' : 'sin clave (respaldo por FAQ)'}`);
    console.log(`  Negocio:    ${NEGOCIO.nombre}`);
    console.log('');
  });
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar NEXO BOT:', error);
  process.exit(1);
});
