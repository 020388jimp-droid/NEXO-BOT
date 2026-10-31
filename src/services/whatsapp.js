// Integración con WhatsApp Cloud API (la vía oficial y gratuita de Meta).
//
// Variables necesarias en producción:
//   WHATSAPP_PHONE_NUMBER_ID  ID del número en Meta for Developers
//   WHATSAPP_TOKEN            token permanente de la app
//   META_APP_SECRET           para validar la firma del webhook
//   META_VERIFY_TOKEN         cadena inventada que también se pega en Meta
//
// Sin estas variables el bot sigue funcionando en la demo web y en consola.

import { createHmac, timingSafeEqual } from 'crypto';

const VERSION = process.env.META_API_VERSION || 'v21.0';
const LIMITE_TEXTO = 3500;
const DEDUPLICACION_MS = 10 * 60 * 1000;

const vistos = new Map();

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TOKEN);
}

export function tokenWebhookValido(token) {
  const esperado = process.env.META_VERIFY_TOKEN;
  if (!esperado || !token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Meta firma el cuerpo crudo con HMAC-SHA256 y lo envía en
 * X-Hub-Signature-256. Hay que comparar contra el body SIN parsear.
 */
export function firmaValida(cuerpoCrudo, cabecera) {
  const secreto = process.env.META_APP_SECRET;
  if (!secreto) return true; // modo permisivo solo para desarrollo local
  if (!cabecera?.startsWith('sha256=')) return false;

  const esperado = createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex');
  const recibido = cabecera.slice(7);
  if (recibido.length !== esperado.length) return false;

  return timingSafeEqual(Buffer.from(esperado, 'utf8'), Buffer.from(recibido, 'utf8'));
}

/** Evita responder dos veces si Meta reintenta el mismo evento. */
export function esMensajeNuevo(id) {
  const ahora = Date.now();
  for (const [clave, momento] of vistos) {
    if (ahora - momento > DEDUPLICACION_MS) vistos.delete(clave);
  }
  if (!id) return true;
  if (vistos.has(id)) return false;
  vistos.set(id, ahora);
  return true;
}

function dividirTexto(texto) {
  const limpio = String(texto || '').trim();
  if (limpio.length <= LIMITE_TEXTO) return [limpio];

  const partes = [];
  let actual = '';
  for (const parrafo of limpio.split('\n')) {
    if ((actual + '\n' + parrafo).length > LIMITE_TEXTO) {
      if (actual) partes.push(actual.trim());
      actual = parrafo;
    } else {
      actual = actual ? `${actual}\n${parrafo}` : parrafo;
    }
  }
  if (actual) partes.push(actual.trim());
  return partes;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Formatos alternos de un mismo número. Meta puede guardar el destinatario de
 * prueba con o sin el prefijo móvil de cada país (por ejemplo, México usa
 * 521... y 52... para el mismo teléfono). Probamos ambos antes de rendirnos.
 */
export function variantesDestino(telefono) {
  const base = String(telefono || '').replace(/\D/g, '');
  if (!base) return [];

  const variantes = [base];
  const agregar = (valor) => {
    if (valor && !variantes.includes(valor)) variantes.push(valor);
  };

  // México: 52 1 + 10 dígitos (móvil) frente a 52 + 10 dígitos.
  if (/^521\d{10}$/.test(base)) agregar(`52${base.slice(3)}`);
  if (/^52\d{10}$/.test(base)) agregar(`521${base.slice(2)}`);

  // Argentina: 54 9 ... frente a 54 ...
  if (/^549\d{10,11}$/.test(base)) agregar(`54${base.slice(3)}`);
  if (/^54[1-9]\d{9,10}$/.test(base) && !base.startsWith('549')) {
    agregar(`549${base.slice(2)}`);
  }

  // Brasil: 55 + área (2) + 9 + 8 dígitos frente a sin el 9.
  if (/^55\d{2}9\d{8}$/.test(base)) {
    agregar(`55${base.slice(2, 4)}${base.slice(5)}`);
  }
  if (/^55\d{2}\d{8}$/.test(base)) {
    agregar(`55${base.slice(2, 4)}9${base.slice(4)}`);
  }

  return variantes;
}

/**
 * Envía texto por la Graph API. Devuelve true/false: nunca lanza, porque un
 * fallo de Meta no debe tumbar el webhook.
 */
export async function enviarTexto(telefono, texto) {
  if (!whatsappConfigurado()) {
    console.warn('⚠️  WhatsApp no configurado; mensaje no enviado:', String(texto).slice(0, 80));
    return false;
  }

  const url = `https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const variantes = variantesDestino(telefono);
  let indice = 0;

  for (const parte of dividirTexto(texto)) {
    let enviado = false;

    while (!enviado && indice < variantes.length) {
      const destino = variantes[indice];

      for (let intento = 1; intento <= 2 && !enviado; intento += 1) {
        try {
          const respuesta = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: destino,
              type: 'text',
              text: { preview_url: false, body: parte },
            }),
          });

          if (respuesta.ok) {
            enviado = true;
            break;
          }

          const detalle = await respuesta.text();
          const noPermitido =
            respuesta.status === 400 && /131030|not in allowed list/i.test(detalle);

          if (noPermitido && indice + 1 < variantes.length) {
            console.warn('⚠️  WhatsApp: número no permitido; probando formato alterno.');
            indice += 1;
            break;
          }

          const reintentable = respuesta.status === 429 || respuesta.status >= 500;
          console.error(`❌ WhatsApp ${respuesta.status}: ${detalle.slice(0, 300)}`);
          if (!reintentable) return false;
          await esperar(1200);
        } catch (error) {
          console.error('❌ Error de red con WhatsApp:', error.message);
          if (intento === 2) return false;
          await esperar(1200);
        }
      }
    }

    if (!enviado) return false;
  }

  return true;
}

/** Avisa al equipo (dueño del negocio) de una cita o de una solicitud de asesor. */
export async function notificarEquipo(texto) {
  const destino = process.env.OWNER_PHONE;
  if (!destino || !whatsappConfigurado()) return false;
  return enviarTexto(destino, texto);
}

/** Convierte el payload del webhook en una lista plana de mensajes. */
export function extraerMensajes(cuerpo) {
  const salida = [];

  for (const entrada of cuerpo?.entry || []) {
    for (const cambio of entrada.changes || []) {
      const valor = cambio.value || {};
      const nombres = new Map(
        (valor.contacts || []).map((contacto) => [contacto.wa_id, contacto.profile?.name || null]),
      );

      for (const mensaje of valor.messages || []) {
        const texto =
          mensaje.text?.body ??
          mensaje.button?.text ??
          mensaje.interactive?.button_reply?.title ??
          mensaje.interactive?.list_reply?.title ??
          null;

        salida.push({
          id: mensaje.id,
          de: mensaje.from,
          texto,
          tipo: mensaje.type,
          nombre: nombres.get(mensaje.from) || null,
          timestamp: Number(mensaje.timestamp || 0) * 1000,
          soportado: Boolean(texto),
        });
      }
    }
  }

  return salida;
}
