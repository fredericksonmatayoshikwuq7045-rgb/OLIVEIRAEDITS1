import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  fixtures,
  ffmpeg,
  choose,
  stored,
  currentItem,
  number,
  range,
  selectTrack,
  color,
  exportPng,
  pngPixel,
  resource,
  inspector,
  templateType,
  templateAction,
  trackAction,
} from './layer-helpers.mjs';
const directory = resolve(process.env.OE_SEQUENCE_DIR || '.artifacts/sequence-timeline');
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
  const files = await fixtures(page, directory),
    other = directory + '/other.mp4';
  ffmpeg(['-i', files.video, '-t', '2', '-c', 'copy', other]);
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Sequências');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir editor de Sequências', exact: true }).click();
  if (await page.getByRole('button', { name: 'Ocultar frase por hoje' }).count())
    await page.getByRole('button', { name: 'Ocultar frase por hoje' }).click();
  await choose(page, () => page.getByRole('button', { name: 'Importar arquivos', exact: true }).first().click(), [
    files.video,
    other,
    files.photo,
  ]);
  await page.getByText('Mídias do projeto (3)', { exact: true }).waitFor();
  await inspector(page, 'Tempo');
  await page.locator('.source-trim summary').click();
  await page.getByRole('spinbutton', { name: 'Fim do corte', exact: true }).fill('1');
  await resource(page, 'Templates');
  const library = page.locator('.library');
  await library.getByRole('button', { name: 'Headline', exact: true }).click();
  await templateType(page, 'video');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.stamp);
  await page.getByText('Template adicionado à biblioteca da conta.', { exact: true }).waitFor();
  await library.locator('.template-card').filter({ hasText: 'stamp.mp4' }).click();
  let item = await currentItem(page, 'clip.mp4'),
    layer = item.render.layers[0];
  assert.equal(item.trim.out, 1);
  assert.equal(layer.enable.end, 3);
  await page.getByRole('button', { name: 'Expandir timeline', exact: true }).click();
  await selectTrack(page, layer.id);
  await inspector(page);
  await page.getByRole('button', { name: 'Preencher tela', exact: true }).click();
  await number(page, 'Desaparecer em (s)', 8);
  await range(page, 'Posição na composição', 7);
  await color(page, 0.5, 0.5, 1);
  await page.getByRole('button', { name: 'Usar como abertura', exact: true }).click();
  item = await currentItem(page, 'clip.mp4');
  assert.equal(item.mediaStart, 8);
  await selectTrack(page, '@media');
  await number(page, 'Aparecer em (s)', 3);
  await selectTrack(page, layer.id);
  await number(page, 'Desaparecer em (s)', 3);
  await range(page, 'Posição na composição', 0.7);
  await color(page, 0.5, 0.5, 2);
  await range(page, 'Posição na composição', 3.2);
  await color(page, 0.5, 0.5, -1);
  checks.push('Headline estende a saída de 1s para 8s; abertura move o início do meme sem consumir seus quadros');
  await range(page, 'Posição na composição', 2.7);
  await page.getByRole('button', { name: 'Reproduzir prévia', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[aria-label="Posição na composição"]').value) > 3.15);
  await page.getByRole('button', { name: 'Pausar prévia', exact: true }).click();
  await color(page, 0.5, 0.5, -1);
  await selectTrack(page, '@media');
  await number(page, 'Aparecer em (s)', 0);
  await range(page, 'Posição na composição', 0.7);
  await color(page, 0.5, 0.5, 2);
  await trackAction(page, 'Subir camada');
  await color(page, 0.5, 0.5, -1);
  await trackAction(page, 'Descer camada');
  await color(page, 0.5, 0.5, 2);
  await page
    .locator('[data-track-id="@media"] .timeline-track-heading')
    .dragTo(page.locator(`[data-track-id="${layer.id}"] .timeline-track-heading`));
  await color(page, 0.5, 0.5, -1);
  await page
    .locator(`[data-track-id="${layer.id}"] .timeline-track-heading`)
    .dragTo(page.locator('[data-track-id="@media"] .timeline-track-heading'));
  await color(page, 0.5, 0.5, 2);
  await selectTrack(page, layer.id);
  await number(page, 'Largura (%)', 50);
  await number(page, 'Altura (%)', 50);
  await color(page, 0.2, 0.2, 2);
  await color(page, 0.8, 0.8, -1);
  await inspector(page);
  await page.getByRole('button', { name: 'Preencher tela', exact: true }).click();
  await selectTrack(page, '@media');
  await number(page, 'Aparecer em (s)', 3);
  const rows = page.locator('.timeline-track-row');
  assert.equal(await rows.count(), 2);
  await page.waitForFunction(
    () => [...document.querySelectorAll('.track-filmstrip')].filter((node) => node.querySelectorAll('img').length > 1).length >= 2,
  );
  await page.getByRole('button', { name: 'Aumentar zoom da timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Aumentar zoom da timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Aumentar zoom da timeline', exact: true }).click();
  assert.ok(await page.locator('.timeline-scroll').evaluate((node) => node.scrollWidth > node.clientWidth));
  await page.getByRole('button', { name: 'Diminuir zoom da timeline', exact: true }).click();
  await page.screenshot({ path: directory + '/stacked-timeline.png' });
  checks.push('Reprodução atravessa a abertura; camadas têm miniaturas, zoom, ordem real e largura/altura independentes');
  await selectTrack(page, layer.id);
  await range(page, 'Posição na composição', 1.2);
  await trackAction(page, 'Dividir camada no cursor');
  item = await currentItem(page, 'clip.mp4');
  assert.equal(item.render.layers.length, 2);
  assert.equal(item.render.layers[1].enable.start, 1.2);
  assert.equal(item.render.layers[1].sourceOffset, 1.2);
  await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  await templateType(page, 'image');
  await page.getByLabel('Arquivo do template', { exact: true }).setInputFiles(files.photo);
  await templateAction(page, 'photo.png', 'Adicionar camada de');
  item = await currentItem(page, 'clip.mp4');
  const photoLayer = item.render.layers.find((value) => value.type === 'image');
  assert.equal(item.render.layers.length, 2);
  await selectTrack(page, photoLayer.id);
  await number(page, 'Desaparecer em (s)', 6);
  await inspector(page);
  await page.getByRole('button', { name: 'Preencher tela', exact: true }).click();
  await range(page, 'Posição na composição', 5.5);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.stage-preview canvas');
    const p = canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return p[0] > 40 && p[0] < 60;
  });
  for (let count = 0; count < 3; count++) await page.getByRole('button', { name: 'Desfazer (Ctrl + Z)', exact: true }).click();
  checks.push('Headline em foto também dura além do vídeo; adicionar outra camada conserva a headline anterior');
  await page.getByRole('button', { name: 'Ações em lote', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar sequência em massa', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar a 2 mídia(s)', exact: true }).click();
  const data = await stored(page),
    project = data.projects.find((project) => project.id === data.activeProjectByProfile[data.activeProfileId]);
  for (const value of project.items) {
    assert.equal(value.mediaStart, 3);
    assert.equal(value.render.layers[0].enable.end, 3);
  }
  assert.equal(project.items.find((item) => item.title === 'other.mp4').trim.out, 2);
  assert.equal(project.items.find((item) => item.title === 'photo.png').kind, 'image');
  checks.push('Dividir camada conserva a fase; aplicação em massa mantém arquivos e durações originais dos destinos');
  await resource(page, 'Mídias');
  await page.getByRole('tab', { name: /Imagens/ }).click();
  await number(page, 'Momento da imagem exportada (s)', 0.7);
  await color(page, 0.5, 0.5, 2);
  await exportPng(page, directory + '/photo-intro.png');
  await pngPixel(page, await readFile(directory + '/photo-intro.png'), 0.5, 0.5, 2);
  await number(page, 'Momento da imagem exportada (s)', 3.5);
  await color(page, 0.5, 0.5, -1);
  await exportPng(page, directory + '/photo-main.png');
  await pngPixel(page, await readFile(directory + '/photo-main.png'), 0.5, 0.5, -1);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir editor de Sequências', exact: true }).click();
  assert.equal((await currentItem(page, 'clip.mp4')).mediaStart, 3);
  assert.equal((await currentItem(page, 'photo.png')).imageTime, 3.5);
  await page.getByRole('button', { name: 'Voltar às contas', exact: true }).click();
  await page.getByRole('button', { name: 'Opções de Sequências', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar perfil', exact: true }).click();
  await (await pending).saveAs(directory + '/sequencias.oeprofile');
  await choose(page, () => page.getByRole('button', { name: 'Importar perfil', exact: true }).click(), directory + '/sequencias.oeprofile');
  await page.getByText('Perfil importado com segurança.', { exact: true }).waitFor();
  const restored = await stored(page),
    clone = restored.projects.find((value) => value.id !== project.id && value.items.some((item) => item.title === 'clip.mp4'));
  assert.equal(clone.items.find((item) => item.title === 'clip.mp4').mediaStart, 3);
  assert.equal(clone.items.find((item) => item.title === 'clip.mp4').render.layers[0].audio, 'mix');
  checks.push('Backup e restauração reais preservam sequência, entrada da mídia e opção de áudio por camada');
  assert.deepEqual(errors, []);
  checks.push('Fotos mantêm sequência e quadro selecionado no PNG real; reload preserva tempos de entrada e camadas');
  await writeFile(directory + '/report.json', JSON.stringify({ status: 'passed', checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await writeFile(
    directory + '/failure.txt',
    String(error.stack) +
      '\n' +
      errors.join('\n') +
      '\n' +
      (await page
        .locator('body')
        .innerText()
        .catch(() => '')),
  );
  await page.screenshot({ path: directory + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
