// Despliegue reproducido de NEXO BOT en Google Cloud Run.
//
//   node scripts/desplegar.js
//
// Hace todo lo necesario: activa APIs, crea el repositorio de imágenes,
// prepara Firestore, construye con Cloud Build y publica el servicio.
// Requiere haber iniciado sesión con `gcloud auth login`.

import '../src/config/env.js';

import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICIO = 'nexo-bot';
const REPOSITORIO = 'nexo';
const REGION = process.env.GCLOUD_REGION || 'us-central1';

const c = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  cian: (t) => `\x1b[36m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
};

function gcloud(args, { capturar = false, permitirFallo = false, cwd = RAIZ } = {}) {
  // En Windows gcloud es un .cmd y necesita shell. Se citan todos los
  // argumentos para que paréntesis y espacios no rompan el comando.
  const comando = ['gcloud', ...args.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`)].join(' ');

  const resultado = spawnSync(comando, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: capturar ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (resultado.error) throw resultado.error;

  if (resultado.status !== 0 && !permitirFallo) {
    const detalle = capturar ? (resultado.stderr || '').trim().slice(0, 500) : '';
    throw new Error(`gcloud ${args.slice(0, 2).join(' ')} falló. ${detalle}`);
  }

  return capturar ? (resultado.stdout || '').trim() : '';
}

const paso = (texto) => console.log(`\n${c.cian('▶')} ${c.negrita(texto)}`);
const ok = (texto) => console.log(`  ${c.verde('✓')} ${texto}`);

function proyectoActual() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const proyecto = gcloud(['config', 'get-value', 'project'], { capturar: true });
  if (!proyecto || proyecto === '(unset)') {
    throw new Error('No hay proyecto de Google Cloud. Ejecuta: gcloud config set project TU_PROYECTO');
  }
  return proyecto;
}

const CLAVES_DESPLIEGUE = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_TIMEOUT_MS',
  'BUSINESS_NAME',
  'BUSINESS_DESCRIPTION',
  'BUSINESS_TZ',
  'BUSINESS_PHONE',
  'BUSINESS_EMAIL',
  'BUSINESS_ADDRESS',
  'BUSINESS_SITE',
  'BUSINESS_OPEN_HOUR',
  'BUSINESS_CLOSE_HOUR',
  'BUSINESS_SLOT_MINUTES',
  'BUSINESS_DAYS',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TOKEN',
  'META_APP_SECRET',
  'META_VERIFY_TOKEN',
  'META_API_VERSION',
  'OWNER_PHONE',
  'DEMO_MAX_MENSAJES',
  'PUBLIC_URL',
];

function archivoDeVariables() {
  const variables = { NODE_ENV: 'production', ALMACEN: 'firestore' };

  for (const clave of CLAVES_DESPLIEGUE) {
    const valor = process.env[clave];
    if (valor && !valor.startsWith('tu_api_key')) variables[clave] = valor;
  }

  if (!variables.GEMINI_API_KEY) {
    throw new Error('Falta GEMINI_API_KEY en .env. La demo funciona sin ella, pero la IA no.');
  }

  const archivo = path.join(os.tmpdir(), `nexo-env-${randomBytes(4).toString('hex')}.yaml`);
  // JSON.stringify produce un escalar YAML válido entre comillas dobles.
  const contenido = Object.entries(variables)
    .map(([clave, valor]) => `${clave}: ${JSON.stringify(String(valor))}`)
    .join('\n');
  writeFileSync(archivo, contenido, { mode: 0o600 });
  return archivo;
}

