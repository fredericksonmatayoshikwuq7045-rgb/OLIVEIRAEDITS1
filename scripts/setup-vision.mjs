import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'vision');
await mkdir(join(target, 'core'), { recursive: true });
await mkdir(join(target, 'lang'), { recursive: true });
await copyFile(join(root, 'node_modules/tesseract.js/dist/worker.min.js'), join(target, 'worker.min.js'));
await copyFile(join(root, 'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt'), join(target, 'worker.min.js.LICENSE.txt'));
await copyFile(join(root, 'node_modules/tesseract.js/LICENSE.md'), join(target, 'TESSERACT-LICENSE.md'));
await copyFile(join(root, 'node_modules/tesseract.js-core/LICENSE'), join(target, 'CORE-LICENSE'));
for (const name of await readdir(join(root, 'node_modules/tesseract.js-core'))) {
  if (/\.wasm(?:\.js)?$/.test(name)) await copyFile(join(root, 'node_modules/tesseract.js-core', name), join(target, 'core', name));
}
for (const language of ['eng', 'por', 'spa']) {
  await copyFile(
    join(root, 'node_modules', `@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`),
    join(target, 'lang', `${language}.traineddata.gz`),
  );
}
console.log('OCR local preparado: worker, WebAssembly e idiomas inglês, português e espanhol.');
