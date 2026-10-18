import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  choose,
  ffmpeg,
  resource,
  inspector,
  selectTrack,
  trackAction,
  range,
  currentItem,
  number,
  layout,
  mediaMenu,
} from './layer-helpers.mjs';
const directory = resolve(process.env.OE_STUDIO_DIR || '.artifacts/studio-layout');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
async function bounds() {
  const result = await page.evaluate(() => {
    const box = (selector) => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      player: box('.editor-center'),
      stage: box('.stage-area'),
      timeline: box('.studio-timeline'),
      library: box('.resource-panel'),
      inspector: box('.contextual-properties'),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.equal(result.overflow, false);
  assert.ok(result.player.height >= 250, JSON.stringify(result));
  assert.ok(result.stage.height > 160, JSON.stringify(result));
  assert.ok(result.timeline.y >= result.player.y + result.player.height - 1);
  assert.ok(result.timeline.width === page.viewportSize().width);
  return result;
}
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  await page.getByRole('button', { name: 'Abrir editor de Padrão', exact: true }).click();
  if (await page.getByRole('button', { name: 'Ocultar frase por hoje' }).count())
    await page.getByRole('button', { name: 'Ocultar frase por hoje' }).click();
  const photos = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d'),
      gradient = ctx.createLinearGradient(0, 0, 0, 1280);
    gradient.addColorStop(0, '#d2b87d');
    gradient.addColorStop(0.4, '#638e78');
    gradient.addColorStop(1, '#153d42');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 720, 1280);
    for (let index = 0; index < 12; index++) {
      ctx.fillStyle = `rgba(27, 63, 59, ${0.1 + index / 40})`;
      ctx.beginPath();
      ctx.moveTo(-100, 1280);
      ctx.bezierCurveTo(120, 450 + index * 40, 450, 950 - index * 50, 820, 750 + index * 40);
      ctx.lineTo(820, 1280);
      ctx.fill();
    }
    ctx.fillStyle = '#f9e8bd';
    ctx.beginPath();
    ctx.arc(520, 260, 68, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL().split(',')[1];
  });
  const photo = directory + '/paisagem.png',
    video = directory + '/cena.mp4';
  await writeFile(photo, Buffer.from(photos, 'base64'));
  ffmpeg([
    '-loop',
    '1',
    '-i',
    photo,
    '-t',
    '8',
    '-r',
    '24',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    '-pix_fmt',
    'yuv420p',
    video,
  ]);
  await choose(page, () => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(), [video, photo]);
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  assert.equal(await page.locator('.composition-timeline .clip-inspector').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Reproduzir prévia', exact: true }).count(), 1);
  assert.equal(await page.getByRole('slider', { name: 'Posição na composição', exact: true }).count(), 1);
  await resource(page, 'Texto');
  await page.getByRole('button', { name: 'Adicionar texto', exact: true }).click();
  await page.getByLabel('Texto da camada').fill('O próximo passo começa agora.');
  let item = await currentItem(page, 'cena.mp4'),
    textId = item.render.layers[0].id;
  await number(page, 'Aparecer em (s)', 1);
  await number(page, 'Duração da camada (s)', 5);
  await page.getByRole('button', { name: 'Opções da camada', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Opções da camada', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.equal(
    await page.getByRole('button', { name: 'Opções da camada', exact: true }).evaluate((node) => node === document.activeElement),
    true,
  );
  await trackAction(page, 'Duplicar camada');
  item = await currentItem(page, 'cena.mp4');
  assert.equal(item.render.layers.length, 2);
  const copyId = item.render.layers.find((layer) => layer.id !== textId).id;
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  assert.equal((await currentItem(page, 'cena.mp4')).render.layers.length, 1);
  await page.getByRole('combobox', { name: 'Ajuste da mídia', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Refazer (Ctrl + Shift + Z)', exact: true }).click();
  await selectTrack(page, copyId);
  await page.getByRole('button', { name: 'Opções da seleção', exact: true }).focus();
  await page.keyboard.press('Delete');
  assert.equal((await currentItem(page, 'cena.mp4')).render.layers.length, 1);
  assert.equal(await page.locator('.timeline-track-row').count(), 2);
  await selectTrack(page, textId);
  await range(page, 'Posição na composição', 1);
  await page.locator(`[data-track-id="${textId}"] .timeline-track-name`).focus();
  await page.keyboard.press('s');
  assert.equal((await currentItem(page, 'cena.mp4')).render.layers.length, 1);
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor({ state: 'attached' });
  await page.locator(`[data-track-id="${textId}"] .timeline-track-name`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Editar tempos', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'Tempo', exact: true }).getAttribute('aria-selected'), 'true');
  checks.push('Um player e um inspetor; tempos, menu contextual, duplicação e Delete atuam na camada selecionada');
  await resource(page, 'Templates');
  await page.locator('.library').getByRole('button', { name: 'Headline', exact: true }).click();
  await resource(page, 'Mídias');
  await resource(page, 'Templates');
  assert.ok((await page.locator('.library .mini-tabs button.active').innerText()).includes('Headline'));
  await resource(page, 'Mídias');
  await mediaMenu(page);
  await page.keyboard.press('Escape');
  await selectTrack(page, '@media');
  await page.getByRole('button', { name: 'Expandir timeline', exact: true }).click();
  await bounds();
  if (await page.getByRole('button', { name: 'Fechar mensagem', exact: true }).count())
    await page.getByRole('button', { name: 'Fechar mensagem', exact: true }).click();
  await page.screenshot({ path: directory + '/editor-1600.png' });
  const normal = await bounds();
  const separator = page.getByRole('separator', { name: 'Altura da timeline', exact: true });
  await separator.focus();
  await separator.press('ArrowUp');
  assert.ok((await bounds()).timeline.height > normal.timeline.height);
  for (const size of [
    { width: 1100, height: 700 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await bounds();
  }
  await page.setViewportSize({ width: 1100, height: 800 });
  await layout(page, 'right');
  const right = await bounds();
  assert.ok(right.player.x > right.inspector.x);
  const propertiesResize = page.getByRole('separator', { name: 'Largura das propriedades', exact: true });
  await propertiesResize.focus();
  await propertiesResize.press('ArrowRight');
  assert.ok((await bounds()).inspector.width - right.inspector.width >= 9);
  await selectTrack(page, textId);
  await page.locator(`[data-track-id="${textId}"] .timeline-track-name`).click({ button: 'right' });
  const context = await page.getByRole('menu', { name: 'Ações da camada', exact: true }).boundingBox();
  assert.ok(context.y + context.height <= 800);
  await page.getByRole('menuitem', { name: 'Remover camada da timeline', exact: true }).scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');
  await selectTrack(page, '@media');
  await page.screenshot({ path: directory + '/editor-right-1100.png' });
  await layout(page, 'focus');
  assert.equal(await page.locator('.resource-panel').isVisible(), false);
  assert.equal(await page.locator('.contextual-properties').isVisible(), false);
  await bounds();
  await layout(page, 'classic');
  checks.push('Biblioteca conserva a categoria; três layouts e timeline redimensionável cabem de 1100×700 a 1920×1080');
  await page.getByRole('button', { name: 'Personalizar estúdio', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Opções da seleção', exact: true }).click();
  const menu = await page.getByRole('dialog', { name: 'Opções da seleção', exact: true }).boundingBox();
  assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= 1100 && menu.y + menu.height <= 800);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: directory + '/editor-light-1100.png' });
  await inspector(page, 'Áudio');
  await page.getByRole('switch', { name: 'Áudio do vídeo principal', exact: true }).uncheck();
  assert.equal((await currentItem(page, 'cena.mp4')).render.media.audio, 'mute');
  checks.push('Tema claro e menus ficam dentro da janela; controles de áudio permanecem no inspetor contextual');
  assert.deepEqual(errors, []);
  await writeFile(directory + '/report.json', JSON.stringify({ status: 'passed', checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await writeFile(directory + '/failure.txt', String(error.stack) + '\n' + (await page.locator('body').innerText()));
  await page.screenshot({ path: directory + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
