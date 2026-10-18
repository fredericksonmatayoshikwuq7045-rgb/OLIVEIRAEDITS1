import { resource, inspector, selectTrack, mediaMenu, layout, assistant } from './layer-helpers.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const directory = '.artifacts/appearance-layout';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const checks = [],
  errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function contrast(selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const luminance = (color) =>
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .reduce((sum, value, index) => {
            const channel = value / 255;
            return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
          }, 0);
      const style = getComputedStyle(element),
        foreground = luminance(style.color),
        background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
}
async function customize() {
  await page.getByRole('button', { name: 'Personalizar estúdio' }).click();
}
async function color(value) {
  await page.getByLabel('Cor de destaque', { exact: true }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.waitForFunction((value) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const target = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(document.querySelector('.form-actions .button-primary')).backgroundColor === target;
  }, value);
}
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  await customize();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('light');
  await color('#ffffff');
  assert.ok((await contrast('.form-actions .button-primary')) > 4.5);
  await color('#000000');
  assert.ok((await contrast('.form-actions .button-primary')) > 4.5);
  await color('#ed4355');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Opções de Padrão' }).click();
  assert.ok((await contrast('.dropdown-menu')) > 4.5);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir editor de Padrão' }).click();
  await page.getByRole('button', { name: 'Ocultar frase por hoje' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click();
  await (
    await chooser
  ).setFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const context = canvas.getContext('2d');
        context.fillStyle = '#567a40';
        context.fillRect(0, 0, 320, 180);
        return canvas.toDataURL().split(',')[1];
      }),
      'base64',
    ),
  });
  await page.getByText('Mídias do projeto (1)', { exact: true }).waitFor();
  assert.ok((await contrast('.toast')) > 4.5);
  const before = await page.locator('.resource-panel').boundingBox();
  await page.getByRole('separator', { name: 'Largura da biblioteca' }).focus();
  await page.keyboard.press('ArrowLeft');
  const after = await page.locator('.resource-panel').boundingBox();
  assert.ok(before.width - after.width >= 9);
  checks.push('Tema claro mantém menus e avisos legíveis; destaque branco/preto adapta a cor do texto; divisória responde em 1100px');
  const initialSize = await page
    .locator('.resource-tabs button')
    .first()
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  await customize();
  const size = page.getByRole('slider', { name: 'Tamanho da fonte da interface' });
  await size.focus();
  await size.press('End');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  const enlargedSize = await page
    .locator('.resource-tabs button')
    .first()
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(enlargedSize / initialSize > 1.2);
  await layout(page, 'right');
  const exportButton = await page.locator('.workflow-bar .button-primary').boundingBox();
  assert.ok(exportButton.x >= 0 && exportButton.x + exportButton.width <= 1100);
  assert.ok(await page.locator('.stage-area').evaluate((node) => node.getBoundingClientRect().width > 220));
  await page.screenshot({ path: `${directory}/light-1100.png` });
  await customize();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar às contas' }).click();
  assert.equal(await page.locator('.matrix-background').isVisible(), false);
  checks.push(
    'Tamanho da fonte altera controles reais; layout cabe em 1100px; tema do sistema reage e movimento reduzido oculta a animação',
  );
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/report.json`, JSON.stringify({ status: 'passed', checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png` });
  throw error;
} finally {
  await browser.close();
}
