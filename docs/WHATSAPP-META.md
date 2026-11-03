# Conectar NEXO BOT a un número real de WhatsApp

La demo web funciona sin configurar nada. Para que el bot responda en WhatsApp se usa
**WhatsApp Cloud API**, la vía oficial de Meta. No requiere servidores propios: Meta llama al
webhook de NEXO BOT en Cloud Run.

> Tiempo estimado: 25 minutos. Coste: Meta incluye **1,000 mensajes de servicio gratis al mes** por
> número (desde octubre de 2026); después aplica su tarifa. NEXO BOT solo responde mensajes
> entrantes, así que no necesita plantillas aprobadas.

---

## 1. Crear la app en Meta

> **Ojo:** `developers.facebook.com/products/whatsapp` es la página informativa del producto.
> La configuración real está en el panel de apps: **[developers.facebook.com/apps](https://developers.facebook.com/apps)**.

1. Entra en [developers.facebook.com/apps](https://developers.facebook.com/apps) con tu cuenta de Facebook.
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
4. Prueba `1` (CV), `2` (proyectos) y `3` (entrevista → modalidad → fecha → hora → nombre →
   empresa → vacante → confirmación).

En Cloud Run verás los avisos si configuraste `OWNER_PHONE`.

> **Error `131030` ("Recipient phone number not in allowed list"):** ocurre con el
> número de prueba cuando Meta guardó el destinatario en un formato distinto al
> que llega en el webhook (por ejemplo, México `52...` frente a `521...`). El bot
> prueba automáticamente las variantes de México, Argentina y Brasil antes de
> rendirse. Si aun así falla, agrega el número a **API Setup → To** en el formato
> que aparece en el error.

## 6. Token permanente (producción)

1. [business.facebook.com](https://business.facebook.com) → **Configuración del negocio**.
2. **Usuarios → Usuarios del sistema → Agregar**.
3. Crea un usuario del sistema con rol **Administrador**.
4. **Agregar activos → Apps →** selecciona tu app → permiso completo. Repite en
   **Cuentas de WhatsApp →** tu cuenta (incluida la de prueba) → permiso completo.
5. **Generar token** con estos permisos y caducidad **Nunca**:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copia el token y actualízalo en Cloud Run:

```bash
gcloud run services update nexo-bot \
  --region us-central1 \
  --update-env-vars WHATSAPP_TOKEN=TU_TOKEN_PERMANENTE
```

> Guarda el token en un lugar seguro. Cualquiera con ese token puede enviar mensajes en tu nombre.

## 7. Pasar del número de prueba a tu número real

> El número debe estar **libre de WhatsApp**: no puede tener la app normal ni WhatsApp Business
> activos. Si lo usas, haz copia de seguridad y elimina la cuenta desde la app. No borres tu
> cuenta de Facebook. La eliminación de WhatsApp no afecta los SMS ni las llamadas del número.

1. **Agrega un método de pago** (obligatorio para un número real):
   [business.facebook.com](https://business.facebook.com) → **Configuración del negocio → Pagos →
   Métodos de pago**. Sin tarjeta, Meta rechaza los envíos con el error `131042`.
2. **Agrega el número**: [developers.facebook.com/apps/1802805950965378](https://developers.facebook.com/apps/1802805950965378)
   → **WhatsApp → API Setup → Add phone number** (o **WhatsApp Manager → Números de teléfono →
   Agregar**). Elige un nombre visible, por ejemplo `Ignacio Maldonado` o `NEXO BOT`.
3. **Verifícalo** por SMS o llamada. En la API debe quedar `code_verification_status: VERIFIED`.
4. **Regístralo para Cloud API**. No hay botón: es una llamada a la API. Elige un PIN de 6 dígitos
   y guárdalo (lo necesitarás para administrar el número):

   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/TU_PHONE_NUMBER_ID/register" \
     -H "Authorization: Bearer TU_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","pin":"123456"}'
   ```

5. **Suscribe la app a la cuenta de WhatsApp** si el número quedó en una cuenta nueva:

   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/TU_WABA_ID/subscribed_apps" \
     -H "Authorization: Bearer TU_TOKEN"
   ```

6. **Asigna el número al usuario del sistema** si tu token no lo ve: Configuración del negocio →
   **Usuarios → Usuarios del sistema → NEXO → Agregar activos → Cuentas de WhatsApp** → permiso
   total. Vuelve a generar el token si es necesario.

7. **Actualiza el Phone Number ID** en `.env` y despliega:

   ```env
   WHATSAPP_PHONE_NUMBER_ID=NUEVO_PHONE_NUMBER_ID
   ```

   ```bash
   npm run deploy
   ```

8. **Prueba**: desde tu número personal escribe `hola` al número del bot. El webhook ya está
   configurado a nivel de app, así que **no cambia**.

Notas:

- El número de prueba se puede conservar para pruebas; no estorba.
- La **verificación del negocio** no es obligatoria para el límite inicial de 250 usuarios
  únicos/24 h, pero conviene hacerla para subir de nivel y obtener el nombre verificado.
- Las respuestas dentro de la ventana de 24 h no consumen el límite de mensajes iniciados por el
  negocio.
- El PIN de 6 dígitos es la verificación en dos pasos del número; no lo compartas.

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
| WhatsApp Cloud API | 1,000 mensajes de servicio gratis al mes por número | Meta cobra por mensaje según el país |
| Cloud Run | 2 M peticiones y 180k vCPU-s/mes | ~0.000024 USD por vCPU-s |
| Firestore | 1 GiB, 50k lecturas/día | ~0.06 USD por 100k lecturas |
| Gemini API | Cuota gratuita de AI Studio | Se puede limitar o pasar a pago |
| Cloud Build | 120 min/día | ~0.003 USD/minuto |

Para una demo de portafolio o un negocio pequeño, si no superas las 1,000 respuestas de servicio
al mes, el coste mensual es **0** (la tarjeta queda registrada, pero no se cobra).
