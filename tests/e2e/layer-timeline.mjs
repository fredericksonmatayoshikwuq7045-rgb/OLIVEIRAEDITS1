import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { fixtures, choose, stored, currentItem, number, range, selectTrack, color, exportPng, pngPixel } from './layer-helpers.mjs';
const directory = resolve(process.env.OE_LAYERS_DIR || '.artifacts/layer-timeline');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(process.env.OE_TEST_URL || 'http://127.0.0.1:3000');
  const files = await fixtures(page, directory);
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Camadas');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir editor de Camadas', exact: true }).click();
  if (await page.getByRole('button', { name: 'Ocultar frase por hoje' }).count())
    await page.getByRole('button', { name: 'Ocultar frase por hoje' }).click();
  await choose(page, () => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(), [
    files.video,
    files.photo,
  ]);
  await page.getByText('Mídias do projeto (2)', { exact: true }).waitFor();
  await page.getByRole('tab', { name: /Vídeos/ }).click();
  await page.getByText('Vídeos do projeto (1)', { exact: true }).waitFor();
  const library = page.locator('.library');
  await library.getByRole('button', { name: 'Marca', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de template' }).selectOption('video');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.stamp);
  await page.getByText('Template adicionado à biblioteca da conta.', { exact: true }).waitFor();
  await library.locator('.template-card').filter({ hasText: 'stamp.mp4' }).click();
  let item = await currentItem(page, 'clip.mp4'),
    original = item.render.layers.find((layer) => layer.type === 'video');
  assert.equal(original.sourceDuration, 3);
  await selectTrack(page, original.id);
  await number(page, 'Aparecer em (s)', 1);
  await number(page, 'Desaparecer em (s)', 3);
  await number(page, 'Começar no segundo do template', 0.5);
  await page.getByRole('switch', { name: 'Repetir vídeo na camada', exact: true }).uncheck();
  await range(page, 'Posição na composição', 0.25);
  await color(page, 0.79, 0.12875, -1);
  await range(page, 'Posição na composição', 1.2);
  await color(page, 0.79, 0.12875, 2);
  await page.getByTitle('Duplicar camada', { exact: true }).click();
  item = await currentItem(page, 'clip.mp4');
  const copy = item.render.layers.find((layer) => layer.type === 'video' && layer.id !== original.id);
  assert.equal(copy.source, original.source);
  await range(page, 'X', 0.05);
  await selectTrack(page, copy.id);
  await number(page, 'Começar no segundo do template', 1.5);
  await range(page, 'Posição na composição', 1.2);
  await color(page, 0.79, 0.12875, 2);
  await color(page, 0.19, 0.14875, 1);
  checks.push(
    'Template em vídeo funciona como marca; início/fim, offset e loop têm efeito real; duas ocorrências do mesmo vídeo mantêm quadros independentes',
  );
  await selectTrack(page, original.id);
  const handle = page.locator(`.timeline-track-row[data-track-id="${original.id}"] .track-handle.start`);
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.ok((await currentItem(page, 'clip.mp4')).render.layers.find((layer) => layer.id === original.id).enable.start > 1);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  assert.equal((await currentItem(page, 'clip.mp4')).render.layers.find((layer) => layer.id === original.id).enable.start, 1);
  await library.getByRole('button', { name: 'Borda', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de template' }).selectOption('image');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.border);
  await library.locator('.template-card').filter({ hasText: 'border.png' }).click();
  await library.getByRole('button', { name: 'Headline', exact: true }).click();
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.headline);
  await page.getByRole('button', { name: 'Editar template headline.png', exact: true }).click();
  await page.getByLabel('Headline padrão', { exact: true }).fill('Headline teste');
  await page.getByRole('button', { name: 'Salvar template', exact: true }).click();
  await library.locator('.template-card').filter({ hasText: 'headline.png' }).click();
  await library.getByRole('button', { name: 'Fundo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de template' }).selectOption('video');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.stamp);
  await library.locator('.template-card').filter({ hasText: 'stamp.mp4' }).click();
  item = await currentItem(page, 'clip.mp4');
  assert.equal(item.render.layers.length, 5);
  assert.equal(await page.locator('.timeline-track-row').count(), 7);
  await selectTrack(page, '@background');
  await number(page, 'Aparecer em (s)', 0.5);
  await number(page, 'Desaparecer em (s)', 5.5);
  await number(page, 'Começar no segundo do template', 0.25);
  await range(page, 'Posição na composição', 0.2);
  await color(page, 0.5, 0.9, -1);
  await range(page, 'Posição na composição', 1.3);
  await color(page, 0.5, 0.9, 2);
  await range(page, 'Posição na composição', 3);
  await color(page, 0.5, 0.9, 1);
  await range(page, 'Posição na composição', 5.8);
  await color(page, 0.5, 0.9, -1);
  await page.screenshot({ path: `${directory}/video-tracks.png` });
  checks.push(
    'Borda, marca, headline visual, texto da headline, cópia e fundo aparecem na timeline; arrastar gera um desfazer e fundo respeita janela e fase',
  );
  await library.getByRole('button', { name: 'Marca', exact: true }).click();
  await page.getByRole('button', { name: 'Editar template stamp.mp4', exact: true }).click();
  await page.getByRole('switch', { name: 'Disponível nas alas de vídeos e imagens', exact: true }).check();
  await page.getByRole('button', { name: 'Salvar template', exact: true }).click();
  await library.getByRole('combobox', { name: /^Grupo/ }).selectOption({ label: 'Vídeos' });
  await page.getByRole('tab', { name: /Imagens/ }).click();
  assert.equal(await library.getByRole('combobox', { name: /^Grupo/ }).inputValue(), '');
  await page.getByText('Imagens do projeto (1)', { exact: true }).waitFor();
  assert.equal(await page.locator('.video-timeline').count(), 0);
  await page.getByRole('region', { name: 'Composição da imagem', exact: true }).waitFor();
  await page.getByRole('button', { name: /2.*Enquadrar/ }).click();
  await range(page, 'Zoom', 1.2);
  assert.equal(Number(await page.getByRole('slider', { name: 'Zoom', exact: true }).inputValue()), 1.2);
  await library.locator('.template-card').filter({ hasText: 'stamp.mp4' }).click();
  item = await currentItem(page, 'photo.png');
  const imageLayer = item.render.layers.find((layer) => layer.type === 'video');
  await selectTrack(page, imageLayer.id);
  await number(page, 'Aparecer em (s)', 1);
  await number(page, 'Desaparecer em (s)', 3);
  await number(page, 'Começar no segundo do template', 0.5);
  await number(page, 'Momento da imagem exportada (s)', 0.2);
  await color(page, 0.79, 0.12875, -1);
  await exportPng(page, `${directory}/before.png`);
  await pngPixel(page, await readFile(`${directory}/before.png`), 0.79, 0.12875, -1);
  await number(page, 'Momento da imagem exportada (s)', 2);
  await color(page, 0.79, 0.12875, 1);
  await exportPng(page, `${directory}/inside.png`);
  await pngPixel(page, await readFile(`${directory}/inside.png`), 0.79, 0.12875, 1);
  await page.getByRole('button', { name: 'Reproduzir composição', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Quadro da imagem"]').value) > 2.2);
  await page.getByRole('button', { name: 'Pausar composição', exact: true }).click();
  await number(page, 'Momento da imagem exportada (s)', 2);
  await page.screenshot({ path: `${directory}/image-area.png` });
  checks.push(
    'Ala de imagens conserva enquadramento e templates compartilhados; composição reproduz e PNG real respeita o quadro e a janela da camada de vídeo',
  );
  const state = await stored(page),
    project = state.projects.find((project) => project.id === state.activeProjectByProfile[state.activeProfileId]);
  const preserved = structuredClone(project.items);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Camadas', exact: true }).click();
  await page.getByRole('tab', { name: /Imagens/ }).click();
  assert.equal((await currentItem(page, 'photo.png')).imageTime, 2);
  await page.getByRole('tab', { name: /Vídeos/ }).click();
  assert.equal(await page.locator('.timeline-track-row').count(), 7);
  assert.deepEqual((await stored(page)).projects.find((value) => value.id === project.id).items, preserved);
  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await page.getByRole('button', { name: 'Opções de Camadas', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar perfil', exact: true }).click();
  const backup = await pending;
  await backup.saveAs(`${directory}/camadas.oeprofile`);
  await choose(page, () => page.getByRole('button', { name: 'Importar perfil', exact: true }).click(), `${directory}/camadas.oeprofile`);
  await page.getByText('Perfil importado com segurança.', { exact: true }).waitFor();
  const restored = await stored(page);
  assert.equal(restored.profiles.filter((profile) => profile.name === 'Camadas').length, 2);
  const clone = restored.projects.find(
    (value) => value.profileId !== project.profileId && value.items.some((item) => item.title === 'photo.png'),
  );
  assert.equal(clone.items.find((item) => item.title === 'photo.png').imageTime, 2);
  assert.equal(clone.items.find((item) => item.title === 'clip.mp4').render.background.enable.start, 0.5);
  checks.push(
    'Reload e backup real preservam abas compatíveis, tempos de todas as camadas, offset/loop e quadro escolhido, sem perder as mídias da outra ala',
  );
  assert.deepEqual(errors, []);
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
