# Conectar NEXO BOT a un número real de WhatsApp

La demo web funciona sin configurar nada. Para que el bot responda en WhatsApp se usa
**WhatsApp Cloud API**, la vía oficial de Meta. No requiere servidores propios: Meta llama al
webhook de NEXO BOT en Cloud Run.

> Tiempo estimado: 20 minutos. Coste: **0 USD** dentro de la capa gratuita (las conversaciones de
> servicio que inicia el cliente son gratuitas; Meta cobra las plantillas proactivas).

---

## 1. Crear la app en Meta

1. Entra en [developers.facebook.com](https://developers.facebook.com) con tu cuenta de Facebook.
2. **My Apps → Create App**.
3. Tipo de app: **Business**. Ponle un nombre, por ejemplo `NEXO BOT`.
4. En el panel de la app, busca **WhatsApp → Set up** y agrega el producto.
5. Meta te da un **número de prueba** y hasta 5 destinatarios de prueba.

## 2. Obtener las credenciales

En **WhatsApp → API Setup** copia:

| Dato | Variable de entorno |
|---|---|
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` |
| Temporary access token (24 h) | `WHATSAPP_TOKEN` |
| App Secret (Settings → Basic) | `META_APP_SECRET` |

Inventa una cadena para `META_VERIFY_TOKEN`, por ejemplo:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Pega los valores en tu `.env`:

```env
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TOKEN=EAAG...
META_APP_SECRET=abc123...
META_VERIFY_TOKEN=la-cadena-que-inventaste
OWNER_PHONE=52155...   # opcional: recibe avisos de citas
```

> El token temporal caduca en 24 h. Para producción genera un **token permanente** (paso 6).

## 3. Desplegar con HTTPS público

Meta necesita una URL `https://` accesible desde internet:

```bash
npm run deploy
```

Al terminar, el script imprime la URL del servicio. El webhook es:

```
https://TU-SERVICIO.run.app/webhook
```

## 4. Registrar el webhook en Meta

1. **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** `https://TU-SERVICIO.run.app/webhook`
3. **Verify token:** el mismo valor de `META_VERIFY_TOKEN`.
4. Pulsa **Verify and save**. Debe responder correcto al instante.
5. En **Webhook fields**, suscribe **`messages`**.

Si la verificación falla:

- Revisa que `META_VERIFY_TOKEN` en Cloud Run sea idéntico (sin espacios).
- Comprueba `https://TU-SERVICIO.run.app/health` y que el servicio esté público.
- Los logs de Cloud Run muestran `✅ Webhook verificado por Meta` o el motivo del rechazo.

## 5. Probar

1. En **API Setup → To**, agrega tu número personal como destinatario de prueba y verifícalo.
2. Escanea el QR o usa el botón **Send message** de Meta para iniciar la conversación.
3. Escribe `hola`. Deberías recibir el menú.
4. Prueba: `2` → servicio → `mañana` → horario → tu nombre → `1`.

En Cloud Run verás los avisos si configuraste `OWNER_PHONE`.

## 6. Token permanente (producción)

1. [business.facebook.com](https://business.facebook.com) → **Configuración del negocio**.
2. **Usuarios → Usuarios del sistema → Agregar**.
3. Crea un usuario del sistema con rol **Administrador**.
4. **Agregar activos → Apps →** selecciona tu app → permiso completo.
5. **Generar token** con estos permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copia el token y actualízalo en Cloud Run:

```bash
gcloud run services update nexo-bot \
  --region us-central1 \
  --update-env-vars WHATSAPP_TOKEN=TU_TOKEN_PERMANENTE
```

> Guarda el token en un lugar seguro. Cualquiera con ese token puede enviar mensajes en tu nombre.

## 7. Pasar a producción con un número real

1. **WhatsApp → API Setup → Add phone number**. El número no debe estar registrado en la app
   normal de WhatsApp; si lo está, primero elimina la cuenta desde la app.
2. Verifica el número por SMS o llamada.
3. Completa la **verificación del negocio** en Meta Business.
4. Agrega un método de pago en **WhatsApp Manager → Billing**.
5. Solicita **Advanced Access** para `whatsapp_business_messaging` si vas a atender a clientes
   que no están en la lista de prueba.
6. Para iniciar conversaciones fuera de la ventana de 24 h necesitas **plantillas** aprobadas
   (`hello_world` es la de ejemplo). NEXO BOT responde a mensajes entrantes, así que no las
   necesita para el flujo actual.

## 8. Probar el webhook en local

Meta no puede llamar a `localhost`. Para desarrollo usa un túnel:

```bash
ngrok http 8080
```

Y registra `https://xxxx.ngrok-free.app/webhook` como callback. El resto del flujo es idéntico.

---

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `401` al recibir mensajes | `META_APP_SECRET` incorrecto | Copia el App Secret de Settings → Basic |
| `403` al verificar | `META_VERIFY_TOKEN` distinto | Iguala el valor en Meta y en Cloud Run |
| `131030` al enviar | El destinatario no está en la lista de prueba | Agrégalo y verifícalo en API Setup |
| `190` | Token caducado | Genera uno permanente (paso 6) |
| `131047` | Pasaron más de 24 h desde el último mensaje del cliente | Usa una plantilla aprobada |
| El bot responde en la demo pero no en WhatsApp | Faltan `WHATSAPP_PHONE_NUMBER_ID` o `WHATSAPP_TOKEN` | Revisa `/health`: `whatsapp: true` |
| Los acentos se ven raros | El cliente envía en una codificación distinta | NEXO BOT ya normaliza y responde en UTF-8 |

## Costes reales

| Servicio | Capa gratuita | Qué pasa al superarla |
|---|---|---|
| WhatsApp Cloud API | Conversaciones de servicio gratuitas | Meta cobra las plantillas proactivas según el país |
| Cloud Run | 2 M peticiones y 180k vCPU-s/mes | ~0.000024 USD por vCPU-s |
| Firestore | 1 GiB, 50k lecturas/día | ~0.06 USD por 100k lecturas |
| Gemini API | Cuota gratuita de AI Studio | Se puede limitar o pasar a pago |
| Cloud Build | 120 min/día | ~0.003 USD/minuto |

Para una demo de portafolio o un negocio pequeño, el coste mensual es **0**.