async function main() {
  console.log(c.negrita('\n  NEXO BOT · despliegue en Google Cloud Run\n'));

  const version = gcloud(['--version'], { capturar: true, permitirFallo: true });
  if (!version) throw new Error('Google Cloud SDK no está instalado o no está en el PATH.');

  const cuenta = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'], {
    capturar: true,
  });
  if (!cuenta) throw new Error('No hay sesión activa. Ejecuta: gcloud auth login');
  ok(`Cuenta: ${cuenta.split('\n')[0]}`);

  const proyecto = proyectoActual();
  ok(`Proyecto: ${proyecto}`);
  const imagen = `${REGION}-docker.pkg.dev/${proyecto}/${REPOSITORIO}/${SERVICIO}:latest`;

  paso('Activando servicios de Google Cloud');
  gcloud([
    'services',
    'enable',
    'run.googleapis.com',
    'cloudbuild.googleapis.com',
    'artifactregistry.googleapis.com',
    'firestore.googleapis.com',
    '--project',
    proyecto,
    '--quiet',
  ]);
  ok('APIs activas');

  paso('Preparando Artifact Registry');
  const repoExistente = gcloud(
    ['artifacts', 'repositories', 'describe', REPOSITORIO, '--location', REGION, '--project', proyecto, '--format=value(name)'],
    { capturar: true, permitirFallo: true },
  );
  if (!repoExistente) {
    gcloud([
      'artifacts',
      'repositories',
      'create',
      REPOSITORIO,
      '--repository-format=docker',
      '--location',
      REGION,
      '--description=Imágenes de NEXO BOT',
      '--project',
      proyecto,
      '--quiet',
    ]);
  }
  ok(`Repositorio: ${REPOSITORIO}`);

  paso('Preparando Firestore');
  const bases = gcloud(['firestore', 'databases', 'list', '--project', proyecto, '--format=value(name)'], {
    capturar: true,
    permitirFallo: true,
  });
  if (!bases) {
    gcloud(['firestore', 'databases', 'create', '--location', REGION, '--project', proyecto, '--quiet']);
  }
  ok('Base de datos lista');

  paso('Dando permiso de Firestore a Cloud Run');
  const numero = gcloud(['projects', 'describe', proyecto, '--format=value(projectNumber)'], { capturar: true });
  const servicioCuenta = `${numero}-compute@developer.gserviceaccount.com`;
  gcloud(
    [
      'projects',
      'add-iam-policy-binding',
      proyecto,
      `--member=serviceAccount:${servicioCuenta}`,
      '--role=roles/datastore.user',
      '--condition=None',
      '--format=none',
      '--quiet',
    ],
    { permitirFallo: true },
  );
  ok(servicioCuenta);

  paso('Construyendo la imagen con Cloud Build');
  gcloud(['builds', 'submit', '--tag', imagen, '--project', proyecto, '.']);
  ok('Imagen publicada');

  const archivoEnv = archivoDeVariables();

  try {
    paso('Publicando en Cloud Run');
    gcloud([
      'run',
      'deploy',
      SERVICIO,
      '--image',
      imagen,
      '--region',
      REGION,
      '--platform',
      'managed',
      '--allow-unauthenticated',
      '--port',
      '8080',
      '--memory',
      '512Mi',
      '--cpu',
      '1',
      '--min-instances',
      '0',
      '--max-instances',
      '1',
      '--timeout',
      '60',
      '--env-vars-file',
      archivoEnv,
      '--project',
      proyecto,
      '--quiet',
    ]);
  } finally {
    try {
      unlinkSync(archivoEnv);
    } catch {
      /* si el archivo ya no existe, no pasa nada */
    }
  }

  const url = gcloud(
    ['run', 'services', 'describe', SERVICIO, '--region', REGION, '--format=value(status.url)', '--project', proyecto],
    { capturar: true },
  );

  console.log('');
  console.log(c.verde('  ╭──────────────────────────────────────────────────────────╮'));
  console.log(c.verde('  │  NEXO BOT desplegado correctamente                       │'));
  console.log(c.verde('  ╰──────────────────────────────────────────────────────────╯'));
  console.log(`\n  ${c.negrita('Demo:')}    ${url}/demo`);
  console.log(`  ${c.negrita('Salud:')}   ${url}/health`);
  console.log(`  ${c.negrita('Webhook:')} ${url}/webhook`);
  console.log(`\n  ${c.gris('Pega el webhook en Meta for Developers y usa como token:')} ${process.env.META_VERIFY_TOKEN || 'nexo-bot-verificacion'}`);
  console.log(`  ${c.gris('Guía paso a paso: docs/WHATSAPP-META.md')}\n`);
}

main().catch((error) => {
  console.error(`\n${c.rojo('✖')} ${error.message}\n`);
  process.exit(1);
});
