import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'application/javascript', body: 'export {};' }));
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3001');
  const expected = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    canvas.getContext('2d').fillRect(0, 0, 128, 96);
    const dataUrl = canvas.toDataURL('image/png');
    const file = new File([await (await fetch(dataUrl)).blob()], 'original.png', { type: 'image/png' });
    const keys = {
      oe_videos: JSON.stringify([{ id: 1, title: 'ausente.mp4', url: 'blob:expirada', status: 'ready', duration: 5 }]),
      oe_images: JSON.stringify([
        {
          id: 1,
          title: 'original.png',
          url: 'blob:expirada',
          status: 'ready',
          templates: { border: 'tpl1' },
          textLayers: [{ id: 'legado', text: 'TEXTO LEGADO', fontFamily: 'sans-serif', fontSize: 28, color: '#ffffff', visible: true }],
          campoExtra: 'PRESERVAR',
        },
      ]),
      oe_groups: JSON.stringify([{ id: 'grupo1', name: 'Grupo antigo', type: 'image' }]),
      oe_templates: JSON.stringify([
        { id: 'tpl1', name: 'Template antigo', groupId: 'grupo1', category: 'border', type: 'image', dataUrl },
      ]),
    };
    for (const [key, value] of Object.entries(keys)) localStorage.setItem(key, value);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('OliveiraEditsDB', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(file, 'image-1');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    return { keys, size: file.size };
  });
  await page.unroute('**/src/main.tsx');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Padrão', exact: true }).click();
  await page.locator('[role="option"]').filter({ hasText: 'original.png' }).click();
  await page.getByRole('button', { name: /3.*Templates/ }).click();
  await page.getByRole('button', { name: 'TEXTO LEGADO', exact: true }).waitFor();
  const actual = await page.evaluate(async () => {
    const keys = Object.fromEntries(['oe_videos', 'oe_images', 'oe_groups', 'oe_templates'].map((key) => [key, localStorage.getItem(key)]));
    const read = (name, store, key) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            query = db.transaction(store).objectStore(store).get(key);
          query.onsuccess = () => {
            db.close();
            resolve(query.result);
          };
          query.onerror = () => reject(query.error);
        };
      });
    const original = await read('OliveiraEditsDB', 'files', 'image-1');
    const stored = await read('OliveiraEditsV2', 'records', 'workspace.json');
    return { keys, size: original.size, workspace: JSON.parse(stored) };
  });
  assert.deepEqual(actual.keys, expected.keys);
  assert.equal(actual.size, expected.size);
  assert.equal(actual.workspace.projects[0].items.length, 2);
  const image = actual.workspace.projects[0].items.find((item) => item.kind === 'image');
  assert.equal(image.legacyPayload.campoExtra, 'PRESERVAR');
  assert.equal(actual.workspace.profiles[0].templates.length, 1);
  assert.ok(actual.workspace.projects[0].items.some((item) => item.status === 'missing'));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        checks: [
          'Migração real recupera arquivo IndexedDB, texto, grupo e template',
          'JSON legado e arquivo originais intactos',
          'Campos desconhecidos e arquivo ausente preservados',
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await mkdir('.artifacts/migration', { recursive: true });
  await page.screenshot({ path: '.artifacts/migration/failure.png' });
  await writeFile('.artifacts/migration/failure.txt', await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
