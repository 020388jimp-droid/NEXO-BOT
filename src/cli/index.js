import '../config/env.js';

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { NEGOCIO } from '../config/negocio.js';
import { inicializarAlmacen } from '../services/almacen.js';
import { procesarMensaje, reiniciarConversacion } from '../services/conversacion.js';
import { iaDisponible } from '../services/ia.js';

const c = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  cian: (t) => `\x1b[36m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
  amarillo: (t) => `\x1b[33m${t}\x1b[0m`,
};

const TELEFONO = `cli-${Date.now()}`;

async function main() {
  const almacen = await inicializarAlmacen();

  console.log('');
  console.log(c.negrita('  NEXO BOT · consola local'));
  console.log(c.gris(`  ${NEGOCIO.nombre} · almacén: ${almacen.tipo} · IA: ${iaDisponible() ? 'sí' : 'no (FAQ)'}`));
  console.log(c.gris('  Escribe /menu para volver al inicio, /reiniciar para borrar la conversación y /salir para terminar.'));
  console.log('');

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    while (true) {
      let entrada;
      try {
        entrada = await rl.question(c.cian('  Tú › '));
      } catch {
        break;
      }

      const texto = entrada.trim();
      if (!texto) continue;
      if (['/salir', '/exit', '/quit'].includes(texto.toLowerCase())) break;

      if (texto.toLowerCase() === '/reiniciar') {
        await reiniciarConversacion({ telefono: TELEFONO, canal: 'cli' });
        console.log(c.amarillo('\n  Conversación reiniciada.\n'));
        continue;
      }

      const mensaje = texto.toLowerCase() === '/menu' ? 'menú' : texto;

      const resultado = await procesarMensaje({
        telefono: TELEFONO,
        texto: mensaje,
        canal: 'cli',
      });

      for (const respuesta of resultado.respuestas) {
        console.log('');
        console.log(c.verde('  NEXO › ') + respuesta.replace(/\n/g, '\n  ') + c.gris(`   [${resultado.estado}]`));
      }
      console.log('');
    }
  } finally {
    rl.close();
    console.log(c.gris('\n  Hasta luego.\n'));
  }
}

main().catch((error) => {
  console.error('Error en la consola:', error);
  process.exit(1);
});
