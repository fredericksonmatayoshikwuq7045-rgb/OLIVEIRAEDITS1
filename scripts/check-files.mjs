import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ignored = new Set(['node_modules', 'target', 'gen', 'icons', 'dist', '.git', '.artifacts']);
const failures = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(tsx?|rs|mjs|py|css)$/.test(entry.name)) {
      const lines = (await readFile(file, 'utf8')).trimEnd().split('\n').length;
      if (lines > 300) failures.push(`${file}: ${lines} linhas (máximo 300)`);
    }
  }
}
await Promise.all(
  ['src', 'src-tauri/src', 'scripts', 'tests'].map(async (directory) => {
    try {
      await walk(directory);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }),
);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Todos os arquivos de código verificados têm até 300 linhas.');
