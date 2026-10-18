import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const directory = resolve(process.env.OE_UPGRADE_DIR || '.artifacts/editor-upgrade');
await mkdir(directory, { recursive: true });
const clip = `${directory}/clip.mp4`;
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
    '6',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    clip,
  ],
  { encoding: 'utf8' },
);
assert.equal(generated.status, 0, generated.stderr);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, acceptDownloads: true });
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
const saved = () => page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Salvo');
async function workspace() {
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
          query.onerror = () => reject(query.error);
        };
      }),
  );
}
async function chooser(action, files) {
  const pending = page.waitForEvent('filechooser');
  await action();
  await (await pending).setFiles(files);
}
async function setRange(label, value) {
  await page.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function customize() {
  await page.getByRole('button', { name: 'Personalizar estúdio' }).click();
  await page.getByRole('dialog', { name: 'Personalizar seu estúdio' }).waitFor();
}
async function createAccount(name) {
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill(name);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: `Abrir editor de ${name}`, exact: true }).waitFor();
}
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  const fixtures = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2050e0';
    context.fillRect(0, 0, 96, 96);
    context.fillStyle = '#e02040';
    context.fillRect(96, 0, 96, 96);
    const avatar = canvas.toDataURL().split(',')[1];
    const scenes = [0, 1].map((index) => {
      const c = document.createElement('canvas');
      c.width = 768;
      c.height = 1024;
      const x = c.getContext('2d');
      x.fillStyle = 'black';
      x.fillRect(0, 0, 768, 1024);
      x.fillStyle = 'white';
      x.font = 'bold 40px Arial';
      x.fillText('TÍTULO NA MOLDURA', 100, 100);
      const gradient = x.createLinearGradient(0, 220, 768, 820);
      gradient.addColorStop(0, '#406a50');
      gradient.addColorStop(1, '#92994a');
      x.fillStyle = gradient;
      x.fillRect(0, 220, 768, 600);
      const px = index ? 300 : 80,
        py = index ? 650 : 310;
      x.fillStyle = 'white';
      x.fillRect(px, py, 365, 70);
      x.fillStyle = 'black';
      x.font = 'bold 40px Arial';
      x.fillText('MARCA ANTIGA', px + 15, py + 49);
      return c.toDataURL().split(',')[1];
    });
    return { avatar, scenes };
  });
  const photo = { name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.avatar, 'base64') };
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Estúdio Teste');
  await page.getByLabel('Foto do perfil', { exact: true }).setInputFiles(photo);
  assert.equal(await page.getByRole('button', { name: 'Criar conta', exact: true }).isDisabled(), true);
  await page.getByRole('slider', { name: 'Posição horizontal da foto' }).press('End');
  await page.getByRole('button', { name: 'Usar esta foto', exact: true }).click();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.locator('.account-card').filter({ hasText: 'Estúdio Teste' }).locator('.account-avatar img').waitFor();
  let state = await workspace();
  const account = state.profiles.find((profile) => profile.name === 'Estúdio Teste');
  assert.ok(account.avatarAssetId);
  assert.ok(account.assets.some((asset) => asset.id === account.avatarAssetId));
  checks.push('Foto recortada salva com a conta, com confirmação antes de criar');
  await customize();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('light');
  await page.getByRole('combobox', { name: 'Fonte da interface' }).selectOption('mono');
  await page.getByRole('button', { name: 'Frases', exact: true }).click();
  await page.getByRole('combobox', { name: 'Idioma das frases' }).selectOption('en');
  await page.getByRole('combobox', { name: 'Autor preferido' }).selectOption('Elon Musk');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('.daily-quote blockquote[lang="en"]').filter({ hasText: 'trend' }).waitFor();
  await page.screenshot({ path: `${directory}/dashboard-light.png` });
  await page.getByRole('button', { name: 'Abrir editor de Estúdio Teste', exact: true }).click();
  assert.equal(await page.locator('.matrix-background').count(), 0);
  await page.getByRole('button', { name: 'Ocultar frase por hoje' }).click();
  checks.push('Tema, fonte, idioma e autor funcionam; animação fica somente na abertura');
  await chooser(
    () => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(),
    [photo, { name: 'paisagem.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.scenes[0], 'base64') }],
  );
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  await page.locator('.media-slot[title="avatar.png"]').click();
  await page.getByRole('button', { name: /2.*Enquadrar/ }).click();
  const handle = await page.getByRole('button', { name: 'Redimensionar seleção se', exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 36, handle.y + 20, { steps: 8 });
  await page.mouse.up();
  const zoom = page.getByRole('slider', { name: 'Zoom', exact: true });
  assert.ok(Number(await zoom.inputValue()) > 1.05);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  assert.equal(Number(await zoom.inputValue()), 1);
  await page.getByRole('button', { name: 'Ver original', exact: true }).click();
  assert.equal(await page.locator('.transform-box').count(), 0);
  await page.getByRole('button', { name: 'Ver edição', exact: true }).click();
  await page.locator('.media-slot[title="avatar.png"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Duplicar', exact: true }).click();
  await page.getByText('Mídias do projeto (3)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  await page.locator('.media-slot[title="avatar.png"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Aplicar edição a todos…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Aplicar ajustes' }).waitFor();
  await page.getByRole('button', { name: 'Aplicar a 1 mídia(s)', exact: true }).click();
  await page.getByRole('combobox', { name: 'Layout do editor' }).selectOption('right');
  const stage = await page.locator('.stage-area').boundingBox(),
    strip = await page.locator('.media-strip').boundingBox();
  assert.ok(stage.x > strip.x);
  await page.screenshot({ path: `${directory}/layout-right.png` });
  await page.getByRole('combobox', { name: 'Layout do editor' }).selectOption('focus');
  assert.equal(await page.locator('.library').isVisible(), false);
  await page.getByRole('combobox', { name: 'Layout do editor' }).selectOption('classic');
  checks.push('Alças e comparação visual, um desfazer por gesto, menu contextual e três layouts');
  await chooser(() => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(), clip);
  await page.getByText('Mídias do projeto (3)', { exact: true }).waitFor();
  await page.locator('.media-slot[title="clip.mp4"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.filmstrip-frames img').length === 8);
  await page.locator('.source-trim summary').click();
  await setRange('Posição de reprodução', 3);
  await page.getByRole('button', { name: 'Dividir no cursor (S)', exact: true }).click();
  await page.getByText('Mídias do projeto (4)', { exact: true }).waitFor();
  state = await workspace();
  let project = state.projects.find((project) => project.profileId === account.id);
  const pieces = project.items.filter((item) => item.kind === 'video');
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].assetId, pieces[1].assetId);
  assert.equal(pieces[0].trim.out, pieces[1].trim.in);
  assert.equal(pieces[0].trim.out, 3);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  await page.getByText('Mídias do projeto (3)', { exact: true }).waitFor();
  const left = page.getByRole('slider', { name: 'Arrastar início do corte', exact: true });
  await left.focus();
  await left.press('ArrowRight');
  assert.ok(Number(await page.getByLabel('Início do corte', { exact: true }).inputValue()) > 0);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  assert.equal(Number(await page.getByLabel('Início do corte', { exact: true }).inputValue()), 0);
  checks.push('Timeline com oito quadros reais, corte acessível, split sem copiar a origem e desfazer');
  await saved();
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Estúdio Teste', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Ocultar frase por hoje' }).count(), 0);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByText('Mídias do projeto (3)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await createAccount('Automação');
  await page.getByRole('button', { name: 'Abrir editor de Automação', exact: true }).click();
  await chooser(
    () => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(),
    fixtures.scenes.map((base64, index) => ({ name: `marca-${index}.png`, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })),
  );
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  await page.getByLabel('Selecionar mídias').selectOption('all');
  await page.getByRole('button', { name: 'Assistente em lote', exact: true }).click();
  await page.getByRole('button', { name: 'Analisar seleção', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).waitFor();
  await page.screenshot({ path: `${directory}/crop-review.png` });
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).click();
  state = await workspace();
  project = state.projects.find((project) => project.profileId === state.activeProfileId);
  assert.ok(project.items.every((item) => item.render.media.crop.y > 0.2 && item.render.media.crop.height < 0.62));
  checks.push('Recorte encontra a cena e ignora o título branco na moldura, em duas mídias');
  await page.getByRole('button', { name: 'Assistente em lote', exact: true }).click();
  await page.getByLabel('O que analisar').selectOption('mark');
  await page.getByLabel('Texto da marca antiga').fill('MARCA ANTIGA');
  await page.getByLabel('Minha marca em texto').fill('MEU ESTÚDIO');
  await page.getByRole('button', { name: 'Analisar seleção', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).waitFor({ timeout: 120000 });
  await page.screenshot({ path: `${directory}/ocr-review.png` });
  await page.getByRole('button', { name: 'Aplicar 2 resultado(s)', exact: true }).click();
  state = await workspace();
  project = state.projects.find((project) => project.profileId === state.activeProfileId);
  assert.ok(project.items.every((item) => item.render.layers.filter((layer) => layer.id.startsWith('auto-cover-')).length === 2));
  const plates = project.items.map((item) => item.render.layers.find((layer) => layer.id === 'auto-cover-plate').rect);
  assert.ok(Math.abs(plates[0].y - plates[1].y) > 0.2);
  checks.push('OCR local real encontra o mesmo texto em posições diferentes e aplica coberturas individuais');
  await page.locator('.media-slot[title="marca-0.png"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Exportar esta mídia', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar 1 mídias', exact: true }).click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  checks.push('Exportação PNG real da mídia com recorte e cobertura aplicados');
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
