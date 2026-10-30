import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Carga el .env de la raíz del proyecto sin importar desde qué carpeta se
// ejecute el comando (npm, Cloud Run o un .bat con doble clic).
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

dotenv.config({ path: path.join(raiz, '.env'), quiet: true });
