# NEXO BOT en el CV

Texto listo para copiar. Elige 3–5 viñetas según el puesto; no las pongas todas.

**Proyecto:** NEXO BOT — Asistente de WhatsApp con IA para negocios.
**Demo:** https://nexo-bot-7jjwi3rg7q-uc.a.run.app/demo
**Código:** <!-- pegar la URL del repositorio -->

**Resumen de una línea:** Asistente conversacional que atiende clientes por WhatsApp, responde
preguntas con IA y agenda citas sin intervención humana.

**Stack:** Node.js 22 · Express 5 · Google Gemini · WhatsApp Cloud API · Firestore ·
Docker · Google Cloud Run · Cloud Build

---

## Viñetas en español

- Desarrollé **NEXO BOT**, un asistente de WhatsApp que combina un menú determinista con IA
  generativa (Gemini) para resolver dudas y agendar citas, desplegado en **Google Cloud Run**
  con coste cero dentro de la capa gratuita.
- Diseñé una **arquitectura por capas** (canal → motor de conversación → almacenamiento) que
  reutiliza el mismo motor en WhatsApp, demo web y CLI, aislando la integración con Meta en un
  único módulo.
- Implementé la agenda con **validación de zona horaria, disponibilidad en tiempo real y
  prevención de doble reserva**, con persistencia en Firestore y respaldo en memoria.
- Aseguré el webhook con **firma HMAC-SHA256, deduplicación de eventos y rate limiting**, y
  añadí un respaldo por preguntas frecuentes para que el bot siga operando si la IA falla o se
  agota la cuota.
- Automaticé el despliegue con un script **idempotente** que activa APIs, crea el registro de
  imágenes, prepara Firestore y publica en Cloud Run.
- Escribí **11 pruebas automatizadas** con `node:test` que cubren el parser de fechas en lenguaje
  natural, la disponibilidad de horarios y el flujo completo de reserva y cancelación.

## Viñetas en inglés

- Built **NEXO BOT**, an AI-powered WhatsApp assistant that answers customer questions and books
  appointments, deployed on **Google Cloud Run** at zero cost within free tiers.
- Designed a **channel-agnostic conversation engine** reused by the WhatsApp webhook, a web demo
  and a CLI, with the Meta integration isolated behind a single service module.
- Implemented **timezone-safe scheduling** with real-time availability checks and double-booking
  prevention, persisted in Firestore with an in-memory fallback.
- Hardened the webhook with **HMAC-SHA256 signature verification, event deduplication and rate
  limiting**; added a FAQ fallback so the bot keeps working when the LLM is unavailable.
- Automated **idempotent cloud deployment** (APIs, Artifact Registry, Firestore, Cloud Build,
  Cloud Run).
- Wrote **11 automated tests** covering natural-language date parsing, slot availability and the
  end-to-end booking/cancellation flow.

## Palabras clave para ATS

Node.js, JavaScript, Express, API REST, WhatsApp Cloud API, Meta Graph API, Gemini, LLM, IA
generativa, Firestore, Google Cloud, Cloud Run, Docker, CI/CD, webhooks, HMAC, pruebas
automatizadas, arquitectura por capas, diseño de APIs.

---

## Preguntas de entrevista que ya puedes responder

**¿Cómo evitas que dos clientes reserven el mismo horario?**
Los horarios ocupados se excluyen al mostrar la disponibilidad y se vuelven a validar justo
antes de crear la cita. Si alguien se adelantó, el bot ofrece los horarios que quedan.

**¿Qué pasa si Gemini falla o se agota la cuota?**
Hay timeout corto, reintento, cadena de modelos y, como último recurso, un buscador de preguntas
frecuentes local. La agenda y el menú nunca dependen de la IA.

**¿Cómo aseguras el webhook?**
Se valida la firma HMAC-SHA256 de Meta sobre el cuerpo crudo, se deduplican los eventos por ID
(Meta reintenta) y la demo pública tiene rate limiting por IP.

**¿Cómo manejas las zonas horarias?**
El servidor corre en UTC, pero las citas se guardan como fecha y hora locales del negocio
(`YYYY-MM-DD` / `HH:mm`) usando `Intl.DateTimeFormat`, sin librerías externas.

**¿Por qué Cloud Run y Firestore?**
Escalan a cero, no requieren administrar servidores y entran en la capa gratuita. El
almacenamiento está detrás de una interfaz, así que migrar a Postgres es cambiar un adaptador.

**¿Qué mejorarías?**
Plantillas de WhatsApp para recordatorios proactivos, panel de administración, métricas de
conversión, pruebas E2E con el emulador de Firestore y cifrado de datos sensibles.

---

## Presentación en 30 segundos

> «Muchos negocios pierden clientes porque nadie contesta WhatsApp a tiempo. NEXO BOT atiende
> 24/7: muestra servicios, resuelve dudas con Gemini y agenda citas reales sin que el dueño
> intervenga. Está desplegado en Google Cloud Run y cuesta cero dentro de la capa gratuita.
> Puedes probarlo en la demo: https://nexo-bot-7jjwi3rg7q-uc.a.run.app/demo.»

## Dónde ponerlo

- **CV:** una entrada de proyecto con la primera viñeta en español y el stack.
- **LinkedIn:** publicación con el enlace a la demo y una captura del chat.
- **GitHub:** README con diagrama, capturas y instrucciones de despliegue.
- **Portafolio:** tarjeta con la etiqueta «WhatsApp + IA + Cloud» y enlace directo a `/demo`.
