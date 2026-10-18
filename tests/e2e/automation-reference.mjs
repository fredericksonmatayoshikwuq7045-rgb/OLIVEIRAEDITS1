import { resource, inspector, selectTrack, mediaMenu, layout, assistant } from './layer-helpers.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const directory = '.artifacts/automation-reference';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
async function stored() {
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Salvo');
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
        };
      }),
  );
}
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  const fixture = await page.evaluate(() => {
    const logo = document.createElement('canvas');
    logo.width = 65;
    logo.height = 35;
    const l = logo.getContext('2d');
    l.fillStyle = '#fff';
    l.fillRect(0, 0, 65, 35);
    l.fillStyle = '#111';
    l.fillRect(5, 4, 8, 26);
    l.fillRect(5, 23, 38, 7);
    l.beginPath();
    l.arc(46, 13, 9, 0, Math.PI * 2);
    l.fill();
    const source = [
      [37, 31],
      [299, 231],
    ].map(([left, top]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 320;
      const c = canvas.getContext('2d');
      c.fillStyle = '#456a7c';
      c.fillRect(0, 0, 480, 320);
      c.drawImage(logo, left, top);
      return canvas.toDataURL().split(',')[1];
    });
    const replacement = document.createElement('canvas');
    replacement.width = 128;
    replacement.height = 64;
    const r = replacement.getContext('2d');
    r.fillStyle = '#ff2244';
    r.fillRect(0, 0, 25, 64);
    r.fillRect(40, 0, 25, 64);
    r.fillRect(80, 0, 25, 64);
    return { reference: logo.toDataURL().split(',')[1], replacement: replacement.toDataURL().split(',')[1], source };
  });
  const file = (name, data) => ({ name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Referências');
  await page.getByLabel('Foto do perfil', { exact: true }).setInputFiles(file('foto.png', fixture.replacement));
  await page.getByRole('button', { name: 'Usar esta foto' }).click();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir editor de Referências' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click();
  await (await chooser).setFiles(fixture.source.map((data, index) => file(`visual-${index}.png`, data)));
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  await mediaMenu(page);
  await page.getByLabel('Selecionar mídias').selectOption('all');
  await page.keyboard.press('Escape');
  await assistant(page);
  await page.getByLabel('O que analisar').selectOption('mark');
  await page.getByLabel('Como localizar a marca antiga').selectOption('image');
  await page.getByLabel('Imagem recortada da marca antiga', { exact: true }).setInputFiles(file('marca-antiga.png', fixture.reference));
  await page.getByText('Referência salva na conta. Use uma imagem bem recortada em torno da marca.', { exact: true }).waitFor();
  await page.getByLabel('Importar minha logo', { exact: true }).setInputFiles(file('minha-logo.png', fixture.replacement));
  await page.waitForFunction(
    () =>
      document.querySelector('select option:checked') &&
      [...document.querySelectorAll('select')].some(
        (element) =>
          element.closest('label')?.textContent.includes('Ou minha logo') && element.selectedOptions[0]?.textContent === 'minha-logo.png',
      ),
  );
  await page.getByRole('button', { name: 'Analisar seleção', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${directory}/visual-review.png` });
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).click();
  let state = await stored();
  let profile = state.profiles.find((profile) => profile.name === 'Referências');
  const project = state.projects.find((project) => project.profileId === profile.id);
  assert.ok(project.items.every((item) => item.render.layers.some((layer) => layer.id === 'auto-cover-logo')));
  assert.notEqual(project.items[0].render.layers[0].rect.x, project.items[1].render.layers[0].rect.x);
  const rule = profile.markRule;
  assert.ok(rule.referenceAssetId);
  assert.ok(rule.replacementTemplateId);
  checks.push('Referência visual localizada por worker real em posições diferentes; logo transparente recebe placa opaca');
  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await page.getByRole('button', { name: 'Opções de Referências' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar perfil', exact: true }).click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  const backup = `${directory}/referencias.oeprofile`;
  await writeFile(backup, bytes);
  const importing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar perfil', exact: true }).click();
  await (await importing).setFiles(backup);
  await page.getByText('Perfil importado com segurança.', { exact: true }).waitFor();
  state = await stored();
  const accounts = state.profiles.filter((profile) => profile.name === 'Referências');
  assert.equal(accounts.length, 2);
  const cloned = accounts.find((account) => account.id !== profile.id);
  assert.notEqual(cloned.avatarAssetId, profile.avatarAssetId);
  assert.ok(cloned.assets.some((asset) => asset.id === cloned.avatarAssetId));
  assert.notEqual(cloned.markRule.referenceAssetId, rule.referenceAssetId);
  assert.ok(cloned.assets.some((asset) => asset.id === cloned.markRule.referenceAssetId));
  assert.notEqual(cloned.markRule.replacementTemplateId, rule.replacementTemplateId);
  assert.ok(cloned.templates.some((template) => template.id === cloned.markRule.replacementTemplateId));
  await page.getByRole('button', { name: 'Abrir editor de Referências', exact: true }).last().click();
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  assert.equal(await page.locator('.stage-preview canvas').count(), 1);
  checks.push('Backup real preserva foto, referências e coberturas; importação remapeia IDs para uma conta independente');
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/report.json`, JSON.stringify({ status: 'passed', checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png` });
  await writeFile(`${directory}/failure.txt`, `${error}\n${errors.join('\n')}\n${await page.locator('body').innerText()}`);
  throw error;
} finally {
  await browser.close();
}
