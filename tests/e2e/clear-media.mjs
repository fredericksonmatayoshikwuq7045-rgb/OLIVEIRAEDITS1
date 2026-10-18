import { resource, inspector, selectTrack, mediaMenu, layout, assistant } from './layer-helpers.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const directory = resolve(process.env.OE_CLEAR_DIR || '.artifacts/clear-media');
await mkdir(directory, { recursive: true });
const video = `${directory}/clip.mp4`;
const generated = spawnSync(
  'ffmpeg',
  [
    '-nostdin',
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x180:rate=24',
    '-t',
    '2',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    video,
  ],
  { encoding: 'utf8' },
);
assert.equal(generated.status, 0, generated.stderr);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
const checks = [],
  errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const clearButton = async () => {
  await mediaMenu(page);
  return page.getByRole('button', { name: 'Limpar todas as mídias', exact: true });
};
const count = (value) => page.getByText(`Mídias do projeto (${value})`, { exact: true }).waitFor();
const saved = () => page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Salvo');
async function stored() {
  await saved();
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('OliveiraEditsV2');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            query = db.transaction('records').objectStore('records').get('workspace.json');
          query.onsuccess = () => {
            db.close();
            resolve(JSON.parse(query.result));
          };
          query.onerror = () => {
            db.close();
            reject(query.error);
          };
        };
      }),
  );
}
async function importFiles(files) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click();
  await (await chooser).setFiles(files);
}
async function account(name, photo) {
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill(name);
  if (photo) {
    await page.getByLabel('Foto do perfil', { exact: true }).setInputFiles(photo);
    await page.getByRole('button', { name: 'Usar esta foto', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: `Abrir editor de ${name}`, exact: true }).click();
}
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  const bytes = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      context.fillStyle = '#438673';
      context.fillRect(0, 0, 320, 180);
      return canvas.toDataURL().split(',')[1];
    }),
    'base64',
  );
  const photo = `${directory}/foto.png`,
    logo = `${directory}/logo.png`;
  await writeFile(photo, bytes);
  await writeFile(logo, bytes);
  await page.getByRole('button', { name: 'Abrir editor de Padrão', exact: true }).click();
  assert.equal(await (await clearButton()).isDisabled(), true);
  await page.getByRole('button', { name: 'Voltar às contas' }).click();
  await account('Outra conta');
  await importFiles(photo);
  await count(1);
  await page.getByRole('button', { name: 'Voltar às contas' }).click();
  await account('Nova leva', photo);
  await importFiles([photo, logo, video]);
  await count(3);
  await resource(page, 'Templates');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(logo);
  await page.getByText('Template adicionado à biblioteca da conta.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Mais recursos', exact: true }).click();
  await page.getByRole('button', { name: 'Fontes da conta', exact: true }).click();
  await page
    .getByLabel('Importar fonte', { exact: true })
    .setInputFiles(process.env.OE_TEST_FONT || '/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf');
  await page.getByText('Fonte carregada e salva no perfil.', { exact: true }).waitFor();
  await resource(page, 'Texto');
  await page.getByRole('button', { name: 'Adicionar texto', exact: true }).click();
  await page.getByLabel('Texto da camada').fill('Edição preservada ao desfazer');
  await resource(page, 'Mídias');
  await page.locator('.media-slot[title="clip.mp4"]').click();
  await inspector(page, 'Tempo');
  await page.locator('.video-timeline').waitFor();
  const snapshot = await stored(),
    id = snapshot.activeProjectByProfile[snapshot.activeProfileId];
  const originalItems = snapshot.projects.find((project) => project.id === id).items;
  const otherProject = snapshot.projects.find((project) => project.profileId !== snapshot.activeProfileId && project.items.length);
  const preferences = await page.evaluate(() => localStorage.getItem('oe_ui_v2'));
  await (await clearButton()).click();
  await page.getByRole('dialog', { name: 'Limpar todas as mídias?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await count(3);
  await (await clearButton()).click();
  await page.keyboard.press('Escape');
  await count(3);
  assert.deepEqual(
    (await stored()).projects.find((project) => project.id === id),
    snapshot.projects.find((project) => project.id === id),
  );
  checks.push('Botão desativado no projeto vazio; cancelar ou Escape preservam a leva e suas edições');
  await (await clearButton()).click();
  await page.getByRole('button', { name: 'Limpar 3 mídias', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await count(0);
  await page.getByText('Seu próximo post começa aqui', { exact: true }).waitFor();
  assert.equal(await page.locator('.video-timeline').count(), 0);
  assert.equal(await (await clearButton()).isDisabled(), true);
  let state = await stored();
  assert.deepEqual(state.projects.find((project) => project.id === id).items, []);
  assert.deepEqual(state.profiles, snapshot.profiles);
  assert.deepEqual(
    state.projects.find((project) => project.id === otherProject.id),
    otherProject,
  );
  assert.equal(await page.evaluate(() => localStorage.getItem('oe_ui_v2')), preferences);
  assert.deepEqual(await readFile(photo), bytes);
  assert.deepEqual(await readFile(logo), bytes);
  assert.ok((await readFile(video)).length > 1000);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  await count(3);
  assert.deepEqual((await stored()).projects.find((project) => project.id === id).items, originalItems);
  await page.getByRole('button', { name: 'Refazer (Ctrl + Shift + Z)', exact: true }).click();
  await count(0);
  checks.push('Limpeza completa é uma única ação, mesmo com cliques repetidos; desfazer restaura imagens, vídeo e edições; refazer limpa');
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar pasta', exact: true }).first().click();
  await picker;
  assert.equal(await (await clearButton()).isDisabled(), true);
  await page.locator('input[type="file"][webkitdirectory]').dispatchEvent('cancel');
  await importFiles(logo);
  await count(1);
  state = await stored();
  assert.equal(state.projects.find((project) => project.id === id).items[0].slot, 1);
  await layout(page, 'right');
  await page.setViewportSize({ width: 1100, height: 800 });
  const buttonBox = await (await clearButton()).boundingBox();
  assert.ok(buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= 1100);
  await (await clearButton()).click();
  await page.getByRole('button', { name: 'Limpar 1 mídia', exact: true }).click();
  await count(0);
  await saved();
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Nova leva', exact: true }).click();
  await count(0);
  state = await stored();
  const profile = state.profiles.find((profile) => profile.name === 'Nova leva');
  assert.equal(profile.templates.length, 1);
  assert.equal(profile.fonts.length, 1);
  assert.ok(profile.avatarAssetId);
  assert.deepEqual(
    state.projects.find((project) => project.id === otherProject.id),
    otherProject,
  );
  await importFiles(photo);
  await count(1);
  assert.equal((await stored()).projects.find((project) => project.id === id).items[0].slot, 1);
  checks.push(
    'Nova leva começa no slot 1; limpeza persiste após reload sem apagar foto, template, fonte, preferências, originais ou outro perfil',
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${directory}/new-batch.png` });
  await writeFile(`${directory}/report.json`, JSON.stringify({ status: 'passed', checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await writeFile(
    `${directory}/failure.txt`,
    `${error.stack || error}\n${errors.join('\n')}\n${await page
      .locator('body')
      .innerText()
      .catch(() => 'Page unavailable')}`,
  );
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
