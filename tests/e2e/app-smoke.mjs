import { resource, inspector, selectTrack, mediaMenu, layout, assistant } from './layer-helpers.mjs';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const url = process.env.OE_TEST_URL || 'http://127.0.0.1:3001';
const directory = process.env.OE_E2E_DIR || '.artifacts/app-smoke';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const results = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('crash', () => errors.push('A página encerrou inesperadamente.'));
try {
  await page.goto(url);
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  // Real keystrokes verify the modal does not steal focus on each re-render.
  await page.getByLabel('Nome da conta').pressSequentially('Conta A');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir editor de Conta A' }).click();
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#d02530';
    context.fillRect(0, 0, 128, 96);
    context.fillStyle = '#3070e0';
    context.fillRect(64, 0, 64, 96);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click();
  await (await chooser).setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  await page.getByText('Mídias do projeto (1)', { exact: true }).waitFor();
  results.push('Criar conta e importar imagem');
  await selectTrack(page, '@media');
  const stage = await page.locator('.stage-preview').boundingBox();
  const touch = await page.context().newCDPSession(page);
  const center = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
  const points = (distance) => [
    { id: 1, x: center.x - distance, y: center.y },
    { id: 2, x: center.x + distance, y: center.y },
  ];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(35) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(60) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const zoom = page.getByRole('slider', { name: 'Zoom', exact: true });
  assert.ok(Number(await zoom.inputValue()) > 1.5);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  assert.equal(Number(await zoom.inputValue()), 1);
  results.push('Pinça com dois dedos amplia e gera uma única edição desfeita');
  await resource(page, 'Texto');
  await page.getByRole('button', { name: 'Adicionar texto', exact: true }).click();
  await page.getByLabel('Texto da camada').fill('Teste de exportação');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar 1 mídias', exact: true }).click();
  const download = await downloadPending;
  assert.equal(await download.failure(), null);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1080, 1920]);
  results.push('Editar texto e exportar PNG real 1080×1920');
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent === 'Salvo');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Conta A' }).click();
  await page.getByText('Mídias do projeto (1)', { exact: true }).waitFor();
  await resource(page, 'Texto');
  await page.locator('.timeline-track-name').filter({ hasText: 'Teste de exportação' }).waitFor();
  results.push('Recarregar preserva imagem e camadas');
  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Conta B');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir editor de Conta B' }).click();
  await page.getByText('Seu próximo post começa aqui', { exact: true }).waitFor();
  assert.equal(await page.getByText('fixture.png', { exact: true }).count(), 0);
  results.push('Contas isolam os projetos');
  const folderButton = page.getByRole('button', { name: 'Importar pasta', exact: true }).first();
  const cancelChooser = page.waitForEvent('filechooser');
  await folderButton.click();
  await cancelChooser;
  assert.equal(await folderButton.isDisabled(), true);
  await page.locator('input[type="file"][webkitdirectory]').dispatchEvent('cancel');
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Importar pasta"]')?.disabled);
  assert.equal(await page.locator('input[type="file"][webkitdirectory]').count(), 0);
  results.push('Cancelar seleção de pasta libera a próxima importação');

  const bulkDirectory = resolve(directory, 'pasta-com-501-midias');
  await mkdir(bulkDirectory, { recursive: true });
  await Promise.all(
    Array.from({ length: 501 }, (_, index) => writeFile(`${bulkDirectory}/bulk-${index + 1}.png`, Buffer.from(fixture, 'base64'))),
  );
  await writeFile(`${bulkDirectory}/bulk-2-corrupt.png`, 'Arquivo com extensão PNG, mas sem imagem válida.');
  await writeFile(`${bulkDirectory}/ignorar.txt`, 'Um arquivo não suportado não deve impedir o restante do lote.');
  let chooserCount = 0;
  const countChooser = () => chooserCount++;
  page.on('filechooser', countChooser);
  const bulkChooser = page.waitForEvent('filechooser');
  // Two clicks in the same task exercise the lock before React disables the buttons.
  await folderButton.evaluate((button) => {
    button.click();
    button.click();
  });
  const bulkPicker = await bulkChooser;
  assert.equal(chooserCount, 1, 'Cliques repetidos abriram mais de um seletor');
  for (const button of await page.getByRole('button', { name: 'Importar pasta', exact: true }).all()) {
    assert.equal(await button.isDisabled(), true);
  }
  await bulkPicker.setFiles(bulkDirectory);
  await page.getByText('Mídias do projeto (501)', { exact: true }).waitFor({ timeout: 60000 });
  await page.getByText('501 mídia(s) importada(s); 1 com falha, 1 ignorado(s). Confira os avisos.', { exact: true }).waitFor();
  assert.equal(chooserCount, 1, 'O lote abriu um seletor adicional');
  page.off('filechooser', countChooser);
  await mediaMenu(page);
  assert.equal(await folderButton.isDisabled(), false);
  await page.keyboard.press('Escape');
  assert.ok((await page.locator('[role="listbox"] [role="option"]').count()) < 40, 'Grid não está virtualizado');
  const strip = page.getByRole('listbox', { name: 'Mídias importadas' });
  const dimensions = await strip.evaluate((element) => ({ width: element.clientHeight, total: element.scrollHeight }));
  const seen = new Map();
  for (let left = 0; left < dimensions.total; left += Math.max(1, dimensions.width * 0.75)) {
    const cards = await strip.evaluate(async (element, offset) => {
      element.scrollTop = offset;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return [...element.querySelectorAll('[role="option"]')].map((card) => ({
        title: card.getAttribute('title'),
        slot: Number(card.querySelector('.media-slot-index')?.textContent),
      }));
    }, left);
    assert.ok(cards.length < 40, 'A rolagem deixou de virtualizar as mídias');
    for (const card of cards) seen.set(card.slot, card.title);
  }
  assert.deepEqual(
    [...seen].sort((a, b) => a[0] - b[0]),
    Array.from({ length: 501 }, (_, i) => [i + 1, `bulk-${i + 1}.png`]),
  );
  await page.locator('.media-slot[title="bulk-501.png"]').click();
  await mediaMenu(page);
  await page.getByRole('button', { name: 'Recolher mídias', exact: true }).click();
  await mediaMenu(page);
  await page.getByRole('button', { name: 'Expandir mídias', exact: true }).click();
  await page.locator('.media-slot.active[title="bulk-501.png"]').waitFor();
  assert.ok((await strip.getByRole('option').count()) > 0);
  results.push('Uma pasta: 501 mídias em ordem natural e slots contínuos; corrupto e texto isolados, sem reabrir seletor');
  results.push('Reabrir o grid após rolar ao fim mantém cartões e mídia ativa visíveis');
  await mediaMenu(page);
  await page.getByLabel('Selecionar mídias').selectOption('all');
  await page.keyboard.press('Escape');
  await page.getByText('501 selecionadas', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  await page.getByText('Seu próximo post começa aqui', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Refazer (Ctrl + Shift + Z)', exact: true }).click();
  await page.getByText('Mídias do projeto (501)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  results.push('501 mídias: grid virtualizado, seleção completa, desfazer e refazer');

  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await page.getByRole('button', { name: 'Opções de Conta A', exact: true }).click();
  const backupPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar perfil', exact: true }).click();
  const backup = await backupPending;
  const backupBytes = await readFile(await backup.path());
  assert.equal(backupBytes.subarray(0, 2).toString(), 'PK');
  const backupFile = `${directory}/Conta_A.oeprofile`;
  await writeFile(backupFile, backupBytes);
  const importChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar perfil', exact: true }).click();
  await (await importChooser).setFiles(backupFile);
  await page.getByText('Perfil importado com segurança.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Abrir editor de Conta A', exact: true }).count(), 2);
  await page.getByRole('button', { name: 'Abrir editor de Conta A', exact: true }).last().click();
  await page.getByText('Mídias do projeto (1)', { exact: true }).waitFor();
  results.push('Backup .oeprofile com assets importa como conta independente');
  await page.screenshot({ path: `${directory}/editor.png` });
  assert.deepEqual(errors, []);
  const report = JSON.stringify({ status: 'passed', checks: results, pageErrors: errors }, null, 2);
  await writeFile(`${directory}/report.json`, report);
  console.log(report);
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png` });
  await writeFile(`${directory}/failure.txt`, (await page.locator('body').innerText()) + '\n' + errors.join('\n'));
  throw error;
} finally {
  await browser.close();
}
